// Confirms the TEST project is ready: it is not production, the EduQuest
// schema is there, and the hardened exam functions (2026-11-11 migrations)
// are installed.
//
//   npm run check

import { pathToFileURL } from "node:url";
import { loadConfig, adminClient, readData } from "./common.mjs";

const ZERO = "00000000-0000-0000-0000-000000000000";

export async function checkProject(cfg) {
  const admin = adminClient(cfg);
  const problems = [];

  for (const table of ["profiles", "quizzes", "questions", "quiz_questions", "quiz_sections", "sections", "quiz_attempts", "quiz_responses", "student_profile"]) {
    const { error } = await admin.from(table).select("*", { head: true, count: "exact" }).limit(1);
    if (error) problems.push(`table ${table}: ${error.message}`);
  }

  // The new save_quiz_response refuses callers with no signed-in user; the old one didn't.
  const save = await admin.rpc("save_quiz_response", {
    p_attempt_id: ZERO, p_question_id: ZERO, p_answer: null, p_time_spent: 0,
  });
  if (!save.error) {
    problems.push("save_quiz_response is the OLD version (no sign-in check). The schema copy is older than the 2026-11-11 migrations.");
  } else if (!/signed in/i.test(save.error.message)) {
    problems.push(`save_quiz_response: ${save.error.message}`);
  }

  const loader = await admin.rpc("get_public_quiz_questions", { p_quiz_id: ZERO });
  if (loader.error) problems.push(`get_public_quiz_questions: ${loader.error.message}`);

  const staff = await admin.rpc("is_exam_staff");
  if (staff.error) problems.push(`is_exam_staff (staff-only questions policy): ${staff.error.message}`);

  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const cfg = loadConfig();
    console.log(`Test project: ${cfg.url}`);
    const problems = await checkProject(cfg);
    if (problems.length) {
      console.log("\nNot ready:");
      for (const p of problems) console.log(`  - ${p}`);
      console.log("\nCopy the production schema into the test project first (README step 2).");
      process.exit(1);
    }
    console.log("Schema and exam functions look right.");
    const data = readData(cfg);
    if (data) {
      const now = Date.now() / 1000;
      const valid = [...data.students, ...data.instructors].filter((a) => a.expires_at > now + 3600).length;
      console.log(`Seeded: ${data.students.length} students, ${data.instructors.length} instructors, ${data.exams.length} exams.`);
      console.log(`Tokens valid for 1h+: ${valid}/${data.students.length + data.instructors.length}` + (valid < data.students.length + data.instructors.length ? "  -> run `npm run tokens`" : ""));
    } else {
      console.log("Not seeded yet -> run `npm run seed`.");
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
