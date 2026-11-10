// Fills the TEST project with everything the k6 scenarios need:
//   - STUDENTS student accounts and INSTRUCTORS approved instructor accounts
//   - one section per instructor
//   - ROUNDS published "exam day" exams, each with QUESTIONS questions and
//     shared across SECTIONS_PER_EXAM sections (students are spread across them)
//   - one "results page" exam with RESULTS_EXAM_TAKERS completed attempts, so
//     the instructor results page has 1,000 students' answers to load
// then signs every account in and saves the tokens (see tokens.mjs).
//
// Safe to re-run: finished steps are remembered in data/users.json.
//
//   npm run seed

import crypto from "node:crypto";
import {
  loadConfig, adminClient, readData, writeData, pool, chunks, must, progress, intEnv,
  STUDENT_EMAIL, INSTRUCTOR_EMAIL, ROUND_TITLE, RESULTS_TITLE,
} from "./common.mjs";
import { checkProject } from "./check.mjs";
import { collectTokens } from "./tokens.mjs";
import { makeQuestions } from "../shared/questions.js";

const counts = {
  students: intEnv("STUDENTS", 2000),
  instructors: intEnv("INSTRUCTORS", 100),
  rounds: intEnv("ROUNDS", 10),
  questions: intEnv("QUESTIONS", 50),
  sectionsPerExam: intEnv("SECTIONS_PER_EXAM", 20),
  resultsTakers: intEnv("RESULTS_EXAM_TAKERS", 1000),
  examMinutes: intEnv("EXAM_MINUTES", 60),
};

function validateCounts() {
  if (counts.students < 1 || counts.instructors < 1) throw new Error("STUDENTS and INSTRUCTORS must be at least 1.");
  if (counts.sectionsPerExam < 1 || counts.sectionsPerExam > counts.instructors) {
    throw new Error("SECTIONS_PER_EXAM must be between 1 and INSTRUCTORS (each instructor owns one section).");
  }
  if (counts.resultsTakers > counts.students) throw new Error("RESULTS_EXAM_TAKERS can't be more than STUDENTS.");
  if (counts.rounds < 1 || counts.questions < 1) throw new Error("ROUNDS and QUESTIONS must be at least 1.");
}

// ---------- accounts ----------
async function createAccounts(admin, data) {
  const wanted = [
    ...Array.from({ length: counts.instructors }, (_, i) => ({ kind: "instructors", n: i + 1, email: INSTRUCTOR_EMAIL(i + 1), name: `K6 Instructor ${i + 1}` })),
    ...Array.from({ length: counts.students }, (_, i) => ({ kind: "students", n: i + 1, email: STUDENT_EMAIL(i + 1), name: `K6 Student ${i + 1}` })),
  ];
  const have = new Set([...data.instructors, ...data.students].map((a) => a.email));
  const todo = wanted.filter((w) => !have.has(w.email));
  if (todo.length === 0) return;

  console.log(`Creating ${todo.length} accounts...`);
  let existing = null; // email -> id, loaded only if some accounts already exist in Auth
  const loadExisting = async () => {
    existing = new Map();
    for (let page = 1; ; page++) {
      const res = must(await admin.auth.admin.listUsers({ page, perPage: 1000 }), "List users");
      for (const u of res.users) existing.set(u.email, u.id);
      if (res.users.length < 1000) break;
    }
  };

  let done = 0;
  await pool(todo, 8, async (w) => {
    let { data: created, error } = await admin.auth.admin.createUser({
      email: w.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: w.name },
    });
    let id = created?.user?.id;
    if (error) {
      if (!/already|exists|registered/i.test(error.message)) throw new Error(`Create ${w.email} failed: ${error.message}`);
      if (!existing) await loadExisting();
      id = existing.get(w.email);
      if (!id) throw new Error(`${w.email} exists in Auth but could not be found`);
      // make sure the stored password works
      must(await admin.auth.admin.updateUserById(id, { password: data.password }), `Reset password for ${w.email}`);
    }
    data[w.kind].push({ n: w.n, email: w.email, name: w.name, id });
    done++;
    progress("accounts", done, todo.length);
    if (done % 100 === 0) writeData(data);
  });
  data.instructors.sort((a, b) => a.n - b.n);
  data.students.sort((a, b) => a.n - b.n);
  writeData(data);
}

