// Tests for the exam grading / integrity migrations.
//
// Runs the real migration files on PGlite (Postgres compiled to WebAssembly,
// in memory). Nothing here connects to Supabase. Supabase-specific pieces
// (auth.uid(), auth.jwt(), the anon/authenticated roles) are stubbed so the
// functions behave as they do behind the Supabase API.
//
//   cd supabase/tests
//   npm install
//   npm test
//
// Limitation: PGlite has a single connection, so "concurrent" calls run one
// after another. These tests prove the logic is correct; real parallel load
// is the job of the k6 stress test.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = [
  "20261111_harden_exam_grading.sql",
  "20261111_protect_attempts_and_answer_key.sql",
  "20261111_restrict_question_reads_to_staff.sql",
  "20261112_fewer_exam_requests.sql",
  "20261113_exam_results_in_one_request.sql",
  "20261114_protect_student_data.sql",
].map((f) => path.join(here, "..", "migrations", f));

const db = new PGlite();

const ids = {
  quizA: "aaaaaaaa-0000-0000-0000-000000000001", // published, questions via questions.quiz_id
  quizB: "aaaaaaaa-0000-0000-0000-000000000002", // published, questions via quiz_questions
  quizDraft: "aaaaaaaa-0000-0000-0000-000000000003", // not published
  q1: "bbbbbbbb-0000-0000-0000-000000000001", // A: mcq, correct option 1 ("B"), 2 pts
  q2: "bbbbbbbb-0000-0000-0000-000000000002", // A: true_false, correct = true, 1 pt
  q3: "bbbbbbbb-0000-0000-0000-000000000003", // B only: mcq, 50 pts
  q4: "bbbbbbbb-0000-0000-0000-000000000004", // owned by B, also linked to A via quiz_questions, 3 pts
  q5: "bbbbbbbb-0000-0000-0000-000000000005", // A: mcq, auto_answer, correct option 2 ("R"), 4 pts
  q6: "bbbbbbbb-0000-0000-0000-000000000006", // draft quiz question
  alice: "cccccccc-0000-0000-0000-000000000001",
  aliceOtherDevice: "cccccccc-0000-0000-0000-000000000009",
  mallory: "cccccccc-0000-0000-0000-000000000002",
  attempt: "dddddddd-0000-0000-0000-000000000001",
  instructor: "eeeeeeee-0000-0000-0000-000000000001", // approved instructor, owns quiz A
  pendingInstructor: "eeeeeeee-0000-0000-0000-000000000002", // registered, not approved yet
  admin: "eeeeeeee-0000-0000-0000-000000000003", // Senior Faculty
  head: "eeeeeeee-0000-0000-0000-000000000004", // Department Head
  bob: "cccccccc-0000-0000-0000-000000000003", // student who starts with start_exam_attempt
  bobTwin: "cccccccc-0000-0000-0000-000000000004", // different email, same "bob" prefix
  sectionS: "ffffffff-0000-0000-0000-000000000001",
  sectionTeacher: "eeeeeeee-0000-0000-0000-000000000005", // teaches one section of someone else's exam
};

