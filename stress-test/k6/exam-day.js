// The panel's objective in one test: 1,000 students take an exam while 100
// instructors create exams, check results and run Bloom's analysis.
//
//   k6 run k6/exam-day.js
//   k6 run -e BLOOMS_API_URL=https://your-blooms-service k6/exam-day.js
//
// Options: -e STUDENTS=1000 -e INSTRUCTORS=100 -e THINK_MIN=15 -e THINK_MAX=45
//          -e ARRIVAL_SECONDS=300 -e ROUND=0 -e DURATION=40m (instructor part)
// Needs at least STUDENTS + INSTRUCTORS seeded students (2,000 by default),
// because VU numbers are shared between the two groups.
import exec from "k6/execution";
import { sleep } from "k6";
import { Api, think } from "./lib/api.js";
import { takeExam } from "./lib/student.js";
import { viewResults, createExam, analyzeBlooms } from "./lib/instructor.js";
import { loadTestData, warnIfTokensExpire } from "./lib/data.js";

const { students, instructors, meta } = loadTestData(__ENV.DATA_FILE || "../data/users.json");

const num = (name, fallback) => (__ENV[name] !== undefined && __ENV[name] !== "" ? Number(__ENV[name]) : fallback);
const STUDENT_VUS = num("STUDENTS", 1000);
const INSTRUCTOR_VUS = Math.min(num("INSTRUCTORS", 100), instructors.length);
const THINK = [num("THINK_MIN", 15), num("THINK_MAX", 45)];
const READ = [num("READ_MIN", 5), num("READ_MAX", 20)];
const ARRIVAL = num("ARRIVAL_SECONDS", 300);
const ROUND = num("ROUND", 0);
const BLOOMS_URL = __ENV.BLOOMS_API_URL || "";
const examSecondsMax = READ[1] + meta.questionsPerExam * (THINK[1] + 4);
const totalMinutes = Math.ceil((ARRIVAL + examSecondsMax) / 60) + 5;

if (STUDENT_VUS + INSTRUCTOR_VUS > students.length) {
  throw new Error(`Need ${STUDENT_VUS + INSTRUCTOR_VUS} seeded students for this test, found ${students.length}. Seed more or lower STUDENTS.`);
}

export const options = {
  scenarios: {
    students: { executor: "per-vu-iterations", vus: STUDENT_VUS, iterations: 1, maxDuration: `${totalMinutes + 10}m`, exec: "student" },
    instructors: { executor: "constant-vus", vus: INSTRUCTOR_VUS, duration: __ENV.DURATION || `${totalMinutes}m`, exec: "instructor" },
  },
  thresholds: Object.assign(
    {
      http_req_failed: ["rate<0.01"],
      exam_completed: ["rate>0.99"],
      "http_req_duration{name:save_answer}": ["p(95)<500"],
      "http_req_duration{name:save_time}": ["p(95)<500"],
      "http_req_duration{name:submit_exam}": ["p(95)<2000"],
      "http_req_duration{name:load_questions}": ["p(95)<1500"],
      results_page_loaded: ["rate>0.99"],
      results_page_seconds: ["p(95)<5"],
      create_exam_seconds: ["p(95)<5"],
    },
    BLOOMS_URL ? { blooms_analyze_ok: ["rate>0.99"], blooms_analyze_seconds: ["p(95)<15"] } : {},
  ),
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function setup() {
  if (!meta.exams.length || !meta.resultsQuizId) throw new Error("Seed data incomplete. Run `npm run seed` first.");
  warnIfTokensExpire(students, totalMinutes * 60);
  warnIfTokensExpire(instructors, totalMinutes * 60);
  console.log(`Exam day: ${STUDENT_VUS} students + ${INSTRUCTOR_VUS} instructors for ~${totalMinutes} minutes` + (BLOOMS_URL ? " (with Bloom's analysis)" : ""));
}

// VU numbers are unique across both scenarios and there are more seeded
// students than VUs, so every student VU gets its own account.
let api = null;
let ownerApi = null;

export function student() {
  const me = students[(exec.vu.idInTest - 1) % students.length];
  if (!api) api = new Api(meta.project, me);
  if (ARRIVAL > 0) sleep(Math.random() * ARRIVAL);
  takeExam(api, me, meta.exams[ROUND % meta.exams.length], { read: READ, think: THINK, submitAt: null, submitJitter: 0 });
}

export function instructor() {
  const me = instructors[(exec.vu.idInTest - 1) % instructors.length];
  if (!api) api = new Api(meta.project, me);
  if (!ownerApi) ownerApi = new Api(meta.project, instructors[0], { canRefresh: false });

  viewResults(ownerApi, meta.resultsQuizId);
  think([20, 60]);
  const exam = createExam(api, me, meta.questionsPerExam);
  think([20, 60]);
  if (exam && BLOOMS_URL) {
    analyzeBlooms(BLOOMS_URL, exam.quizId, exam.questions);
    think([20, 60]);
  }
}