async function createInstructorProfiles(admin, data) {
  if (data.done.profiles) return;
  console.log("Creating approved instructor profiles...");
  const rows = data.instructors.map((i) => ({
    id: i.id,
    email: i.email,
    username: i.email.split("@")[0],
    first_name: "K6",
    last_name: `Instructor ${i.n}`,
    is_instructor: true,
    is_approved: true,
  }));
  for (const part of chunks(rows, 500)) {
    must(await admin.from("profiles").upsert(part, { onConflict: "id" }), "Create instructor profiles");
  }
  data.done.profiles = true;
  writeData(data);
}

async function createSections(admin, data) {
  if (data.done.sections) return;
  console.log("Creating one section per instructor...");
  const rows = data.instructors.map((i) => ({
    instructor_id: i.id,
    name: `K6 Section ${i.n}`,
    description: "Load test section",
    exam_code: `K6${data.runTag}${String(i.n).padStart(3, "0")}`,
  }));
  const created = [];
  for (const part of chunks(rows, 200)) {
    created.push(...must(await admin.from("sections").insert(part).select("id, instructor_id, exam_code"), "Create sections"));
  }
  const byInstructor = new Map(created.map((s) => [s.instructor_id, s]));
  for (const i of data.instructors) {
    const s = byInstructor.get(i.id);
    i.sectionId = s.id;
    i.examCode = s.exam_code;
  }
  data.done.sections = true;
  writeData(data);
}

// ---------- exams ----------
async function createExam(admin, data, { title, seed }) {
  const owner = data.instructors[0];
  const [quiz] = must(
    await admin.from("quizzes").insert([{
      instructor_id: owner.id,
      title,
      description: "Created by the stress-test seed script",
      duration: counts.examMinutes,
      is_published: true,
      is_private: false,
      is_open: true,
      section_id: owner.sectionId,
    }]).select("id"),
    `Create exam "${title}"`,
  );

  const questionRows = makeQuestions(counts.questions, seed).map((q) => ({ ...q, quiz_id: quiz.id }));
  const questions = must(
    await admin.from("questions").insert(questionRows).select("id, type, options, correct_answer, points, created_at"),
    `Create questions for "${title}"`,
  );
  // keep the generated order
  questions.sort((a, b) => questionRows.findIndex((r) => r.text === a.text) - questionRows.findIndex((r) => r.text === b.text));

  must(
    await admin.from("quiz_questions").insert(questions.map((q, idx) => ({ quiz_id: quiz.id, question_id: q.id, order_index: idx }))),
    `Link questions for "${title}"`,
  );

  const sectionRows = data.instructors.slice(0, counts.sectionsPerExam).map((i) => ({ quiz_id: quiz.id, section_id: i.sectionId }));
  const links = must(
    await admin.from("quiz_sections").insert(sectionRows).select("section_id, share_token"),
    `Share "${title}" with sections`,
  );
  const tokenBySection = new Map(links.map((l) => [l.section_id, l.share_token]));
  const sections = data.instructors.slice(0, counts.sectionsPerExam).map((i) => ({
    sectionId: i.sectionId,
    examCode: i.examCode,
    shareToken: tokenBySection.get(i.sectionId),
  }));
  if (sections.some((s) => !s.shareToken)) {
    throw new Error(`quiz_sections rows for "${title}" have no share_token (is the on_quiz_sections_insert trigger in the schema copy?)`);
  }
  return { quizId: quiz.id, title, questionCount: questions.length, questions, sections };
}

async function createRoundExams(admin, data) {
  for (let r = data.exams.length; r < counts.rounds; r++) {
    process.stdout.write(`\r  exam day rounds: ${r + 1}/${counts.rounds}   `);
    const exam = await createExam(admin, data, { title: `${ROUND_TITLE} ${r + 1}`, seed: r + 1 });
    delete exam.questions; // k6 loads questions through the API like the app does
    data.exams.push(exam);
    writeData(data);
  }
  if (counts.rounds) process.stdout.write("\n");
}