// ---------- Fake Supabase environment + minimal copies of the real tables ----------
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
    $$ SELECT jsonb_build_object('email', nullif(current_setting('test.email', true), '')) $$;

  CREATE TABLE profiles (
    id uuid PRIMARY KEY, is_admin boolean DEFAULT false, is_faculty_head boolean DEFAULT false,
    is_instructor boolean DEFAULT false, is_approved boolean NOT NULL DEFAULT false);
  CREATE TABLE quizzes (id uuid PRIMARY KEY, is_published boolean DEFAULT false, instructor_id uuid,
    is_open boolean NOT NULL DEFAULT true, section_id uuid);
  CREATE TABLE sections (id uuid PRIMARY KEY, exam_code varchar(50), instructor_id uuid);
  CREATE TABLE student_profile (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_email text NOT NULL UNIQUE,
    student_name text, exam_code varchar, student_id text UNIQUE);
  CREATE TABLE questions (
    id uuid PRIMARY KEY, quiz_id uuid REFERENCES quizzes(id), type varchar(50),
    text text, options text[], correct_answer text, points integer,
    original_correct_answer text, previous_correct_answer text,
    created_at timestamptz DEFAULT now());
  CREATE TABLE quiz_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quiz_id uuid, question_id uuid,
    order_index int DEFAULT 0, UNIQUE (quiz_id, question_id));
  CREATE TABLE quiz_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quiz_id uuid, user_id uuid, student_email text,
    score integer DEFAULT 0, status varchar(50) DEFAULT 'in_progress',
    started_at timestamptz DEFAULT now(), completed_at timestamptz, question_order jsonb,
    section_id uuid, student_name varchar(255));
  -- same one-attempt-per-student rules as production
  CREATE UNIQUE INDEX one_completed_per_section ON quiz_attempts (quiz_id, student_email, section_id)
    WHERE status = 'completed' AND section_id IS NOT NULL;
  CREATE UNIQUE INDEX one_open_per_section ON quiz_attempts (quiz_id, student_email, section_id)
    WHERE status = 'in_progress' AND section_id IS NOT NULL;
  CREATE TABLE quiz_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
    answer text, is_correct boolean, points_earned integer DEFAULT 0,
    time_spent_seconds numeric(12,1) NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now());
  ALTER TABLE quiz_responses ADD CONSTRAINT quiz_responses_attempt_question_unique
    UNIQUE (attempt_id, question_id);

  -- Supabase grants table access to the API roles.
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

  -- Mimic the live permissive policies on questions (any user may read
  -- published quizzes' questions; instructors their own). RLS on the other
  -- tables is left out.
  ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can view published quiz questions" ON questions FOR SELECT
    USING (EXISTS (SELECT 1 FROM quizzes q WHERE q.id = quiz_id AND q.is_published));
  CREATE POLICY "Instructors can view questions in their quizzes" ON questions FOR SELECT
    USING (EXISTS (SELECT 1 FROM quizzes q WHERE q.id = quiz_id AND q.instructor_id = auth.uid()));

  INSERT INTO profiles (id, is_admin, is_faculty_head, is_instructor, is_approved) VALUES
    ('${ids.alice}', false, false, false, false),
    ('${ids.instructor}', false, false, true, true),
    ('${ids.pendingInstructor}', false, false, true, false),
    ('${ids.admin}', true, false, false, true),
    ('${ids.head}', false, true, false, true);

  -- Old 3-argument overload, to confirm the migration drops it
  CREATE FUNCTION save_quiz_response(p_attempt_id uuid, p_question_id uuid, p_answer text)
    RETURNS void LANGUAGE sql AS $$ SELECT $$;
  -- Old broken loader, to confirm it is replaced
  CREATE FUNCTION get_public_quiz_questions(p_quiz_id uuid)
    RETURNS TABLE (id uuid, correct_answer text) LANGUAGE sql AS $$ SELECT NULL::uuid, NULL::text $$;

  INSERT INTO quizzes VALUES ('${ids.quizA}', true, '${ids.instructor}'), ('${ids.quizB}', true, '${ids.admin}'),
    ('${ids.quizDraft}', false, '${ids.instructor}');
  INSERT INTO questions (id, quiz_id, type, text, options, correct_answer, points, created_at) VALUES
    ('${ids.q1}', '${ids.quizA}', 'mcq', 'Q1', ARRAY['A','B','C','D'], 'B', 2, now() - interval '5 min'),
    ('${ids.q2}', '${ids.quizA}', 'true_false', 'Q2', NULL, 'true', NULL, now() - interval '4 min'),
    ('${ids.q3}', '${ids.quizB}', 'mcq', 'Q3', ARRAY['X','Y'], 'X', 50, now() - interval '3 min'),
    ('${ids.q4}', '${ids.quizB}', 'mcq', 'Q4', ARRAY['P','Q'], 'Q', 3, now() - interval '2 min'),
    ('${ids.q5}', '${ids.quizA}', 'mcq', 'Q5', ARRAY['P','Q','R'], 'R', 4, now() - interval '1 min'),
    ('${ids.q6}', '${ids.quizDraft}', 'mcq', 'Q6', ARRAY['M','N'], 'M', 1, now());
  INSERT INTO quiz_questions (quiz_id, question_id, order_index) VALUES
    ('${ids.quizB}', '${ids.q4}', 0), ('${ids.quizB}', '${ids.q3}', 1);
  INSERT INTO sections VALUES ('${ids.sectionS}', 'EXAM-S');
  INSERT INTO quiz_attempts (id, quiz_id, user_id, student_email)
    VALUES ('${ids.attempt}', '${ids.quizA}', '${ids.alice}', 'Alice@School.edu');
`);

for (const file of MIGRATIONS) {
  await db.exec(readFileSync(file, "utf8"));
  console.log(`applied ${path.basename(file)}`);
}
// The real DB already has auto_answer; the migration adds it here. Flag q5 and link q4 to quiz A.
await db.exec(`
  UPDATE questions SET auto_answer = true WHERE id = '${ids.q5}';
  INSERT INTO quiz_questions (quiz_id, question_id) VALUES ('${ids.quizA}', '${ids.q4}');
`);

// ---------- Helpers ----------
let failures = 0;
let section = "";
const group = (name) => { section = name; console.log(`\n${name}`); };
const check = (name, cond, extra = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${!cond && extra ? "\n        got: " + extra : ""}`);
  if (!cond) failures++;
};
// Act as a signed-in user, as the Supabase API would (role + JWT claims).
const as = async (uid, email, role = "authenticated") => {
  await db.exec("RESET ROLE");
  await db.query(`SELECT set_config('test.uid', $1, false), set_config('test.email', $2, false)`, [uid ?? "", email ?? ""]);
  if (role) await db.exec(`SET ROLE ${role}`);
};
const asAdmin = () => db.exec("RESET ROLE");
const save = (q, ans, t = 0) =>
  db.query(`SELECT save_quiz_response($1, $2, $3, $4)`, [ids.attempt, q, ans, t]);
const submit = async (answers) =>
  (await db.query(`SELECT submit_quiz_attempt($1, $2::jsonb) AS s`, [ids.attempt, JSON.stringify(answers)])).rows[0].s;
const resp = async (q) => {
  await asAdmin();
  return (await db.query(`SELECT answer, is_correct, points_earned, time_spent_seconds::float AS t
                     FROM quiz_responses WHERE attempt_id = $1 AND question_id = $2`, [ids.attempt, q])).rows[0];
};
const attempt = async (id = ids.attempt) => {
  await asAdmin();
  return (await db.query(`SELECT status, score, completed_at, started_at FROM quiz_attempts WHERE id = $1`, [id])).rows[0];
};
const fails = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
const j = (x) => JSON.stringify(x);
const alice = () => as(ids.alice, "alice@school.edu");

// ---------- Tests ----------
group("Setup");
await asAdmin();
const overloads = (await db.query(`SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'save_quiz_response'`)).rows[0].n;
check("old 3-argument save_quiz_response is dropped", overloads === 1, `${overloads} versions left`);

