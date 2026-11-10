// Generates realistic exam questions spread across Bloom's levels.
// Plain JavaScript with no Node or k6 APIs, so both the seed script (Node)
// and the k6 instructor scenario can import it.

const TOPICS = [
  ["a primary key", "a foreign key"],
  ["TCP", "UDP"],
  ["an array", "a linked list"],
  ["RAM", "ROM"],
  ["a compiler", "an interpreter"],
  ["HTTP", "HTTPS"],
  ["a stack", "a queue"],
  ["encryption", "hashing"],
  ["a process", "a thread"],
  ["SQL", "NoSQL databases"],
  ["recursion", "iteration"],
  ["a router", "a switch"],
  ["unit testing", "integration testing"],
  ["agile", "waterfall development"],
  ["a class", "an object"],
];

const TEMPLATES = [
  // Remembering
  (a) => `What is ${a}?`,
  (a) => `Which of the following best defines ${a}?`,
  // Understanding
  (a, b) => `Explain the main difference between ${a} and ${b}.`,
  (a) => `Which statement best describes how ${a} works?`,
  // Applying
  (a) => `A small school system needs ${a}. Which approach should the developer use to implement it?`,
  (a) => `Given a dataset of 10,000 student records, how would you use ${a} to solve the lookup problem?`,
  // Analyzing
  (a, b) => `Analyze the relationship between ${a} and ${b} in a typical web application.`,
  (a, b) => `Compare and contrast ${a} and ${b} in terms of performance.`,
  // Evaluating
  (a, b) => `Evaluate whether ${a} or ${b} is the better choice for an online examination system, and justify your answer.`,
  (a) => `Which criticism of ${a} is the most valid?`,
  // Creating
  (a, b) => `Design a solution that combines ${a} and ${b} to handle 1,000 concurrent users.`,
  (a) => `Propose a new way to use ${a} to improve system reliability.`,
];

const DISTRACTORS = [
  "It stores data permanently on disk",
  "It improves security by hiding the source code",
  "It reduces the number of network requests",
  "It allows multiple users to share one session",
  "It is used only in legacy systems",
  "It guarantees the fastest possible performance",
  "It replaces the need for a database",
  "It runs only on the client side",
];

const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

/**
 * Build `count` questions. Roughly 1 in 6 is true/false, the rest MCQ.
 * Returned shape matches the questions table:
 *   { type, text, options, correct_answer, points }
 * (mcq: correct_answer is the option text; true_false: 'true' / 'false')
 */
export function makeQuestions(count, seed = 0) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = seed * 7919 + i;
    const [a, b] = pick(TOPICS, n * 3 + 1);
    if (i % 6 === 5) {
      out.push({
        type: "true_false",
        text: `True or false: ${a} and ${b} can always be used interchangeably. (Item ${i + 1})`,
        options: null,
        correct_answer: n % 2 === 0 ? "false" : "true",
        points: 1,
      });
      continue;
    }
    const text = `${pick(TEMPLATES, n)(a, b)} (Item ${i + 1})`;
    const correct = `The option that correctly applies ${a}`;
    const options = [correct, pick(DISTRACTORS, n), pick(DISTRACTORS, n + 3), pick(DISTRACTORS, n + 5)];
    // rotate so the correct answer is not always option A
    const shift = n % 4;
    const rotated = options.slice(shift).concat(options.slice(0, shift));
    out.push({ type: "mcq", text, options: rotated, correct_answer: correct, points: 1 });
  }
  return out;
}
