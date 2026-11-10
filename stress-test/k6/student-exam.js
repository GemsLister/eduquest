// Students taking exams. Pick the test with -e SCENARIO=...
//
//   load    1,000 students arrive over 5 minutes and take a 50-question exam at
//           a realistic pace (15-45 s per question, ~25 minutes).
//   spike   1,000 students start within 30 seconds, answer quickly, and all
//           submit in the same second (the exam timer running out).
//   stress  ramps from 0 up to every seeded student (2,000 by default) with fast
//           answering, to find where the system starts to fail.
//   soak    400 students for 2 hours, back to back exams, to catch slowdowns
//           that only show up over time.
//
// Options (all optional): -e VUS=...  -e THINK_MIN=... -e THINK_MAX=...
//   -e READ_MIN=... -e READ_MAX=... (seconds spent reading the instructions)
//   -e ARRIVAL_SECONDS=...  -e DURATION=2h (soak)  -e ROUND=0 (which seeded exam)
//   -e SUBMIT_JITTER=0 (spike: spread submits over N seconds)
//
//   k6 run -e SCENARIO=load k6/student-exam.js
import exec from "k6/execution";
import { sleep } from "k6";
import { Api } from "./lib/api.js";
import { takeExam } from "./lib/student.js";
import { loadTestData, warnIfTokensExpire } from "./lib/data.js";

const { students, meta } = loadTestData(__ENV.DATA_FILE || "../data/users.json");

const SCENARIO = (__ENV.SCENARIO || "load").toLowerCase();
const PROFILES = {
  load: { vus: 1000, think: [15, 45], read: [5, 20], arrival: 300 },
  spike: { vus: 1000, think: [2, 6], read: [2, 5], arrival: 30, syncSubmit: true },
  stress: { vus: students.length, think: [1, 4], read: [1, 3], arrival: 0 },
  soak: { vus: 400, think: [10, 30], read: [5, 15], arrival: 120 },
};
const base = PROFILES[SCENARIO];
if (!base) throw new Error(`Unknown SCENARIO "${SCENARIO}". Use load, spike, stress or soak.`);

const num = (name, fallback) => (__ENV[name] !== undefined && __ENV[name] !== "" ? Number(__ENV[name]) : fallback);
const P = {
  vus: Math.min(num("VUS", base.vus), students.length),
  think: [num("THINK_MIN", base.think[0]), num("THINK_MAX", base.think[1])],
  read: [num("READ_MIN", base.read[0]), num("READ_MAX", base.read[1])],
  arrival: num("ARRIVAL_SECONDS", base.arrival),
  round: num("ROUND", 0),
  submitJitter: num("SUBMIT_JITTER", 0),
  syncSubmit: !!base.syncSubmit,
};
const questions = meta.questionsPerExam;
// Longest time one student needs for one exam at this pace.
const examSecondsMax = P.read[1] + questions * (P.think[1] + 4);
// spike: when everyone submits together
const deadlineSeconds = P.arrival + examSecondsMax + 30;

/** "2h", "90m", "45s", "1h30m" -> seconds */
function durationSeconds(text) {
  let total = 0;
  const re = /(\d+(?:\.\d+)?)(h|m|s)/g;
  let m;
  while ((m = re.exec(text))) total += Number(m[1]) * { h: 3600, m: 60, s: 1 }[m[2]];
  return total || 7200;
}

function scenarioConfig() {
  if (SCENARIO === "stress") {
    const peak = P.vus;
    const at = (f) => Math.max(1, Math.round(peak * f));
    return {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: at(0.1) },
        { duration: "3m", target: at(0.25) },
        { duration: "4m", target: at(0.5) },
        { duration: "4m", target: at(0.75) },
        { duration: "4m", target: peak },
        { duration: "3m", target: peak },
        { duration: "2m", target: 0 },
      ],
      gracefulRampDown: "2m",
    };
  }
  if (SCENARIO === "soak") {
    return { executor: "constant-vus", vus: P.vus, duration: __ENV.DURATION || "2h" };
  }
  // load / spike: every VU is one student taking one exam
  const maxSeconds = (P.syncSubmit ? deadlineSeconds + P.submitJitter : P.arrival + examSecondsMax) + 600;
  return { executor: "per-vu-iterations", vus: P.vus, iterations: 1, maxDuration: `${Math.ceil(maxSeconds / 60)}m` };
}

export const options = {
  scenarios: { [SCENARIO]: scenarioConfig() },
  thresholds: {
    // what "passing" means for this system (shown as pass/fail in the summary)
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    exam_completed: ["rate>0.99"],
    "http_req_duration{name:save_answer}": ["p(95)<500"],
    "http_req_duration{name:save_time}": ["p(95)<500"],
    "http_req_duration{name:submit_exam}": ["p(95)<2000"],
    "http_req_duration{name:open_exam_link}": ["p(95)<1500"],
    "http_req_duration{name:load_questions}": ["p(95)<1500"],
    "http_req_duration{name:create_attempt}": ["p(95)<1500"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function setup() {
  if (!meta.exams.length) throw new Error("No seeded exams found. Run `npm run seed` first.");
  const seconds = SCENARIO === "soak" ? durationSeconds(__ENV.DURATION || "2h") : SCENARIO === "stress" ? 30 * 60 : deadlineSeconds + 600;
  warnIfTokensExpire(students, seconds);
  console.log(`Scenario ${SCENARIO}: ${P.vus} students, ${P.think[0]}-${P.think[1]} s per question, ${questions} questions per exam`);
  if (P.syncSubmit) console.log(`All submits happen ${Math.round(deadlineSeconds)} s after the start (+ up to ${P.submitJitter} s jitter)`);
  return { startedAt: Date.now() };
}

// Each VU is always the same student, so no two VUs share an account.
const student = () => students[(exec.vu.idInTest - 1) % students.length];
let api = null;

export default function (setupData) {
  const me = student();
  if (!api) api = new Api(meta.project, me);

  const iteration = exec.vu.iterationInScenario;
  if (iteration === 0 && P.arrival > 0) sleep(Math.random() * P.arrival);

  // stress / soak: each new exam this VU takes is the next seeded round
  const exam = meta.exams[(P.round + iteration) % meta.exams.length];
  const result = takeExam(api, me, exam, {
    read: P.read,
    think: P.think,
    submitAt: P.syncSubmit ? setupData.startedAt + deadlineSeconds * 1000 : null,
    submitJitter: P.submitJitter,
  });

  if (result === "failed") {
    // A real student would wait before trying again; without this pause one
    // broken account retries thousands of times a second and swamps the results.
    sleep(10);
  } else if (result === "already_taken") {
    // Left over from an earlier run (run `npm run reset` between tests), or this
    // student has taken every seeded exam. Don't spin in a tight loop.
    sleep(iteration + 1 >= meta.exams.length ? 60 : 5);
  }
}
