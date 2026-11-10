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
  CREATE TABLE quizzes (id uuid PRIMARY KEY, is_published boolean DEFAULT false, instructor_id uuid);
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
    started_at timestamptz DEFAULT now(), completed_at timestamptz, question_order jsonb);
  CREATE TABLE quiz_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
    answer text, is_correct boolean, points_earned integer DEFAULT 0,
    time_spent_seconds numeric(12,1) NOT NULL DEFAULT 0);
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
check("student can still save question_order (used by shuffling)", j(qo) === '["x"]', j(qo));
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

await asAdmin();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
