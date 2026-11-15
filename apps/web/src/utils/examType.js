/**
 * Type of examination, stored in quizzes.exam_type and ticked on the TOS PDF
 * ("Type of Examination: Mid-Term / Final-Term").
 */
export const EXAM_TYPES = [
  { value: "midterm", label: "Midterm", hint: "Mid-term examination" },
  { value: "final", label: "Final Exam", hint: "Final-term examination" },
];

export const examTypeLabel = (value) => EXAM_TYPES.find((t) => t.value === value)?.label || null;

export const isExamType = (value) => EXAM_TYPES.some((t) => t.value === value);

/**
 * Runs a quizzes insert/update with `fields`; if the database has no
 * exam_type column yet, runs it again without it so saving still works.
 * `run(fields)` returns the Supabase result.
 */
export const runWithExamTypeFallback = async (fields, run) => {
  let result = await run(fields);
  if ("exam_type" in fields && isMissingExamTypeColumn(result.error)) {
    console.warn("quizzes.exam_type is missing; run migration 20261117_exam_type.sql");
    const { exam_type: _examType, ...withoutType } = fields;
    result = await run(withoutType);
  }
  return result;
};

/** The database has no quizzes.exam_type yet (migration 20261117_exam_type.sql not run). */
export const isMissingExamTypeColumn = (error) =>
  Boolean(error) &&
  (error.code === "PGRST204" || error.code === "42703") &&
  String(error.message || "").includes("exam_type");