group("Who may save / submit");
await as(null, null, "anon");
let err = await fails(() => save(ids.q1, "1"));
check("anon role cannot call save_quiz_response", err?.includes("permission denied"), err);
await as(null, null);
err = await fails(() => save(ids.q1, "1"));
check("signed-out call is rejected", err?.includes("signed in"), err);
await as(ids.mallory, "mallory@school.edu");
err = await fails(() => save(ids.q1, "0"));
check("another student cannot save into this attempt", err?.includes("own exam attempt"), err);
err = await fails(() => submit([]));
check("another student cannot submit this attempt", err?.includes("own exam attempt"), err);
await as(ids.aliceOtherDevice, "ALICE@school.edu");
err = await fails(() => save(ids.q2, "1"));
check("same email on another device can save (case-insensitive)", err === null, err);

group("Saving answers (item 1)");
await alice();
await save(ids.q1, "1", 5);
let r = await resp(ids.q1);
check("correct MCQ answer earns its 2 points", r.answer === "1" && r.is_correct && r.points_earned === 2 && r.t === 5, j(r));
await alice(); await save(ids.q1, null, 3);
r = await resp(ids.q1);
check("time-only save keeps the answer and adds time", r.answer === "1" && r.points_earned === 2 && r.t === 8, j(r));
await alice(); await save(ids.q1, "0", 1);
r = await resp(ids.q1);
check("changing the answer re-grades it", r.answer === "0" && !r.is_correct && r.points_earned === 0 && r.t === 9, j(r));
await alice(); await save(ids.q1, "1", 0);
await alice();
await Promise.all([save(ids.q2, "0", 0), save(ids.q2, null, 4), save(ids.q2, "0", 2)]);
r = await resp(ids.q2);
check("several saves for one question all land (no lost writes)", r.answer === "0" && r.is_correct && r.points_earned === 1 && r.t === 6, j(r));
await alice(); await save(ids.q3, "0", 0);
check("question from another quiz is ignored", (await resp(ids.q3)) === undefined);
await alice(); await save(ids.q4, "1", 0);
r = await resp(ids.q4);
check("question linked through quiz_questions is graded", r?.points_earned === 3, j(r));
await alice();
err = await fails(() => save(ids.q4, "abc", 0));
r = await resp(ids.q4);
check("non-numeric MCQ answer is graded wrong, not an error", err === null && r.points_earned === 0, err ?? j(r));
await alice(); await save(ids.q4, "1", 0);

group("Locked attempt columns (problem 2)");
await alice();
await db.query(`UPDATE quiz_attempts SET score = 999, status = 'completed', completed_at = now(),
                started_at = now() + interval '1 hour' WHERE id = $1`, [ids.attempt]);
let a = await attempt();
check("student cannot set score/status/completed_at/started_at directly", a.score === 0 && a.status === "in_progress" && a.completed_at === null && a.started_at < new Date(), j(a));
await alice();
await db.query(`UPDATE quiz_attempts SET question_order = '["x"]' WHERE id = $1`, [ids.attempt]);
await asAdmin();
const qo = (await db.query(`SELECT question_order FROM quiz_attempts WHERE id = $1`, [ids.attempt])).rows[0].question_order;
check("student can no longer edit the attempt row directly (order is saved by start_exam_attempt)", j(qo) !== '["x"]', j(qo));
await alice();
const forged = (await db.query(`INSERT INTO quiz_attempts (quiz_id, user_id, student_email, status, score, completed_at, started_at)
  VALUES ($1, $2, 'alice@school.edu', 'completed', 100, now(), now() - interval '1 day') RETURNING id`, [ids.quizB, ids.alice])).rows[0].id;
a = await attempt(forged);
check("new attempt from a student always starts in_progress with score 0", a.status === "in_progress" && a.score === 0 && a.completed_at === null && Date.now() - a.started_at < 60000, j(a));

group("Submitting (items 2 and 3)");
await asAdmin();
// Forged rows, as the open INSERT policy on quiz_responses would allow
await db.query(`INSERT INTO quiz_responses (attempt_id, question_id, answer, is_correct, points_earned)
                VALUES ($1, $2, '1', true, 999)`, [ids.attempt, ids.q3]);
await db.query(`UPDATE quiz_responses SET points_earned = 500 WHERE attempt_id = $1 AND question_id = $2`, [ids.attempt, ids.q2]);
await alice();
const s1 = await submit([
  { question_id: ids.q1, answer: "" }, // browser lost its state: must not wipe the saved "1"
  { question_id: ids.q2, answer: "0" },
  { question_id: ids.q4, answer: "1" },
]);
r = await resp(ids.q1);
check("empty answer in the submit payload does not wipe a saved answer", r.answer === "1", j(r));
check("score = 2 (Q1) + 1 (Q2) + 3 (Q4) + 4 (Q5 auto-answer) = 10; forged points ignored", s1 === 10, String(s1));
check("forged row for a question outside the quiz is zeroed", (await resp(ids.q3)).points_earned === 0);
r = await resp(ids.q5);
check("skipped auto-answer question is credited with the correct choice stored", r?.answer === "2" && r.is_correct && r.points_earned === 4, j(r));
a = await attempt();
check("attempt is marked completed with the score (submit gets past the column lock)", a.status === "completed" && a.score === 10 && a.completed_at !== null, j(a));
await alice();
const s2 = await submit([{ question_id: ids.q1, answer: "0" }]);
r = await resp(ids.q1);
check("submitting again returns the stored score and changes nothing", s2 === 10 && r.answer === "1", `${s2} ${j(r)}`);
const before = (await resp(ids.q1)).t;
await alice(); await save(ids.q1, "0", 2);
r = await resp(ids.q1);
check("save after submit: answer unchanged, late time still recorded", r.answer === "1" && r.points_earned === 2 && r.t === before + 2, j(r));

