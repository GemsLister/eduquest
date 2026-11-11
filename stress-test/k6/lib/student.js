// One student taking one exam, request for request like PublicQuizPage.jsx
// (the "fewer requests" version from 2026-11-12):
//   1. open the exam link         quiz_sections lookup + get_public_quiz_questions
//   2. start                      start_exam_attempt (one request: profile, attempt,
//                                 shuffled order, and saved answers/times on resume)
//   3. answer every question      save_quiz_response on each click; time spent is
//                                 sent in one save_question_times batch per minute
//   4. submit                     submit_quiz_attempt, carrying the unsent time
//
// The original flow (5-7 start requests, a time save per question) is in git
// history at commit 55f5135, which produced the "before" results.
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { qs, think, json, ok } from "./api.js";

export const examCompleted = new Rate("exam_completed");
export const examSeconds = new Trend("exam_seconds");
export const alreadyTaken = new Counter("exam_already_taken");
export const answerSaved = new Rate("answer_saved");

// Matches TIME_FLUSH_MS in PublicQuizPage.jsx
const TIME_FLUSH_SECONDS = 60;

function pickAnswer(q) {
  const n = q.type === "true_false" ? 2 : (q.options || []).length || 4;
  return String(Math.floor(Math.random() * n));
}

/**
 * @param api     Api signed in as the student
 * @param student { id, email, name, sectionIndex }
 * @param exam    { quizId, questionCount, sections: [{ sectionId, shareToken, examCode }] }
 * @param opts    { read: [min,max], think: [min,max], submitAt: ms timestamp|null, submitJitter: seconds }
 * @returns "completed" | "already_taken" | "failed"
 */
export function takeExam(api, student, exam, opts) {
  const started = Date.now();
  const section = exam.sections[student.sectionIndex % exam.sections.length];

  // ---------- 1. open the exam link ----------
  let link = null;
  let questions = null;
  group("1 open exam link", () => {
    const res = api.get(
      `/rest/v1/quiz_sections?${qs({
        select: "*,quizzes(*),sections(*)",
        share_token: `eq.${section.shareToken}`,
        "quizzes.is_published": "eq.true",
      })}`,
      "open_exam_link",
    );
    const rows = json(res);
    if (!check(res, { "exam link found": (r) => r.status === 200 && Array.isArray(rows) && rows.length === 1 })) return;
    link = rows[0];

    const q = api.rpc("get_public_quiz_questions", { p_quiz_id: exam.quizId }, "load_questions");
    const qRows = json(q);
    check(q, {
      "all questions loaded": (r) => r.status === 200 && Array.isArray(qRows) && qRows.length === exam.questionCount,
      "answer key not sent to the student": (r) => r.status !== 200 || r.body.indexOf("correct_answer") === -1,
    });
    if (q.status === 200 && Array.isArray(qRows)) questions = qRows;
  });
  if (!link || !questions || questions.length === 0) {
    examCompleted.add(false);
    return "failed";
  }

  think(opts.read); // reads the instructions and signs in

  // ---------- 2. start (one request) ----------
  let attemptId = null;
  let order = null;
  const saved = {}; // question id -> answer already stored (when resuming)
  let outcome = null;

  group("2 start exam", () => {
    const res = api.rpc(
      "start_exam_attempt",
      { p_quiz_id: exam.quizId, p_section_id: section.sectionId, p_student_name: student.name },
      "start_exam",
    );
    const body = json(res);
    if (res.status === 200 && body && body.status === "completed") {
      outcome = "already_taken";
      return;
    }
    if (!check(res, { "exam started": (r) => r.status === 200 && body && !!body.attempt_id })) return;
    attemptId = body.attempt_id;
    order = Array.isArray(body.question_order) && body.question_order.length ? body.question_order : questions.map((q) => q.id);
    for (const qid of Object.keys(body.answers || {})) saved[qid] = body.answers[qid];
  });

  if (outcome === "already_taken") {
    alreadyTaken.add(1);
    return outcome;
  }
  if (!attemptId) {
    examCompleted.add(false);
    return "failed";
  }

  // ---------- 3. answer ----------
  const byId = {};
  for (const q of questions) byId[q.id] = q;
  const answers = Object.assign({}, saved);
  let unsentTime = {}; // question id -> seconds not sent yet
  let lastFlush = Date.now();

  const flushTimes = () => {
    if (Object.keys(unsentTime).length === 0) return;
    const r = api.rpc("save_question_times", { p_attempt_id: attemptId, p_times: unsentTime }, "save_times");
    answerSaved.add(ok(r));
    if (check(r, { "time batch saved": ok })) unsentTime = {};
    lastFlush = Date.now();
  };

  group("3 answer questions", () => {
    for (const qid of order) {
      const q = byId[qid];
      if (!q) continue;
      const shownAt = Date.now();
      think(opts.think);

      if (!answers[qid] && Math.random() > 0.03) { // ~3% are left unanswered
        answers[qid] = pickAnswer(q);
        const r = api.rpc("save_quiz_response", { p_attempt_id: attemptId, p_question_id: qid, p_answer: answers[qid], p_time_spent: 0 }, "save_answer");
        answerSaved.add(ok(r));
        check(r, { "answer saved": ok });

        if (Math.random() < 0.1) { // changes their mind
          sleep(1 + Math.random() * 3);
          answers[qid] = pickAnswer(q);
          const r2 = api.rpc("save_quiz_response", { p_attempt_id: attemptId, p_question_id: qid, p_answer: answers[qid], p_time_spent: 0 }, "save_answer");
          answerSaved.add(ok(r2));
          check(r2, { "answer saved": ok });
        }
      }

      // "Next": the time is collected locally and sent in a batch once a minute
      const seconds = Math.round(((Date.now() - shownAt) / 1000) * 10) / 10;
      unsentTime[qid] = Math.round(((unsentTime[qid] || 0) + seconds) * 10) / 10;
      if ((Date.now() - lastFlush) / 1000 >= TIME_FLUSH_SECONDS) flushTimes();
    }
  });

  // ---------- 4. submit ----------
  if (opts.submitAt) {
    // Everyone's timer runs out together; the page then submits at a random
    // moment within submitJitter seconds (AUTO_SUBMIT_SPREAD_SECONDS).
    const wait = (opts.submitAt - Date.now()) / 1000 + Math.random() * (opts.submitJitter || 0);
    if (wait > 0) sleep(wait);
  }

  let submitted = false;
  group("4 submit", () => {
    const payload = questions.map((q) => ({
      question_id: q.id,
      answer: answers[q.id] || "",
      time_spent: unsentTime[q.id] || 0,
    }));
    const s = api.rpc("submit_quiz_attempt", { p_attempt_id: attemptId, p_answers: payload }, "submit_exam");
    submitted = check(s, { "exam submitted and scored": (r) => r.status === 200 && typeof json(r) === "number" });
  });

  examCompleted.add(submitted);
  if (submitted) examSeconds.add((Date.now() - started) / 1000);
  return submitted ? "completed" : "failed";
}
