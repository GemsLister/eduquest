/**
 * Quiz Analysis API Service
 * Handles communication with the Bloom's Taxonomy Classifier API
 */

const API_URL = "http://localhost:8000";

/**
 * Analyze a quiz's questions using the Bloom's Taxonomy classifier
 * @param {string} quizId - The quiz ID
 * @param {Array<{id: string, text: string}>} questions - Array of questions to analyze
 * @returns {Promise<Object>} Analysis results with summary and per-question breakdown
 */
export const analyzeQuiz = async (quizId, questions) => {
  const response = await fetch(`${API_URL}/api/quiz/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quizId, questions }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to analyze quiz.");
  }

  return response.json();
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