group("Closed and re-opened attempts");
await asAdmin();
await db.query(`UPDATE quiz_attempts SET status = 'abandoned' WHERE id = $1`, [ids.attempt]);
await alice();
err = await fails(() => save(ids.q1, "1"));
check("abandoned attempt rejects saves", err?.includes("no longer open"), err);
err = await fails(() => submit([]));
check("abandoned attempt rejects submit", err?.includes("no longer open"), err);
await asAdmin();
await db.query(`UPDATE quiz_attempts SET status = 'in_progress' WHERE id = $1`, [ids.attempt]);
await db.query(`DELETE FROM quiz_responses WHERE attempt_id = $1 AND question_id IN ($2, $3)`, [ids.attempt, ids.q2, ids.q5]);
await alice(); await save(ids.q5, "0", 0); // wrong choice on the auto-answer question
await alice();
const s3 = await submit([{ question_id: ids.q2, answer: "" }, { question_id: ids.q3, answer: "0" }, { question_id: ids.q5, answer: "0" }]);
r = await resp(ids.q2);
check("unanswered question is stored as '' with 0 points", r?.answer === "" && r.points_earned === 0, j(r));
r = await resp(ids.q5);
check("auto-answer question is credited even when answered wrong", r.answer === "0" && r.points_earned === 4, j(r));
check("score = 2 + 0 + 3 + 4 = 9 (out-of-quiz Q3 scores 0)", s3 === 9, String(s3));

group("Question loader without the answer key (problem 3)");
// Quiz A was given a quiz_questions link for the grading tests; remove it so
// quiz A exercises the "direct questions.quiz_id" branch of the loader.
await asAdmin();
await db.query(`DELETE FROM quiz_questions WHERE quiz_id = $1`, [ids.quizA]);
await as(null, null, "anon");
const rowsA = (await db.query(`SELECT * FROM get_public_quiz_questions($1)`, [ids.quizA])).rows;
check("works for a quiz with direct questions (old version always errored)", rowsA.length === 3 && rowsA.map((x) => x.text).join() === "Q1,Q2,Q5", j(rowsA.map((x) => x.text)));
check("never returns correct_answer", rowsA.every((x) => !("correct_answer" in x)), j(Object.keys(rowsA[0])));
check("returns auto_answer and options as an array", rowsA[2].auto_answer === true && Array.isArray(rowsA[0].options), j(rowsA[2]));
const rowsB = (await db.query(`SELECT * FROM get_public_quiz_questions($1)`, [ids.quizB])).rows;
check("uses quiz_questions order when the quiz has linked questions", rowsB.map((x) => x.text).join() === "Q4,Q3", j(rowsB.map((x) => x.text)));
const rowsDraft = (await db.query(`SELECT * FROM get_public_quiz_questions($1)`, [ids.quizDraft])).rows;
check("returns nothing for an unpublished quiz", rowsDraft.length === 0, j(rowsDraft));

group("Answer-key columns hidden from logged-out users (problem 3)");
await as(null, null, "anon");
err = await fails(() => db.query(`SELECT correct_answer FROM questions`));
check("anon cannot read correct_answer", err?.includes("permission denied"), err);
err = await fails(() => db.query(`SELECT original_correct_answer, previous_correct_answer FROM questions`));
check("anon cannot read the older answer-key copies", err?.includes("permission denied"), err);
err = await fails(() => db.query(`SELECT id, quiz_id, type, text, options, points, created_at, auto_answer FROM questions`));
check("anon's exam-page column list doesn't error (rows are filtered below)", err === null, err);

group("Only staff read the questions table directly (policy follow-up)");
const visible = async (uid, role = "authenticated") => {
  await as(uid, null, role);
  try {
    return (await db.query(`SELECT id, correct_answer FROM questions`)).rows.length;
  } catch {
    return (await db.query(`SELECT id FROM questions`)).rows.length;
  }
};
let n = await visible(null, "anon");
check("logged-out visitor sees no questions", n === 0, String(n));
n = await visible(ids.alice);
check("signed-in student sees no questions, even of published quizzes", n === 0, String(n));
n = await visible(ids.pendingInstructor);
check("instructor awaiting approval sees no questions", n === 0, String(n));
n = await visible(ids.instructor);
check("approved instructor sees published + own quizzes' questions with answers", n === 6, String(n));
n = await visible(ids.admin);
check("Senior Faculty still sees questions", n === 5, String(n));
n = await visible(ids.head);
check("Department Head still sees questions", n === 5, String(n));
await as(ids.alice, "alice@school.edu");
const viaRpc = (await db.query(`SELECT * FROM get_public_quiz_questions($1)`, [ids.quizA])).rows.length;
check("student still loads the exam through get_public_quiz_questions", viaRpc === 3, String(viaRpc));
await asAdmin();
await db.query(`DELETE FROM quiz_responses WHERE attempt_id = $1`, [ids.attempt]);
await db.query(`UPDATE quiz_attempts SET status = 'in_progress' WHERE id = $1`, [ids.attempt]);
await alice(); await save(ids.q1, "1", 0);
await alice();
const s4 = await submit([{ question_id: ids.q1, answer: "1" }, { question_id: ids.q2, answer: "0" }]);
check("grading still works for the student under the new policy (2 + 1 + 4 auto)", s4 === 7, String(s4));

