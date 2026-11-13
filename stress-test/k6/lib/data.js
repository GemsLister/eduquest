// Loads data/users.json once and shares it between all VUs (SharedArray), so
// 1,000+ VUs don't each keep their own copy in memory.
//
// The default path is resolved from this file, so it keeps working whichever
// way a k6 version resolves relative open() paths. -e DATA_FILE=... overrides it.
import { SharedArray } from "k6/data";

const DEFAULT_DATA_FILE = import.meta.resolve("../../data/users.json");

export function loadTestData(customPath) {
  const path = customPath || DEFAULT_DATA_FILE;
  const pickAccount = (a) => ({
    n: a.n,
    id: a.id,
    email: a.email,
    name: a.name,
    sectionIndex: a.sectionIndex,
    sectionId: a.sectionId,
    access_token: a.access_token,
    refresh_token: a.refresh_token,
    expires_at: a.expires_at,
  });
  const students = new SharedArray("students", () => JSON.parse(open(path)).students.map(pickAccount));
  const instructors = new SharedArray("instructors", () => JSON.parse(open(path)).instructors.map(pickAccount));
  const meta = new SharedArray("meta", () => {
    const d = JSON.parse(open(path));
    return [{
      project: { url: d.project.url, anonKey: d.project.anonKey },
      exams: d.exams,
      resultsQuizId: d.resultsExam ? d.resultsExam.quizId : null,
      resultsSectionIds: d.resultsExam && d.resultsExam.sections ? d.resultsExam.sections.map((x) => x.sectionId) : [],
      questionsPerExam: d.counts ? d.counts.questions : 50,
    }];
  })[0];
  return { students, instructors, meta };
}

/** Warn (in setup) if tokens will expire before the test ends. */
export function warnIfTokensExpire(accounts, testSeconds) {
  const now = Date.now() / 1000;
  let missing = 0;
  let expiring = 0;
  const n = Math.min(accounts.length, 50);
  for (let i = 0; i < n; i++) {
    const a = accounts[i];
    if (!a.access_token) missing++;
    else if (a.expires_at < now + testSeconds) expiring++;
  }
  if (missing) throw new Error("Some accounts have no login token. Run `npm run tokens` first.");
  if (expiring) {
    console.warn(
      `Login tokens expire before this test ends (~${Math.round(testSeconds / 60)} min). ` +
        "VUs will refresh them, but run `npm run tokens` first, or raise the access token expiry in the TEST project.",
    );
  }
}