async function createResultsExam(admin, data) {
  if (data.resultsExam?.done) return;
  console.log(`Creating the results-page exam with ${counts.resultsTakers} completed attempts...`);
  const exam = data.resultsExam?.quizId
    ? data.resultsExam
    : await createExam(admin, data, { title: RESULTS_TITLE, seed: 999 });
  const questions = exam.questions;
  data.resultsExam = { quizId: exam.quizId, title: exam.title, questionCount: exam.questionCount, questions, sections: exam.sections };
  writeData(data);

  // Each question gets its own difficulty so item analysis has something to show.
  const pCorrect = questions.map((_, i) => 0.35 + ((i * 37) % 55) / 100);
  const takers = data.students.slice(0, counts.resultsTakers);
  const start = Date.now() - 3 * 24 * 3600 * 1000;

  let done = 0;
  for (const group of chunks(takers, 200)) {
    const answersByEmail = new Map();
    const attemptRows = group.map((s) => {
      let score = 0;
      const answers = questions.map((q, qi) => {
        const right = Math.random() < pCorrect[qi];
        let answer;
        if (q.type === "true_false") {
          const correctIdx = q.correct_answer === "true" ? 0 : 1;
          answer = String(right ? correctIdx : 1 - correctIdx);
        } else {
          const correctIdx = q.options.indexOf(q.correct_answer);
          const wrong = [0, 1, 2, 3].filter((x) => x !== correctIdx);
          answer = String(right ? correctIdx : wrong[Math.floor(Math.random() * wrong.length)]);
        }
        if (right) score += q.points || 1;
        return { question_id: q.id, answer, is_correct: right, points_earned: right ? q.points || 1 : 0, time_spent_seconds: 5 + Math.round(Math.random() * 85) };
      });
      answersByEmail.set(s.email, answers);
      const startedAt = new Date(start + Math.random() * 3600 * 1000);
      return {
        quiz_id: exam.quizId,
        section_id: exam.sections[s.sectionIndex].sectionId,
        user_id: s.id,
        student_name: s.name,
        student_email: s.email,
        status: "completed",
        score,
        started_at: startedAt.toISOString(),
        completed_at: new Date(startedAt.getTime() + (20 + Math.random() * 40) * 60 * 1000).toISOString(),
      };
    });
    const attempts = must(await admin.from("quiz_attempts").insert(attemptRows).select("id, student_email"), "Create completed attempts");
    const responseRows = attempts.flatMap((a) => answersByEmail.get(a.student_email).map((r) => ({ ...r, attempt_id: a.id })));
    for (const part of chunks(responseRows, 1000)) {
      must(await admin.from("quiz_responses").insert(part), "Create responses");
    }
    done += group.length;
    progress("completed attempts", done, takers.length);
  }
  data.resultsExam.done = true;
  writeData(data);
}

// ---------- main ----------
try {
  validateCounts();
  const cfg = loadConfig();
  console.log(`Seeding TEST project ${cfg.url}`);

  const problems = await checkProject(cfg);
  if (problems.length) {
    console.log("The test project is not ready:");
    for (const p of problems) console.log(`  - ${p}`);
    console.log("Copy the production schema into the test project first (README step 2).");
    process.exit(1);
  }

  const data = readData(cfg) || {
    project: { url: cfg.url, anonKey: cfg.anonKey },
    createdAt: new Date().toISOString(),
    runTag: crypto.randomBytes(2).toString("hex").toUpperCase(),
    password: `K6-${crypto.randomBytes(12).toString("base64url")}`,
    counts,
    done: {},
    instructors: [],
    students: [],
    exams: [],
    resultsExam: null,
  };
  data.project.anonKey = cfg.anonKey;
  writeData(data);

  const admin = adminClient(cfg);
  await createAccounts(admin, data);
  await createInstructorProfiles(admin, data);
  await createSections(admin, data);
  // spread students across the sections the exams are shared with
  data.students.forEach((s, idx) => { s.sectionIndex = idx % counts.sectionsPerExam; });
  writeData(data);
  await createRoundExams(admin, data);
  await createResultsExam(admin, data);
  await collectTokens(cfg, data);

  console.log(`\nDone. ${data.students.length} students, ${data.instructors.length} instructors, ${data.exams.length} exam-day exams, 1 results-page exam.`);
  console.log("Next: run a k6 scenario (see README).");
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}
