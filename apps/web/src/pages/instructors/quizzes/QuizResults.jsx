import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../supabaseClient.js";

export const QuizResults = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadQuizAndAttempts();
  }, [quizId]);

  const loadQuizAndAttempts = async () => {
    try {
      // Load quiz details
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);

      // Load all attempts for this quiz
      const { data: attemptsData, error: attemptsError } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("quiz_id", quizId)
        .order("completed_at", { ascending: false, nullsFirst: false });

      if (attemptsError) throw attemptsError;
      setAttempts(attemptsData || []);
    } catch (err) {
      setError(err.message || "Failed to load results");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStudentName = (attempt) => {
    return attempt.student_name || "Authenticated User";
  };

  const getStudentEmail = (attempt) => {
    return attempt.student_email || "N/A";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "In Progress";
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (attempt) => {
    const statusClass = {
      completed: "bg-green-100 text-green-800",
      in_progress: "bg-yellow-100 text-yellow-800",
      abandoned: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-semibold ${statusClass[attempt.status]}`}
      >
        {attempt.status.charAt(0).toUpperCase() + attempt.status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">
            Loading results...
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

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-casual-green font-semibold mb-4 hover:underline"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-3xl font-bold text-hornblende-green mb-2">
            Quiz Results: {quiz?.title}
          </h1>
          <p className="text-gray-600">
            {attempts.length} {attempts.length === 1 ? "attempt" : "attempts"}{" "}
            recorded
          </p>
        </div>
      </div>

      {/* Results Table */}
      {attempts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            No Attempts Yet
          </h2>
          <p className="text-gray-600">
            Students haven't taken this quiz yet. Share the quiz link with them
            to get started!
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-casual-green text-white">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">
                  Student Name
                </th>
                <th className="px-6 py-4 text-left font-semibold">Email</th>
                <th className="px-6 py-4 text-center font-semibold">Score</th>
                <th className="px-6 py-4 text-center font-semibold">Status</th>
                <th className="px-6 py-4 text-left font-semibold">Completed</th>
                <th className="px-6 py-4 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attempts.map((attempt) => (
                <tr
                  key={attempt.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {getStudentName(attempt)}
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {getStudentEmail(attempt)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-bold">
                      {attempt.score || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(attempt)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {formatDate(attempt.completed_at)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {attempt.status === "completed" && (
                      <button
                        onClick={() =>
                          navigate(
                            `/instructor-dashboard/quiz-results/${quizId}/attempt/${attempt.id}`,
                          )
                        }
                        className="bg-casual-green hover:bg-hornblende-green text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                      >
                        View Details
                      </button>
                    )}
                    {attempt.status !== "completed" && (
                      <span className="text-gray-500 text-sm">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Stats */}
      {attempts.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm font-semibold mb-2">
              Total Attempts
            </p>
            <p className="text-3xl font-bold text-hornblende-green">
              {attempts.length}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm font-semibold mb-2">
              Completed
            </p>
            <p className="text-3xl font-bold text-green-600">
              {attempts.filter((a) => a.status === "completed").length}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm font-semibold mb-2">
              Average Score
            </p>
            <p className="text-3xl font-bold text-blue-600">
              {(() => {
                const completedAttempts = attempts.filter(
                  (a) => a.status === "completed",
                );
                if (completedAttempts.length === 0) return 0;
                const total = completedAttempts.reduce(
                  (sum, a) => sum + (a.score || 0),
                  0,
                );
                return Math.round(total / completedAttempts.length);
              })()}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-sm font-semibold mb-2">
              Highest Score
            </p>
            <p className="text-3xl font-bold text-purple-600">
              {Math.max(
                0,
                ...attempts
                  .filter((a) => a.status === "completed")
                  .map((a) => a.score || 0),
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
