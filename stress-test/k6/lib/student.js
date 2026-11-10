// One student taking one exam, request for request like PublicQuizPage.jsx:
//   1. open the exam link         quiz_sections lookup + get_public_quiz_questions
//   2. start                      student_profile lookup/create/update,
//                                 attempt lookup, create attempt, save shuffled order
//   3. answer every question      save_quiz_response on each click, and again with
//                                 the time spent when moving to the next question
//   4. submit                     submit_quiz_attempt
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { qs, think, json, ok } from "./api.js";

export const examCompleted = new Rate("exam_completed");
export const examSeconds = new Trend("exam_seconds");
export const alreadyTaken = new Counter("exam_already_taken");
export const answerSaved = new Rate("answer_saved");

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

  // ---------- 2. start ----------
  let attemptId = null;
  let order = null;
  const saved = {}; // question id -> answer already stored (when resuming)
  let outcome = null;

  group("2 start exam", () => {
    const email = student.email;
    const studentId = email.split("@")[0];
    const examCode = (link.sections && link.sections.exam_code) || null;

    const prof = api.get(`/rest/v1/student_profile?${qs({ select: "id", student_email: `eq.${email}` })}`, "student_profile_lookup");
    const profRows = json(prof) || [];
    if (prof.status === 200 && profRows.length) {
      const upd = api.patch(
        `/rest/v1/student_profile?${qs({ id: `eq.${profRows[0].id}` })}`,
        { student_id: studentId, student_name: student.name, exam_code: examCode },
        "student_profile_update",
        { Prefer: "return=representation" },
      );
      check(upd, { "student profile updated": ok });
    } else {
      const ins = api.post(
        "/rest/v1/student_profile",
        [{ student_email: email, student_name: student.name, student_id: studentId, exam_code: examCode }],
        "student_profile_create",
        { Prefer: "return=representation" },
      );
      check(ins, { "student profile created": ok });
    }

    const look = api.get(
      `/rest/v1/quiz_attempts?${qs({
        select: "id,status",
        quiz_id: `eq.${exam.quizId}`,
        student_email: `eq.${email}`,
        status: "in.(in_progress,completed)",
        section_id: `eq.${section.sectionId}`,
      })}`,
      "attempt_lookup",
    );
    const existing = json(look) || [];
    if (existing.some((a) => a.status === "completed")) {
      outcome = "already_taken";
      return;
    }
    const inProgress = existing.find((a) => a.status === "in_progress");

    if (inProgress) {
      // resume, like restoreAttemptState()
      attemptId = inProgress.id;
      const st = api.get(`/rest/v1/quiz_attempts?${qs({ select: "question_order,started_at", id: `eq.${attemptId}` })}`, "resume_attempt");
      const stRows = json(st) || [];
      if (stRows[0] && Array.isArray(stRows[0].question_order)) order = stRows[0].question_order;
      const resp = api.get(`/rest/v1/quiz_responses?${qs({ select: "*", attempt_id: `eq.${attemptId}` })}`, "resume_answers");
      for (const r of json(resp) || []) if (r.answer !== null && r.answer !== "") saved[r.question_id] = r.answer;
    } else {
      const created = api.post(
        "/rest/v1/quiz_attempts",
        [{
          quiz_id: exam.quizId,
          section_id: section.sectionId,
          user_id: student.id,
          student_name: student.name,
          student_email: email,
          status: "in_progress",
        }],
        "create_attempt",
        { Prefer: "return=representation" },
      );
      if (created.status === 409) {
        outcome = "already_taken";
        return;
      }
      const rows = json(created) || [];
      if (!check(created, { "attempt created": (r) => r.status === 201 && rows.length === 1 })) return;
      attemptId = rows[0].id;
    }

    if (!order) {
      order = shuffle(questions.map((q) => q.id));
      const o = api.patch(`/rest/v1/quiz_attempts?${qs({ id: `eq.${attemptId}` })}`, { question_order: order }, "save_question_order");
      check(o, { "question order saved": ok });
    }
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

      // "Next": finalizeCurrentQuestionTime() saves the answer with the time spent
      const seconds = Math.round(((Date.now() - shownAt) / 1000) * 10) / 10;
      const t = api.rpc("save_quiz_response", { p_attempt_id: attemptId, p_question_id: qid, p_answer: answers[qid] || null, p_time_spent: seconds }, "save_time");
      answerSaved.add(ok(t));
      check(t, { "time saved": ok });
    }
  });

  // ---------- 4. submit ----------
  if (opts.submitAt) {
    // Everyone waits for the same deadline, like the exam timer running out.
    const wait = (opts.submitAt - Date.now()) / 1000 + Math.random() * (opts.submitJitter || 0);
    if (wait > 0) sleep(wait);
  }

  let submitted = false;
  group("4 submit", () => {
    const payload = questions.map((q) => ({ question_id: q.id, answer: answers[q.id] || "" }));
    const s = api.rpc("submit_quiz_attempt", { p_attempt_id: attemptId, p_answers: payload }, "submit_exam");
    submitted = check(s, { "exam submitted and scored": (r) => r.status === 200 && typeof json(r) === "number" });
  });

  examCompleted.add(submitted);
  if (submitted) examSeconds.add((Date.now() - started) / 1000);
  return submitted ? "completed" : "failed";
}
