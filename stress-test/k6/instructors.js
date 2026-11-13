// 100 instructors working at the same time: each one repeatedly opens the
// results page of an exam with 1,000 takers, creates an exam with 50
// questions, and (if BLOOMS_API_URL is set) runs the Bloom's analysis on it.
//
//   k6 run k6/instructors.js
//   k6 run -e BLOOMS_API_URL=https://your-blooms-service k6/instructors.js
//
// Options: -e VUS=100  -e DURATION=15m  -e THINK_MIN=20 -e THINK_MAX=60
import exec from "k6/execution";
import { Api, think } from "./lib/api.js";
import { viewResults, createExam, analyzeBlooms } from "./lib/instructor.js";
import { loadTestData, warnIfTokensExpire } from "./lib/data.js";

const { instructors, meta } = loadTestData(__ENV.DATA_FILE);

const num = (name, fallback) => (__ENV[name] !== undefined && __ENV[name] !== "" ? Number(__ENV[name]) : fallback);
const VUS = Math.min(num("VUS", 100), instructors.length);
const THINK = [num("THINK_MIN", 20), num("THINK_MAX", 60)];
const BLOOMS_URL = __ENV.BLOOMS_API_URL || "";

export const options = {
  scenarios: {
    instructors: { executor: "constant-vus", vus: VUS, duration: __ENV.DURATION || "15m" },
  },
  thresholds: instructorThresholds(BLOOMS_URL),
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function instructorThresholds(bloomsUrl) {
  const t = {
    http_req_failed: ["rate<0.01"],
    results_page_loaded: ["rate>0.99"],
    results_page_seconds: ["p(95)<5"],
    create_exam_seconds: ["p(95)<5"],
  };
  if (bloomsUrl) {
    t.blooms_analyze_ok = ["rate>0.99"];
    t.blooms_analyze_seconds = ["p(95)<15"];
  }
  return t;
}

export function setup() {
  if (!meta.resultsQuizId) throw new Error("No results-page exam in data/users.json. Run `npm run seed` first.");
  warnIfTokensExpire(instructors, 3600);
  console.log(`${VUS} instructors` + (BLOOMS_URL ? `, Bloom's service at ${BLOOMS_URL}` : ", Bloom's analysis skipped (set BLOOMS_API_URL to include it)"));
}

let api = null;
let ownerApi = null;

// RESULTS_SCOPE=section (default): each instructor opens one class's results
// (one of the results exam's sections, ~50 students), as instructors normally
// do. RESULTS_SCOPE=all: everyone opens all 1,000 students' results at once.
const RESULTS_SCOPE = (__ENV.RESULTS_SCOPE || "section").toLowerCase();
const resultsSectionFor = (instructor) =>
  RESULTS_SCOPE === "all" || !meta.resultsSectionIds.length
    ? null
    : meta.resultsSectionIds[(instructor.n - 1) % meta.resultsSectionIds.length];

export function instructorSession() {
  const me = instructors[(exec.vu.idInTest - 1) % instructors.length];
  if (!api) api = new Api(meta.project, me);
  // The results-page exam belongs to instructor 1, so every VU opens it with
  // that account (RLS only shows attempts to the exam's owner). The session is
  // shared, so these VUs must not rotate its refresh token.
  if (!ownerApi) ownerApi = new Api(meta.project, instructors[0], { canRefresh: false });

  viewResults(ownerApi, meta.resultsQuizId, resultsSectionFor(me));
  think(THINK);

  const exam = createExam(api, me, meta.questionsPerExam);
  think(THINK);

  if (exam && BLOOMS_URL) {
    analyzeBlooms(BLOOMS_URL, exam.quizId, exam.questions);
    think(THINK);
  }
}

export default instructorSession;
