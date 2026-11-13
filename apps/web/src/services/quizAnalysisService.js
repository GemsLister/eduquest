/**
 * Quiz Analysis API Service
 * Handles communication with the Bloom's Taxonomy Classifier API
 */

// Set VITE_BLOOMS_API_URL when the service is deployed somewhere else
const API_URL = (import.meta.env.VITE_BLOOMS_API_URL || "http://localhost:8000").replace(/\/+$/, "");

// When many instructors analyze at once the service answers 503 "busy" with a
// Retry-After time instead of making everyone wait minutes. Retry that many times.
const MAX_BUSY_RETRIES = 5;
const MAX_RETRY_WAIT_SECONDS = 60;

/**
 * Analyze a quiz's questions using the Bloom's Taxonomy classifier
 * @param {string} quizId - The quiz ID
 * @param {Array<{id: string, text: string, choices?: string[] | null}>} questions - Array of questions to analyze (choices are option texts only, no answer key)
 * @param {{ onBusy?: (waitSeconds: number, attempt: number) => void }} [options] - onBusy is called before each automatic retry
 * @returns {Promise<Object>} Analysis results with summary and per-question breakdown
 */
export const analyzeQuiz = async (quizId, questions, { onBusy } = {}) => {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API_URL}/api/quiz/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId, questions }),
    });

    if (response.status === 503 && attempt <= MAX_BUSY_RETRIES) {
      const suggested = Number(response.headers.get("Retry-After"));
      const waitSeconds = Math.min(
        MAX_RETRY_WAIT_SECONDS,
        Number.isFinite(suggested) && suggested > 0 ? suggested : 5,
      );
      onBusy?.(waitSeconds, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
      continue;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to analyze exam.");
    }

    return response.json();
  }
};

/**
 * Forward quiz analysis results to admin for review
 * @param {string} quizId - The quiz ID
 * @param {string} instructorId - The instructor's ID
 * @param {Object} analysisResults - The analysis results from analyzeQuiz
 * @param {string} [message] - Optional message to include
 * @returns {Promise<Object>} Forward confirmation response
 */
export const forwardToAdmin = async (
  quizId,
  instructorId,
  analysisResults,
  message = "",
) => {
  const response = await fetch(`${API_URL}/api/quiz/forward-to-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quizId, instructorId, analysisResults, message }),
  });

  if (!response.ok) {
    throw new Error("Failed to forward to admin.");
  }

  return response.json();
};

/**
 * Check if the Bloom's Taxonomy API is healthy
 * @returns {Promise<boolean>} True if API is healthy
 */
export const checkApiHealth = async () => {
  try {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === "healthy";
  } catch {
    return false;
  }
};
