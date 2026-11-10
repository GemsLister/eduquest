// Load test for the FastAPI Bloom's taxonomy service on its own (no Supabase
// needed). Ramps up to 100 instructors each analyzing a 50-question exam.
// Works against a deployed service or one running on your machine.
//
//   k6 run -e BLOOMS_API_URL=http://localhost:8000 k6/blooms.js
//
// Options: -e VUS=100  -e QUESTIONS=50  -e THINK_MIN=5 -e THINK_MAX=15
import http from "k6/http";
import { think } from "./lib/api.js";
import { analyzeBlooms } from "./lib/instructor.js";
import { makeQuestions } from "../shared/questions.js";

const BASE = (__ENV.BLOOMS_API_URL || "").replace(/\/+$/, "");
if (!BASE) throw new Error("Set the service address: -e BLOOMS_API_URL=http://localhost:8000");

const num = (name, fallback) => (__ENV[name] !== undefined && __ENV[name] !== "" ? Number(__ENV[name]) : fallback);
const PEAK = num("VUS", 100);
const QUESTIONS = num("QUESTIONS", 50);
const THINK = [num("THINK_MIN", 5), num("THINK_MAX", 15)];
const at = (f) => Math.max(1, Math.round(PEAK * f));

export const options = {
  scenarios: {
    blooms: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "2m", target: at(0.1) },
        { duration: "3m", target: at(0.5) },
        { duration: "3m", target: PEAK },
        { duration: "5m", target: PEAK },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "3m",
    },
  },
  thresholds: {
    blooms_analyze_ok: ["rate>0.99"],
    blooms_analyze_seconds: ["p(95)<15"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function setup() {
  const res = http.get(`${BASE}/health`, { tags: { name: "blooms_health" } });
  if (res.status !== 200) throw new Error(`${BASE}/health answered ${res.status}. Is the service running?`);
  const health = res.json();
  if (!health.mlModelLoaded) {
    console.warn("The service reports mlModelLoaded=false: it is using the keyword fallback, so timings won't reflect the real model.");
  }
}

export default function () {
  const questions = makeQuestions(QUESTIONS, Math.floor(Math.random() * 100000)).map((q, i) => Object.assign({ id: `k6-${__VU}-${__ITER}-${i}` }, q));
  analyzeBlooms(BASE, `k6-${__VU}-${__ITER}`, questions);
  think(THINK);
}