group("Starting an exam with one request (fewer requests)");
const start = async (quizId, sectionId = ids.sectionS, name = "Bob B") =>
  (await db.query(`SELECT start_exam_attempt($1, $2, $3) AS r`, [quizId, sectionId, name])).rows[0].r;
const saveTimes = (attemptId, times) =>
  db.query(`SELECT save_question_times($1, $2::jsonb)`, [attemptId, JSON.stringify(times)]);
const row = async (attemptId, q) => {
  await asAdmin();
  return (await db.query(`SELECT answer, points_earned, time_spent_seconds::float AS t FROM quiz_responses WHERE attempt_id = $1 AND question_id = $2`, [attemptId, q])).rows[0];
};

await as(null, null, "anon");
err = await fails(() => start(ids.quizA));
check("anon role cannot call start_exam_attempt", err?.includes("permission denied"), err);

await as(ids.bob, "bob@school.edu");
const st1 = await start(ids.quizA);
check("new attempt: status in_progress with an attempt id", st1.status === "in_progress" && !!st1.attempt_id, j(st1));
check("question order covers exactly the exam's 3 questions", [...st1.question_order].sort().join() === [ids.q1, ids.q2, ids.q5].sort().join(), j(st1.question_order));
check("fresh attempt returns no answers or times", Object.keys(st1.answers).length === 0 && Object.keys(st1.times).length === 0, j(st1));
await asAdmin();
const prof = (await db.query(`SELECT student_name, student_id, exam_code FROM student_profile WHERE student_email = 'bob@school.edu'`)).rows[0];
check("student profile created with name, id and the section's exam code", prof?.student_name === "Bob B" && prof.student_id === "bob" && prof.exam_code === "EXAM-S", j(prof));
const bobAttempt = (await db.query(`SELECT user_id, section_id, student_email, status, question_order FROM quiz_attempts WHERE id = $1`, [st1.attempt_id])).rows[0];
check("attempt stored with owner, section and saved order", bobAttempt.user_id === ids.bob && bobAttempt.section_id === ids.sectionS && j(bobAttempt.question_order) === j(st1.question_order), j(bobAttempt));

await as(ids.bob, "bob@school.edu");
await db.query(`SELECT save_quiz_response($1, $2, '1', 0)`, [st1.attempt_id, ids.q1]);
await saveTimes(st1.attempt_id, { [ids.q1]: 12.5, [ids.q2]: 3, [ids.q3]: 99, "not-a-uuid": 5, [ids.q5]: "abc" });
let r1 = await row(st1.attempt_id, ids.q1);
check("time batch adds to an answered question without touching the answer", r1.answer === "1" && r1.t === 12.5, j(r1));
r1 = await row(st1.attempt_id, ids.q2);
check("time batch creates a row for a question not answered yet", r1 && r1.answer === null && r1.t === 3, j(r1));
check("time batch ignores other quizzes' questions and bad keys/values", (await row(st1.attempt_id, ids.q3)) === undefined && (await row(st1.attempt_id, ids.q5)) === undefined);
await as(ids.bob, "bob@school.edu");
await saveTimes(st1.attempt_id, { [ids.q1]: 2.5 });
r1 = await row(st1.attempt_id, ids.q1);
check("a second batch adds on top", r1.t === 15, j(r1));

await as(ids.mallory, "mallory@school.edu");
err = await fails(() => saveTimes(st1.attempt_id, { [ids.q1]: 100 }));
check("another student cannot add time to this attempt", err?.includes("own exam attempt"), err);

await as(ids.bob, "bob@school.edu");
const st2 = await start(ids.quizA);
check("starting again resumes the same attempt and order", st2.attempt_id === st1.attempt_id && j(st2.question_order) === j(st1.question_order), j(st2));
check("resume returns saved answers and times", st2.answers[ids.q1] === "1" && Number(st2.times[ids.q1]) === 15 && Number(st2.times[ids.q2]) === 3 && !(ids.q2 in st2.answers), j(st2));
check("resume reports server time for the timer", !!st2.started_at && !!st2.server_now, j(st2));

await as(ids.bob, "bob@school.edu");
const s5 = (await db.query(`SELECT submit_quiz_attempt($1, $2::jsonb) AS s`, [st1.attempt_id, JSON.stringify([
  { question_id: ids.q1, answer: "", time_spent: 4 },
  { question_id: ids.q2, answer: "0", time_spent: 6 },
  { question_id: ids.q5, answer: "", time_spent: 0 },
])])).rows[0].s;
r1 = await row(st1.attempt_id, ids.q1);
check("submit adds unsent time and keeps the saved answer", r1.answer === "1" && r1.t === 19, j(r1));
r1 = await row(st1.attempt_id, ids.q2);
check("submit stores the answer and adds its time", r1.answer === "0" && r1.t === 9, j(r1));
check("score = 2 (Q1) + 1 (Q2) + 4 (Q5 auto-answer) = 7", s5 === 7, String(s5));

await as(ids.bob, "bob@school.edu");
await saveTimes(st1.attempt_id, { [ids.q1]: 1, [ids.q3]: 50 });
r1 = await row(st1.attempt_id, ids.q1);
check("late time batch after submit is recorded, no new rows added", r1.t === 20 && (await row(st1.attempt_id, ids.q3)) === undefined, j(r1));
await as(ids.bob, "bob@school.edu");
const st3 = await start(ids.quizA);
check("starting a submitted exam reports 'completed'", st3.status === "completed" && !st3.attempt_id, j(st3));

