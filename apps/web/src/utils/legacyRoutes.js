/**
 * Exam pages used to live under "quiz" URLs. Old links still exist in saved
 * notifications, bookmarks and exam links already shared with students, so
 * they are mapped to the new paths instead of breaking.
 */
const SEGMENTS = {
  quizzes: "exams",
  "instructor-quiz": "instructor-exam",
  "create-quiz": "create-exam",
  "quiz-results": "exam-results",
  "quiz-reviews": "exam-reviews",
  "quiz-approvals": "exam-approvals",
};

const SEGMENT_PATTERN = new RegExp(`/(${Object.keys(SEGMENTS).join("|")})(?=[/?#]|$)`, "g");

export const toExamPath = (path) =>
  typeof path === "string"
    ? path
        .replace(/^\/quiz\//, "/exam/")
        .replace(SEGMENT_PATTERN, (_m, segment) => `/${SEGMENTS[segment]}`)
    : path;
