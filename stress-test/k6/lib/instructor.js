// What an instructor does on a busy day, request for request like the app:
//   - open the results page of an exam with ~1,000 takers  (QuizResults.jsx)
//   - create an exam and import 50 questions               (useCreateQuiz.jsx, InstructorQuiz.jsx)
//   - run the Bloom's taxonomy analysis on it               (quizAnalysisService.js -> FastAPI)
import http from "k6/http";
import { check, group } from "k6";
import { Trend, Rate } from "k6/metrics";
import { qs, json, ok } from "./api.js";
import { makeQuestions } from "../../shared/questions.js";

export const resultsPageSeconds = new Trend("results_page_seconds");
export const resultsPageLoaded = new Rate("results_page_loaded");
export const createExamSeconds = new Trend("create_exam_seconds");
export const bloomsSeconds = new Trend("blooms_analyze_seconds");
export const bloomsOk = new Rate("blooms_analyze_ok");

// Which version of the results page to imitate:
//   before  the original page: attempts with no paging (capped at 1,000 rows) and
//           answers requested with every attempt id in the URL, 1,000 rows a page
//   after   since 2026-11-13: get_exam_attempts + get_exam_responses, one request each
const RESULTS_FLOW = (__ENV.RESULTS_FLOW || "after").toLowerCase();

/**
 * QuizResults.jsx loadQuizAndAttempts(). With sectionId, the page's section
 * filter is used (one class); without it, the whole exam.
 */
export function viewResults(api, quizId, sectionId = null) {
  const started = Date.now();
  let loaded = false;
  group("results page", () => {
    const quiz = api.get(`/rest/v1/quizzes?${qs({ select: "*", id: `eq.${quizId}` })}`, "results_quiz", {
      Accept: "application/vnd.pgrst.object+json",
    });
    if (!check(quiz, { "results: exam loaded": ok })) return;
    const parent = json(quiz).parent_quiz_id || quizId;

    const revs = api.get(`/rest/v1/quizzes?${qs({ select: "id", or: `(parent_quiz_id.eq.${parent},id.eq.${parent})` })}`, "results_revisions");
    const related = [quizId];
    for (const r of json(revs) || []) if (related.indexOf(r.id) === -1) related.push(r.id);

    let attempts;
    if (RESULTS_FLOW === "before") {
      const att = api.get(
        `/rest/v1/quiz_attempts?${qs(Object.assign(
          { select: "*", quiz_id: `in.(${related.join(",")})`, order: "completed_at.desc.nullslast" },
          sectionId ? { or: `(section_id.eq.${sectionId},section_id.is.null)` } : {},
        ))}`,
        "results_attempts",
      );
      if (!check(att, { "results: attempts loaded": ok })) return;
      attempts = json(att) || [];
    } else {
      const att = api.rpc("get_exam_attempts", { p_quiz_ids: related, p_section_id: sectionId, p_completed_only: false }, "results_attempts");
      attempts = json(att);
      if (!check(att, { "results: attempts loaded": (r) => r.status === 200 && Array.isArray(attempts) })) return;
    }

    api.get(
      `/rest/v1/quiz_questions?${qs({ select: "questions(id,text,points,created_at),order_index", quiz_id: `eq.${quizId}`, order: "order_index.asc" })}`,
      "results_questions",
    );
    api.get(
      `/rest/v1/questions?${qs({ select: "id,quiz_id,created_at", quiz_id: `in.(${related.join(",")})`, order: "created_at.asc" })}`,
      "results_question_map",
    );

    const completedIds = attempts.filter((a) => a.status === "completed").map((a) => a.id);
    let allOk = true;
    if (completedIds.length && RESULTS_FLOW === "before") {
      // Every completed attempt id goes into the URL, 1,000 responses per page.
      for (let from = 0; ; from += 1000) {
        const page = api.get(
          `/rest/v1/quiz_responses?${qs({
            select: "attempt_id,question_id,time_spent_seconds,answer",
            attempt_id: `in.(${completedIds.join(",")})`,
            offset: from,
            limit: 1000,
          })}`,
          "results_responses",
        );
        if (!check(page, { "results: responses page loaded": ok })) {
          allOk = false;
          break;
        }
        const rows = json(page) || [];
        if (rows.length < 1000) break;
      }
    } else if (completedIds.length) {
      // One request; the attempt ids go in the request body.
      const res = api.rpc("get_exam_responses", { p_attempt_ids: completedIds }, "results_responses");
      const body = json(res);
      allOk = check(res, {
        "results: responses loaded": (r) => r.status === 200 && body && body.r && Object.keys(body.r).length === completedIds.length,
      });
    }
    loaded = allOk;
  });
  resultsPageLoaded.add(loaded);
  if (loaded) resultsPageSeconds.add((Date.now() - started) / 1000);
  return loaded;
}