await as(ids.bobTwin, "bob@other.edu");
const st4 = await start(ids.quizA);
check("a clash on the student_id profile column doesn't block the exam", st4.status === "in_progress" && st4.attempt_id !== st1.attempt_id, j(st4));

await as(ids.bob, "bob@school.edu");
err = await fails(() => start(ids.quizDraft));
check("unpublished exam can't be started", err?.includes("Exam not found"), err);
await asAdmin();
await db.query(`UPDATE quizzes SET is_open = false WHERE id = $1`, [ids.quizB]);
await as(ids.bob, "bob@school.edu");
err = await fails(() => start(ids.quizB));
check("closed exam can't be started", err?.includes("closed by the instructor"), err);
await asAdmin();
await db.query(`UPDATE quizzes SET is_open = true WHERE id = $1`, [ids.quizB]);
await as(ids.bob, "bob@school.edu");
const st5 = await start(ids.quizB, null);
check("exam with linked questions: order uses quiz_questions (Q3, Q4)", [...st5.question_order].sort().join() === [ids.q3, ids.q4].sort().join(), j(st5.question_order));

group("Instructor results in one request (attempts and answers)");
const quizR = "aaaaaaaa-0000-0000-0000-0000000000r1".replace("r1", "f1");
const secR1 = "ffffffff-0000-0000-0000-0000000000a1";
const secR2 = "ffffffff-0000-0000-0000-0000000000a2";
await asAdmin();
await db.query(`INSERT INTO quizzes (id, is_published, instructor_id) VALUES ($1, true, $2)`, [quizR, ids.instructor]);
const rq = (await db.query(`INSERT INTO questions (id, quiz_id, type, text, options, correct_answer, points)
  SELECT gen_random_uuid(), $1, 'mcq', 'R' || g, ARRAY['A','B'], 'A', 1 FROM generate_series(1, 3) g RETURNING id`, [quizR])).rows.map((r) => r.id);
// 1,200 completed attempts (more than Supabase's 1,000-row page), plus 2 others
await db.query(`INSERT INTO quiz_attempts (id, quiz_id, user_id, student_email, status, score, completed_at, section_id)
  SELECT gen_random_uuid(), $1, gen_random_uuid(), 'r' || g || '@x.edu', 'completed', g % 4,
         now() - (g || ' minutes')::interval, CASE WHEN g % 2 = 0 THEN $2::uuid ELSE $3::uuid END
    FROM generate_series(1, 1200) g`, [quizR, secR1, secR2]);
await db.query(`INSERT INTO quiz_attempts (id, quiz_id, user_id, student_email, status, section_id, completed_at) VALUES
  (gen_random_uuid(), $1, gen_random_uuid(), 'open@x.edu', 'in_progress', $2, NULL),
  (gen_random_uuid(), $1, gen_random_uuid(), 'nosection@x.edu', 'completed', NULL, now() - interval '5 days')`, [quizR, secR1]);
await db.query(`INSERT INTO quiz_responses (attempt_id, question_id, answer, is_correct, points_earned, time_spent_seconds, created_at)
  SELECT a.id, q.id, CASE WHEN q.n = 3 THEN NULL ELSE (q.n % 2)::text END, q.n = 1, CASE WHEN q.n = 1 THEN 1 ELSE 0 END,
         q.n * 10 + 0.5, now() + (q.n || ' seconds')::interval
    FROM quiz_attempts a
    CROSS JOIN (SELECT id, row_number() OVER (ORDER BY text) AS n FROM questions WHERE quiz_id = $1) q
   WHERE a.quiz_id = $1 AND a.status = 'completed'`, [quizR]);

await as(ids.instructor, "inst@school.edu");
let t0 = Date.now();
const allAtt = (await db.query(`SELECT get_exam_attempts($1::uuid[]) AS r`, [[quizR]])).rows[0].r;
const attMs = Date.now() - t0;
check("returns all 1,202 attempts in one call (no 1,000-row cap)", allAtt.length === 1202, String(allAtt.length));
const doneTimes = allAtt.filter((a) => a.completed_at).map((a) => new Date(a.completed_at).getTime());
check("newest first, unfinished attempts last", doneTimes.every((t, i) => i === 0 || doneTimes[i - 1] >= t) && allAtt[allAtt.length - 1].status === "in_progress", j(allAtt.slice(-2).map((a) => a.status)));
check("each attempt is the full row (same fields as select *)", ["id", "quiz_id", "student_email", "score", "status", "completed_at", "section_id"].every((k) => k in allAtt[0]), j(Object.keys(allAtt[0])));
const doneOnly = (await db.query(`SELECT get_exam_attempts($1::uuid[], NULL, true) AS r`, [[quizR]])).rows[0].r;
check("completed only: 1,201", doneOnly.length === 1201 && doneOnly.every((a) => a.status === "completed"), String(doneOnly.length));
const sec1 = (await db.query(`SELECT get_exam_attempts($1::uuid[], $2) AS r`, [[quizR], secR1])).rows[0].r;
check("section filter keeps that section plus attempts with no section (600 + 1 open + 1 no-section)", sec1.length === 602 && sec1.every((a) => a.section_id === secR1 || a.section_id === null), String(sec1.length));

