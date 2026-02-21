import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../supabaseClient.js";

export const QuizResultDetail = () => {
  const { quizId, attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAttemptDetails();
  }, [quizId, attemptId]);

  const loadAttemptDetails = async () => {
    try {
      // Load attempt
      const { data: attemptData, error: attemptError } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("id", attemptId)
        .single();

      if (attemptError) throw attemptError;
      setAttempt(attemptData);

      // Load quiz
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);

      // Load questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("created_at", { ascending: true });

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Load responses
      const { data: responsesData, error: responsesError } = await supabase
        .from("quiz_responses")
        .select("*")
        .eq("attempt_id", attemptId);

      if (responsesError) throw responsesError;
      setResponses(responsesData || []);
    } catch (err) {
      setError(err.message || "Failed to load attempt details");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getResponseForQuestion = (questionId) => {
    return responses.find((r) => r.question_id === questionId);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getQuestionPoints = (questionId) => {
    const question = questions.find((q) => q.id === questionId);
    return question?.points || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">
            Loading details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto bg-authentic-white p-6">
        <button
          onClick={() => navigate(-1)}
          className="text-casual-green font-semibold mb-4 hover:underline"
        >
          ← Back
        </button>
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
  const percentage =
    totalPoints > 0 ? Math.round((attempt?.score / totalPoints) * 100) : 0;

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-casual-green font-semibold mb-4 hover:underline"
        >
          ← Back to Results
        </button>
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-3xl font-bold text-hornblende-green mb-4">
            {quiz?.title}
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Student Name</p>
              <p className="text-lg font-semibold text-gray-900">
                {attempt?.guest_name || "Authenticated User"}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Email</p>
              <p className="text-lg font-semibold text-gray-900">
                {attempt?.guest_email || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Completed</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatDate(attempt?.completed_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Score Card */}
        <div className="bg-gradient-to-r from-casual-green to-hornblende-green rounded-lg shadow-lg p-8 text-white mb-8">
          <h2 className="text-2xl font-bold mb-4">Final Score</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <p className="text-white text-opacity-90 mb-2">Points</p>
              <p className="text-4xl font-bold">
                {attempt?.score}/{totalPoints}
              </p>
            </div>
            <div>
              <p className="text-white text-opacity-90 mb-2">Percentage</p>
              <p className="text-4xl font-bold">{percentage}%</p>
            </div>
            <div>
              <p className="text-white text-opacity-90 mb-2">Status</p>
              <p className="text-2xl font-bold capitalize">{attempt?.status}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Questions and Responses */}
      <div className="space-y-6">
        {questions.map((question, idx) => {
          const response = getResponseForQuestion(question.id);
          const isCorrect = response?.is_correct;

          return (
            <div
              key={question.id}
              className="bg-white rounded-lg shadow-md p-6"
            >
              {/* Question Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Question {idx + 1}
                  </h3>
                  <p className="text-gray-700 mt-2 text-base">
                    {question.text}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Points</p>
                  <p className="text-2xl font-bold text-casual-green">
                    {response?.points_earned || 0}/{question.points || 1}
                  </p>
                </div>
              </div>

              {/* Question Details */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">Type</p>
                <p className="text-gray-900 capitalize">
                  {question.type === "mcq"
                    ? "Multiple Choice"
                    : question.type === "true_false"
                      ? "True/False"
                      : "Short Answer"}
                </p>
              </div>

              {/* MCQ Options */}
              {question.type === "mcq" && (
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    Options:
                  </p>
                  {question.options.map((option, optIdx) => {
                    const isStudentAnswer = response?.answer === String(optIdx);
                    const isCorrectAnswer = option === question.correct_answer;

                    return (
                      <div
                        key={optIdx}
                        className={`p-3 rounded-lg border-2 ${
                          isCorrectAnswer
                            ? "border-green-500 bg-green-50"
                            : isStudentAnswer
                              ? "border-red-500 bg-red-50"
                              : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`font-bold text-sm pt-0.5 ${
                              isCorrectAnswer
                                ? "text-green-700"
                                : isStudentAnswer
                                  ? "text-red-700"
                                  : "text-gray-700"
                            }`}
                          >
                            {isCorrectAnswer && "✓"}
                            {isStudentAnswer && !isCorrectAnswer && "✗"}
                          </span>
                          <div className="flex-1">
                            <p className="text-gray-900">{option}</p>
                            {isCorrectAnswer && (
                              <p className="text-xs text-green-700 mt-1">
                                Correct Answer
                              </p>
                            )}
                            {isStudentAnswer && !isCorrectAnswer && (
                              <p className="text-xs text-red-700 mt-1">
                                Student's Answer
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* True/False */}
              {question.type === "true_false" && (
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    Options:
                  </p>
                  {["True", "False"].map((option, optIdx) => {
                    const isStudentAnswer = response?.answer === String(optIdx);
                    const isCorrectAnswer =
                      (optIdx === 0 && question.correct_answer === "true") ||
                      (optIdx === 1 && question.correct_answer === "false");

                    return (
                      <div
                        key={optIdx}
                        className={`p-3 rounded-lg border-2 ${
                          isCorrectAnswer
                            ? "border-green-500 bg-green-50"
                            : isStudentAnswer
                              ? "border-red-500 bg-red-50"
                              : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`font-bold text-sm pt-0.5 ${
                              isCorrectAnswer
                                ? "text-green-700"
                                : isStudentAnswer
                                  ? "text-red-700"
                                  : "text-gray-700"
                            }`}
                          >
                            {isCorrectAnswer && "✓"}
                            {isStudentAnswer && !isCorrectAnswer && "✗"}
                          </span>
                          <div className="flex-1">
                            <p className="text-gray-900">{option}</p>
                            {isCorrectAnswer && (
                              <p className="text-xs text-green-700 mt-1">
                                Correct Answer
                              </p>
                            )}
                            {isStudentAnswer && !isCorrectAnswer && (
                              <p className="text-xs text-red-700 mt-1">
                                Student's Answer
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Short Answer */}
              {question.type === "short_answer" && (
                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Expected Answer:
                    </p>
                    <p className="p-3 bg-gray-50 rounded-lg text-gray-900">
                      {question.correct_answer}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Student's Answer:
                    </p>
                    <p className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-gray-900">
                      {response?.answer || "No answer provided"}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ℹ️ Short answer questions need to be reviewed manually.
                    </p>
                  </div>
                </div>
              )}

              {/* Result Badge */}
              {response && question.type !== "short_answer" && (
                <div
                  className={`inline-block px-4 py-2 rounded-lg font-semibold text-white ${
                    isCorrect ? "bg-green-500" : "bg-red-500"
                  }`}
                >
                  {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
