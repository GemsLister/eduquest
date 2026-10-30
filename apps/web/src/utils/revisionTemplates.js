// Quick per-question feedback offered to every reviewer (peer reviewer,
// Senior Faculty, Department Head)
export const REVISION_TEMPLATES = [
  { label: "Rephrase for clarity", text: "Please rephrase this question for better clarity and precision." },
  { label: "Raise cognitive level", text: "Consider revising this question to a higher Bloom's level (e.g., from Remembering to Analyzing/Evaluating) for better HOTS alignment." },
  { label: "Lower cognitive level", text: "This question may be too complex for the target audience. Consider simplifying to align with LOTS objectives." },
  { label: "Review answer options", text: "The answer choices need revision — some distractors are too obvious or the correct answer is ambiguous. Please review all options." },
  { label: "Add more context", text: "This question lacks sufficient context. Add a scenario or more specific details so students can answer accurately." },
  { label: "Fix grammatical errors", text: "This question has grammatical or spelling errors. Please proofread and correct before submission." },
];

/** Adds a template to feedback already typed, on a new line, without repeating it. */
export const appendTemplate = (existing, text) => {
  const current = (existing || "").trim();
  if (current.includes(text)) return current;
  return current ? `${current}\n${text}` : text;
};