const doneIds = doneOnly.map((a) => a.id);
t0 = Date.now();
const packed = (await db.query(`SELECT get_exam_responses($1::uuid[]) AS r`, [doneIds])).rows[0].r;
const respMs = Date.now() - t0;
check("answers come back with each question listed once", packed.q.length === 3 && [...packed.q].sort().join() === [...rq].sort().join(), j(packed.q));
const totalRows = Object.values(packed.r).reduce((n, items) => n + items.length, 0);
check("all 3,603 answers of 1,201 attempts in one call", Object.keys(packed.r).length === 1201 && totalRows === 3603, `${Object.keys(packed.r).length} attempts, ${totalRows} rows`);
const one = packed.r[doneIds[0]];
const qText = (await db.query(`SELECT id, text FROM questions WHERE quiz_id = $1`, [quizR])).rows;
const textOf = (qid) => qText.find((q) => q.id === qid).text;
check("each answer keeps its fields: [question, answer, is_correct, points, seconds]",
  one.length === 3 && textOf(packed.q[one[0][0]]) === "R1" && one[0][1] === "1" && one[0][2] === true && one[0][3] === 1 && Number(one[0][4]) === 10.5,
  j(one));
check("answers stay in saved order, and an empty answer comes back as null", one.map((x) => textOf(packed.q[x[0]])).join() === "R1,R2,R3" && one[2][1] === null, j(one));
const none = (await db.query(`SELECT get_exam_responses($1::uuid[]) AS r`, [["00000000-0000-0000-0000-000000000000"]])).rows[0].r;
check("unknown attempts: empty result, not an error", j(none) === j({ q: [], r: {} }), j(none));
console.log(`        (timing on this laptop: attempts ${attMs} ms, answers ${respMs} ms)`);

await as(null, null, "anon");
err = await fails(() => db.query(`SELECT get_exam_attempts($1::uuid[])`, [[quizR]]));
check("logged-out visitors cannot call get_exam_attempts", err?.includes("permission denied"), err);
err = await fails(() => db.query(`SELECT get_exam_responses($1::uuid[])`, [doneIds.slice(0, 1)]));
check("logged-out visitors cannot call get_exam_responses", err?.includes("permission denied"), err);
const seen = async (uid, email) => {
  await as(uid, email);
  const a = (await db.query(`SELECT get_exam_attempts($1::uuid[]) AS r`, [[quizR]])).rows[0].r.length;
  const r = Object.keys((await db.query(`SELECT get_exam_responses($1::uuid[]) AS r`, [doneIds.slice(0, 5)])).rows[0].r.r).length;
  return `${a}/${r}`;
};
check("exam owner sees all attempts and answers", (await seen(ids.instructor, "inst@school.edu")) === "1202/5", await seen(ids.instructor, "inst@school.edu"));
check("Senior Faculty sees them", (await seen(ids.admin, "admin@school.edu")) === "1202/5", await seen(ids.admin, "admin@school.edu"));
check("Department Head sees them", (await seen(ids.head, "head@school.edu")) === "1202/5", await seen(ids.head, "head@school.edu"));
check("a different instructor sees nothing", (await seen(ids.pendingInstructor, "other@school.edu")) === "0/0", await seen(ids.pendingInstructor, "other@school.edu"));
check("a student sees nothing", (await seen(ids.alice, "alice@school.edu")) === "0/0", await seen(ids.alice, "alice@school.edu"));
await asAdmin();
await db.query(`UPDATE profiles SET is_approved = true WHERE id = $1`, [ids.pendingInstructor]);
check("an approved instructor who doesn't own the exam still sees nothing", (await seen(ids.pendingInstructor, "other@school.edu")) === "0/0", await seen(ids.pendingInstructor, "other@school.edu"));
await asAdmin();
await db.query(`UPDATE profiles SET is_approved = false WHERE id = $1`, [ids.pendingInstructor]);

group("Student data is protected (attempts, answers, profiles)");
const secR1Teacher = ids.sectionTeacher;
await asAdmin();
await db.query(`INSERT INTO profiles (id, is_instructor, is_approved) VALUES ($1, true, true)`, [secR1Teacher]);
await db.query(`INSERT INTO sections (id, exam_code, instructor_id) VALUES ($1, 'R1', $2), ($3, 'R2', $4)`, [secR1, secR1Teacher, secR2, ids.instructor]);
const countAs = async (uid, email, sql, params = []) => {
  await as(uid, email);
  return Number((await db.query(sql, params)).rows[0].n);
};
const attemptsOfR = `SELECT count(*) AS n FROM quiz_attempts WHERE quiz_id = '${quizR}'`;

for (const table of ["quiz_attempts", "quiz_responses", "student_profile"]) {
  await as(null, null, "anon");
  err = await fails(() => db.query(`SELECT count(*) FROM ${table}`));
  check(`logged-out visitors cannot read ${table}`, err?.includes("permission denied"), err);
}

check("exam owner sees all 1,202 attempts of their exam", (await countAs(ids.instructor, "inst@school.edu", attemptsOfR)) === 1202);
check("Senior Faculty sees them all", (await countAs(ids.admin, "admin@school.edu", attemptsOfR)) === 1202);
check("Department Head sees them all", (await countAs(ids.head, "head@school.edu", attemptsOfR)) === 1202);
let n2 = await countAs(secR1Teacher, "teacher@school.edu", attemptsOfR);
check("instructor of one section sees only that section's attempts (601) of someone else's exam", n2 === 601, String(n2));
n2 = await countAs(ids.pendingInstructor, "other@school.edu", attemptsOfR);
check("an unrelated instructor sees none", n2 === 0, String(n2));
n2 = await countAs(ids.mallory, "mallory@school.edu", `SELECT count(*) AS n FROM quiz_attempts`);
check("a student with no attempts sees none", n2 === 0, String(n2));
await as(ids.bob, "bob@school.edu");
const bobRows = (await db.query(`SELECT student_email FROM quiz_attempts`)).rows;
check("a student sees only their own attempts", bobRows.length > 0 && bobRows.every((r) => r.student_email === "bob@school.edu"), j(bobRows));