/** Create an exam and import `count` questions the way the exam editor saves them. */
export function createExam(api, instructor, count) {
  const started = Date.now();
  let result = null;
  group("create exam", () => {
    const created = api.post(
      "/rest/v1/quizzes",
      [{
        instructor_id: instructor.id,
        title: `[k6 instructor] ${instructor.email} ${Date.now()}`,
        description: "Created by the k6 instructor scenario",
        duration: 60,
        is_published: false,
        is_private: true,
        section_id: instructor.sectionId,
      }],
      "create_quiz",
      { Prefer: "return=representation" },
    );
    const rows = json(created) || [];
    if (!check(created, { "exam created": (r) => r.status === 201 && rows.length === 1 })) return;
    const quizId = rows[0].id;

    check(api.post("/rest/v1/quiz_sections", [{ quiz_id: quizId, section_id: instructor.sectionId }], "create_quiz_sections"), {
      "exam assigned to section": ok,
    });
    api.rpc("auto_share_quiz_with_subject_sections", { p_quiz_id: quizId }, "auto_share_quiz");

    const qRows = makeQuestions(count, Math.floor(Math.random() * 100000)).map((q) => Object.assign({ quiz_id: quizId }, q));
    const ins = api.post("/rest/v1/questions", qRows, "import_questions", { Prefer: "return=representation" });
    const inserted = json(ins) || [];
    if (!check(ins, { "questions imported": (r) => r.status === 201 && inserted.length === count })) return;

    const all = api.get(
      `/rest/v1/questions?${qs({ select: "*", quiz_id: `eq.${quizId}`, or: "(is_archived.is.null,is_archived.eq.false)", order: "created_at.asc" })}`,
      "reload_questions",
    );
    const allRows = json(all) || inserted;
    api.del(`/rest/v1/quiz_questions?${qs({ quiz_id: `eq.${quizId}` })}`, "relink_questions_delete");
    check(
      api.post("/rest/v1/quiz_questions", allRows.map((q, idx) => ({ quiz_id: quizId, question_id: q.id, order_index: idx })), "relink_questions_insert"),
      { "questions linked to exam": ok },
    );
    result = { quizId, questions: allRows };
  });
  if (result) createExamSeconds.add((Date.now() - started) / 1000);
  return result;
}

/** POST /api/quiz/analyze on the FastAPI Bloom's service. */
export function analyzeBlooms(bloomsUrl, quizId, questions) {
  const body = {
    quizId,
    questions: questions.map((q) => ({ id: String(q.id), text: q.text, choices: q.options || null })),
  };
  const started = Date.now();
  const res = http.post(`${bloomsUrl.replace(/\/+$/, "")}/api/quiz/analyze`, JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    tags: { name: "blooms_analyze" },
    timeout: "180s",
  });
  const out = json(res);
  const good = check(res, {
    "Bloom's analysis returned every question": (r) => r.status === 200 && out && out.analysis && out.analysis.length === questions.length,
  });
  bloomsOk.add(good);
  if (good) bloomsSeconds.add((Date.now() - started) / 1000);
  return good;
}
