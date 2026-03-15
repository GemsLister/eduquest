import { useNavigate } from "react-router-dom";
import { useState } from "react";
export const QuizzesList = ({
  quizzes,
  handleDelete,
  deletingQuizId,
  handleToggleAccess,
  togglingQuizId,
}) => {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState(null);

  const copyLink = (quiz) => {
    if (!quiz.share_token) {
      alert("This quiz doesn't have a share link yet. Please publish the quiz first.");
      return;
    }
    
    const url = `${window.location.origin}/quiz/${quiz.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(quiz.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error("Failed to copy link:", err);
      alert("Failed to copy link to clipboard");
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Quizzes</h2>
      {quizzes.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Quizzes Yet
          </h3>
          <p className="text-gray-500">
            Create your first quiz for this class!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden cursor-pointer group"
            >
              <div
                className={`h-32 bg-gradient-to-r group-hover:opacity-90 transition-opacity flex items-center justify-center relative ${
                  quiz.is_published
                    ? "from-casual-green to-hornblende-green"
                    : "from-yellow-400 to-yellow-500"
                }`}
              >
                <div
                  className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold text-white ${
                    quiz.is_published ? "bg-green-600" : "bg-yellow-600"
                  }`}
                >
                  {quiz.is_published ? "Published" : "Draft"}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-800 mb-2 truncate">
                  {quiz.title}
                </h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {quiz.description || "No description"}
                </p>
                <div className="flex justify-between text-sm text-gray-500 mb-4">
                  <span>{quiz.questions_count || 0} Questions</span>
                  <span>{quiz.attempts || 0} Attempts</span>
                </div>
                {quiz.is_published && (
                  <div className="mb-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500 mb-1 font-semibold">
                      Share Link {quiz.share_token ? "" : "(Publish to generate)"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 font-mono truncate flex-1">
                        {quiz.share_token ? `${window.location.origin}/quiz/${quiz.share_token}` : "No link available"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyLink(quiz);
                        }}
                        disabled={!quiz.share_token}
                        className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
                          quiz.share_token 
                            ? "text-blue-600 hover:text-blue-800" 
                            : "text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        {copiedId === quiz.id ? "✓ Copied" : quiz.share_token ? "Copy" : "Publish"}
                      </button>
                    </div>
                  </div>
                )}
                {/* Open/Close toggle — only for published quizzes */}
                {quiz.is_published && (
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span
                      className={`text-xs font-semibold ${quiz.is_open !== false ? "text-green-700" : "text-red-600"}`}
                    >
                      {quiz.is_open !== false ? "🔓 Open" : "🔒 Closed"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAccess(quiz.id, quiz.is_open !== false);
                      }}
                      disabled={togglingQuizId === quiz.id}
                      className={`text-xs px-3 py-1 rounded font-semibold transition-colors ${
                        togglingQuizId === quiz.id
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : quiz.is_open !== false
                            ? "bg-red-100 text-red-600 hover:bg-red-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      {togglingQuizId === quiz.id
                        ? "..."
                        : quiz.is_open !== false
                          ? "Close Quiz"
                          : "Open Quiz"}
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/instructor-dashboard/instructor-quiz/${quiz.id}`,
                      )
                    }
                    className="flex-1 bg-casual-green text-white py-2 rounded text-sm font-semibold hover:bg-hornblende-green transition-colors"
                  >
                    {quiz.is_published ? "View" : "Continue"}
                  </button>
                  {quiz.is_published && (
                    <button
                      onClick={() =>
                        navigate(
                          `/instructor-dashboard/quiz-results/${quiz.id}`,
                        )
                      }
                      className="flex-1 bg-gray-200 text-gray-700 py-2 rounded text-sm font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Results
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await handleDelete(quiz.id, quiz.title);
                    }}
                    disabled={deletingQuizId === quiz.id}
                    className={`${
                      deletingQuizId === quiz.id
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-red-100 text-red-600 hover:bg-red-200"
                    } px-3 py-2 rounded text-sm font-semibold transition-colors`}
                    title="Delete quiz"
                  >
                    {deletingQuizId === quiz.id ? "..." : "🗑️"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
