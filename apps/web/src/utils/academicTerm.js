import { supabase } from "../supabaseClient.js";

/**
 * School year and semester helpers. The rules match the database
 * (academic_term_for_date / current_academic_term in 20261027_semester_archiving.sql).
 */

/**
 * Derive semester from a date based on Philippine academic calendar.
 * June-October = 1st Semester, November-March = 2nd Semester, April-May = Summer/Midyear
 */
export const deriveSemester = (date) => {
  const month = date.getMonth(); // 0-indexed
  if (month >= 5 && month <= 9) return "1st Semester";
  if (month >= 10 || month <= 2) return "2nd Semester";
  return "Summer";
};

/**
 * Derive school year from a date based on Philippine academic calendar.
 * June onwards = currentYear - (currentYear+1), before June = (currentYear-1) - currentYear
 */
export const deriveSchoolYear = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 5) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
};

// Order semesters within a school year
const SEMESTER_ORDER = { "1st Semester": 1, "2nd Semester": 2, Summer: 3 };

export const compareTermsDesc = (a, b) =>
  (b.school_year || "").localeCompare(a.school_year || "") ||
  (SEMESTER_ORDER[b.semester] || 0) - (SEMESTER_ORDER[a.semester] || 0);

export const formatSchoolYear = (schoolYear) =>
  schoolYear ? `SY ${schoolYear.replace("-", "–")}` : "No school year";

export const formatTerm = (schoolYear, semester) =>
  [formatSchoolYear(schoolYear), semester].filter(Boolean).join(" · ");

export const isSameTerm = (a, b) =>
  Boolean(a && b) && a.school_year === b.school_year && a.semester === b.semester;

/**
 * Current term: the Department Head's Semester & School Year Override when set,
 * otherwise derived from today's date.
 */
export const getCurrentTerm = async () => {
  try {
    const { data, error } = await supabase.rpc("current_academic_term");
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row?.school_year && row?.semester) return row;
  } catch {
    // fall back to the date rule below
  }
  const now = new Date();
  return { school_year: deriveSchoolYear(now), semester: deriveSemester(now) };
};
