// Clears what a k6 run leaves behind so the next run starts clean:
//   - attempts (and their answers) on the exam-day exams
//   - student_profile rows of the test students
//   - exams that the instructor scenario created
// The seeded accounts, sections, exams and the results-page exam are kept.
//
//   npm run reset

import { loadConfig, adminClient, readData, must, TEST_EMAIL_LIKE, INSTRUCTOR_EXAM_TITLE } from "./common.mjs";

try {
  const cfg = loadConfig();
  const data = readData(cfg);
  if (!data) throw new Error("No data/users.json yet. Run `npm run seed` first.");
  const admin = adminClient(cfg);

  const roundQuizIds = data.exams.map((e) => e.quizId);
  if (roundQuizIds.length) {
    const result = await admin.from("quiz_attempts").delete({ count: "exact" }).in("quiz_id", roundQuizIds);
    must(result, "Delete exam-day attempts");
    console.log(`Deleted exam-day attempts: ${result.count ?? "?"}`);
  }

  must(await admin.from("student_profile").delete().like("student_email", TEST_EMAIL_LIKE), "Delete test student profiles");
  console.log("Deleted test student profiles");

  const instructorIds = data.instructors.map((i) => i.id);
  const created = must(
    await admin.from("quizzes").select("id").in("instructor_id", instructorIds).like("title", `${INSTRUCTOR_EXAM_TITLE}%`),
    "Find instructor-scenario exams",
  );
  const ids = created.map((q) => q.id);
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    must(await admin.from("quiz_questions").delete().in("quiz_id", part), "Delete their question links");
    must(await admin.from("questions").delete().in("quiz_id", part), "Delete their questions");
    must(await admin.from("quizzes").delete().in("id", part), "Delete instructor-scenario exams");
  }
  console.log(`Deleted ${ids.length} exams created by the instructor scenario`);
  console.log("Ready for the next run.");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
