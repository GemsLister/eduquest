// Load tests for the FastAPI Bloom's taxonomy classifier on its own (no
// Supabase needed): "simultaneous batch AI text classification".
// Works against a deployed service or one running on your machine.
//
// Pick the test with -e MODE=...
//   levels  (default) step through concurrency levels: 1, 2, 4, 8, 16, 32, 64
//           instructors sending 50-question batches back to back, 60 s each.
//           Gives response time and throughput at each level, and where it breaks.
//   burst   100 instructors click "Analyze" at the same moment, once each.
//           How long until everyone has a result, and does anyone fail?
//   ramp    ramps 1 -> 100 instructors with 5-15 s pauses between analyses.
//   reanalyze  20 instructors each analyze their 50-question exam, then 5 times:
//           edit 5 questions and analyze again (how the feature is normally used).
//
//   k6 run -e BLOOMS_API_URL=http://localhost:8000 k6/blooms.js
//   k6 run -e BLOOMS_API_URL=http://localhost:8000 -e MODE=burst k6/blooms.js
//
// Options: -e QUESTIONS=50  -e LEVELS=1,2,4,8,16,32,64  -e STEP=60s
//          -e VUS=100 (burst / ramp)  -e TIMEOUT=300s
import http from "k6/http";
import { check } from "k6";
import { sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { think } from "./lib/api.js";
import { makeQuestions } from "../shared/questions.js";

const BASE = (__ENV.BLOOMS_API_URL || "").replace(/\/+$/, "");
if (!BASE) throw new Error("Set the service address: -e BLOOMS_API_URL=http://localhost:8000");

const MODE = (__ENV.MODE || "levels").toLowerCase();
const num = (name, fallback) => (__ENV[name] !== undefined && __ENV[name] !== "" ? Number(__ENV[name]) : fallback);
const QUESTIONS = num("QUESTIONS", 50);
const TIMEOUT = __ENV.TIMEOUT || "300s";
const LEVELS = (__ENV.LEVELS || "1,2,4,8,16,32,64").split(",").map(Number).filter((n) => n > 0);
const STEP_SECONDS = parseInt(__ENV.STEP || "60", 10);
const GAP_SECONDS = 15; // let the queue drain between levels
const PEAK = num("VUS", 100);

const batchOk = new Rate("blooms_batch_ok");
const batchSeconds = new Trend("blooms_batch_seconds");
const perQuestionMs = new Trend("blooms_ms_per_question");
const busyReplies = new Counter("blooms_busy_replies");

// Like the web app (quizAnalysisService.js): on 503 "busy", wait Retry-After
// (max 60 s) and try again, up to 5 times. Waiting time counts from the first try.
const MAX_BUSY_RETRIES = 5;

function buildScenarios() {
  if (MODE === "burst") {
    return {
      burst: { executor: "per-vu-iterations", vus: PEAK, iterations: 1, maxDuration: "15m", exec: "analyzeOnce" },
    };
  }
  if (MODE === "reanalyze") {
    return {
      reanalyze: { executor: "per-vu-iterations", vus: num("VUS", 20), iterations: 1, maxDuration: "30m", exec: "analyzeAndRevise" },
    };
  }
  if (MODE === "ramp") {
    const at = (f) => Math.max(1, Math.round(PEAK * f));
    return {
      ramp: {
        executor: "ramping-vus",
        startVUs: 1,
        stages: [
          { duration: "2m", target: at(0.1) },
          { duration: "3m", target: at(0.5) },
          { duration: "3m", target: PEAK },
          { duration: "5m", target: PEAK },
          { duration: "1m", target: 0 },
        ],
        gracefulRampDown: "5m",
        exec: "analyzeWithPause",
      },
    };
  }
  // levels: one scenario per concurrency level, one after another
  const scenarios = {};
  let start = 0;
  for (const level of LEVELS) {
    scenarios[`c${String(level).padStart(3, "0")}`] = {
      executor: "constant-vus",
      vus: level,
      duration: `${STEP_SECONDS}s`,
      startTime: `${start}s`,
      gracefulStop: TIMEOUT,
      exec: "analyzeBackToBack",
      tags: { level: String(level) },
    };
    // the next level starts after this one and its stragglers are done
    start += STEP_SECONDS + GAP_SECONDS + Math.min(300, level * 3);
  }
  return scenarios;
}

const scenarios = buildScenarios();

// A threshold per level makes k6 report each level's numbers separately.
function buildThresholds() {
  const t = {
    blooms_batch_ok: ["rate>0.99"],
    blooms_batch_seconds: ["p(95)<15"],
  };
  if (MODE === "reanalyze") {
    for (const phase of ["first", "revised"]) {
      t[`blooms_batch_seconds{phase:${phase}}`] = ["p(95)<15"];
    }
  }
  if (MODE === "levels") {
    for (const level of LEVELS) {
      t[`blooms_batch_seconds{level:${level}}`] = ["p(95)<15"];
      t[`blooms_batch_ok{level:${level}}`] = ["rate>0.99"];
    }
  }
  return t;
}

export const options = {
  scenarios,
  thresholds: buildThresholds(),
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max", "count"],
};

export function setup() {
  const res = http.get(`${BASE}/health`, { tags: { name: "blooms_health" } });
  if (res.status !== 200) throw new Error(`${BASE}/health answered ${res.status}. Is the service running?`);
  const health = res.json();
  if (!health.mlModelLoaded) {
    console.warn("The service reports mlModelLoaded=false: it is using the keyword fallback, so timings won't reflect the real model.");
  }
  console.log(`Mode ${MODE}: ${QUESTIONS} questions per batch` + (MODE === "levels" ? `, levels ${LEVELS.join(", ")} for ${STEP_SECONDS}s each` : `, ${PEAK} instructors`));
}

// A run id keeps question texts unique per run, so earlier runs can't warm the cache.
const RUN = __ENV.RUN_ID || String(Date.now());

function newQuestions(count, tag) {
  return makeQuestions(count, Math.floor(Math.random() * 1e6)).map((q, i) => ({
    id: `k6-${__VU}-${__ITER}-${tag}-${i}`,
    text: `${q.text} [${RUN}-${__VU}-${tag}-${i}]`,
    choices: q.options || null,
  }));
}

function analyze(questions = newQuestions(QUESTIONS, `b${__ITER}`), extraTags = {}) {
  const started = Date.now();
  let res;
  for (let attempt = 1; ; attempt++) {
    res = http.post(`${BASE}/api/quiz/analyze`, JSON.stringify({ quizId: `k6-${__VU}-${__ITER}`, questions }), {
      headers: { "Content-Type": "application/json" },
      tags: Object.assign({ name: "blooms_analyze" }, extraTags),
      timeout: TIMEOUT,
      responseCallback: http.expectedStatuses(200, 503),
    });
    if (res.status !== 503 || attempt > MAX_BUSY_RETRIES) break;
    busyReplies.add(1, extraTags);
    const suggested = Number(res.headers["Retry-After"]);
    sleep(Math.min(60, suggested > 0 ? suggested : 5));
  }
  let body = null;
  try {
    body = res.json();
  } catch (e) {
    body = null;
  }
  const good = check(res, {
    "Bloom's analysis returned every question": (r) => r.status === 200 && body && body.analysis && body.analysis.length === questions.length,
  });
  batchOk.add(good, extraTags);
  if (good) {
    const seconds = (Date.now() - started) / 1000;
    batchSeconds.add(seconds, extraTags);
    perQuestionMs.add((seconds * 1000) / questions.length, extraTags);
  }
  return good;
}

export function analyzeAndRevise() {
  let exam = newQuestions(QUESTIONS, "exam");
  analyze(exam, { phase: "first" });
  for (let round = 1; round <= 5; round++) {
    think([2, 5]); // editing a few questions
    const edited = newQuestions(5, `edit${round}`);
    exam = exam.slice(0, QUESTIONS - 5).concat(edited);
    // keep the edited questions spread through the exam, like real edits
    exam.sort((a, b) => (a.id < b.id ? -1 : 1));
    analyze(exam, { phase: "revised" });
  }
}

export function analyzeBackToBack() {
  analyze();
}

export function analyzeOnce() {
  analyze();
}

export function analyzeWithPause() {
  analyze();
  think([5, 15]);
}

export default analyzeBackToBack;