await asAdmin();
const anR1 = (await db.query(`SELECT id FROM quiz_attempts WHERE quiz_id = $1 AND section_id = $2 AND status = 'completed' LIMIT 1`, [quizR, secR1])).rows[0].id;
const anR2 = (await db.query(`SELECT id FROM quiz_attempts WHERE quiz_id = $1 AND section_id = $2 AND status = 'completed' LIMIT 1`, [quizR, secR2])).rows[0].id;
const respOf = (a) => `SELECT count(*) AS n FROM quiz_responses WHERE attempt_id = '${a}'`;
check("section instructor sees answers of their section's attempt", (await countAs(secR1Teacher, "teacher@school.edu", respOf(anR1))) === 3);
check("...but not of another section's attempt", (await countAs(secR1Teacher, "teacher@school.edu", respOf(anR2))) === 0);
check("exam owner sees the answers", (await countAs(ids.instructor, "inst@school.edu", respOf(anR2))) === 3);
check("a student cannot see other students' answers", (await countAs(ids.mallory, "mallory@school.edu", respOf(anR1))) === 0);

await as(ids.bob, "bob@school.edu");
const bobAttemptId = (await db.query(`SELECT id FROM quiz_attempts LIMIT 1`)).rows[0].id;
const upd = await db.query(`UPDATE quiz_attempts SET student_name = 'Hacked' WHERE id = $1`, [anR1]);
check("a student cannot change someone else's attempt", upd.affectedRows === 0, String(upd.affectedRows));
const updOwn = await db.query(`UPDATE quiz_attempts SET student_name = 'Renamed' WHERE id = $1`, [bobAttemptId]);
check("...or their own attempt row directly", updOwn.affectedRows === 0, String(updOwn.affectedRows));
err = await fails(() => db.query(`INSERT INTO quiz_responses (attempt_id, question_id, answer) VALUES ($1, $2, '1')`, [anR1, rq[0]]));
check("a student cannot insert answers into someone's attempt", err?.includes("row-level security") || err?.includes("permission denied"), err);
err = await fails(() => db.query(`INSERT INTO quiz_responses (attempt_id, question_id, answer) VALUES ($1, $2, '1')`, [bobAttemptId, rq[0]]));
check("...or into their own (answers go through save_quiz_response)", err?.includes("row-level security") || err?.includes("permission denied"), err);

await asAdmin();
await db.query(`INSERT INTO student_profile (student_email, student_name, student_id) VALUES ('carol@school.edu', 'Carol', 'carol')`);
await as(ids.bob, "bob@school.edu");
const bobProfiles = (await db.query(`SELECT student_email FROM student_profile`)).rows;
check("a student sees only their own profile", bobProfiles.length === 1 && bobProfiles[0].student_email === "bob@school.edu", j(bobProfiles));
await asAdmin();
const totalProfiles = Number((await db.query(`SELECT count(*) AS n FROM student_profile`)).rows[0].n);
n2 = await countAs(ids.instructor, "inst@school.edu", `SELECT count(*) AS n FROM student_profile`);
check("staff see all student profiles", totalProfiles >= 2 && n2 === totalProfiles, `${n2} of ${totalProfiles}`);
await as(ids.bob, "bob@school.edu");
err = await fails(() => db.query(`INSERT INTO student_profile (student_email, student_name) VALUES ('x@x.edu', 'X')`));
check("students cannot create or edit profiles directly", err?.includes("row-level security") || err?.includes("permission denied"), err);

const refsCount = async (uid, email) => {
  await as(uid, email);
  return (await db.query(`SELECT get_exam_attempt_refs($1::uuid[]) AS r`, [[quizR]])).rows[0].r.length;
};
check("attempt counts for exam lists: owner 1,202", (await refsCount(ids.instructor, "inst@school.edu")) === 1202);
check("...section instructor counts only their section (601)", (await refsCount(secR1Teacher, "teacher@school.edu")) === 601);
check("...students get no counts", (await refsCount(ids.bob, "bob@school.edu")) === 0);
await as(secR1Teacher, "teacher@school.edu");
const sAtt = (await db.query(`SELECT get_exam_attempts($1::uuid[]) AS r`, [[quizR]])).rows[0].r;
check("results page: section instructor sees their section's 601 attempts", sAtt.length === 601 && sAtt.every((a) => a.section_id === secR1), String(sAtt.length));
const sResp = (await db.query(`SELECT get_exam_responses($1::uuid[]) AS r`, [[anR1, anR2]])).rows[0].r;
check("...and only those attempts' answers", Object.keys(sResp.r).length === 1 && anR1 in sResp.r, j(Object.keys(sResp.r)));

await as(ids.instructor, "inst@school.edu");
const answeredQs = (await db.query(`SELECT questions_with_answers($1::uuid[]) AS r`, [[...rq, ids.q6]])).rows[0].r;
check("question bank: staff learn which questions have answers", answeredQs.length === 3 && !answeredQs.includes(ids.q6), j(answeredQs));
await as(ids.bob, "bob@school.edu");
const answeredByStudent = (await db.query(`SELECT questions_with_answers($1::uuid[]) AS r`, [rq])).rows[0].r;
check("...students learn nothing", answeredByStudent.length === 0, j(answeredByStudent));

await asAdmin();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
