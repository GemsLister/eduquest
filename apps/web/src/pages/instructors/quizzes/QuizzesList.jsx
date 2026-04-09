import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";

export const QuizzesList = ({
  quizzes,
  handleArchive,
  archivingQuizId,
  handleToggleAccess,
  togglingQuizId,
}) => {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const [copiedId, setCopiedId] = useState(null);

  const buildShareUrl = (quiz) => {
    if (!quiz.share_token) return "";
    const base = `${window.location.origin}/quiz/${quiz.share_token}`;
    return sectionId ? `${base}?section=${sectionId}` : base;
  };

  const copyLink = (quiz) => {
    if (!quiz.share_token) {
      alert(
        "This quiz doesn't have a share link yet. Please publish the quiz first.",
      );
      return;
    }

    const url = buildShareUrl(quiz);
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedId(quiz.id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy link:", err);
        alert("Failed to copy link to clipboard");
      });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
            Go to the Quizzes page to create and assign quizzes to this subject.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quizzes.map((quiz) => {
            const isOpen = quiz.is_open !== false;
            const duration = formatDuration(quiz.duration);

            return (
              <div
                key={quiz.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
              >
                {/* Card Header — compact with title inside */}
                <div
                  className={`px-5 py-4 relative ${
                    quiz.is_published
                      ? "bg-gradient-to-r from-brand-navy to-brand-indigo"
                      : "bg-gradient-to-r from-yellow-400 to-yellow-500"
                  }`}
                >
                  {/* Status badges — top right */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {quiz.is_published && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isOpen
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {isOpen ? "Open" : "Closed"}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
                        quiz.is_published ? "bg-white/25" : "bg-yellow-700/40"
                      }`}
                    >
                      {quiz.is_published ? "Published" : "Draft"}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-white pr-24 leading-snug line-clamp-2">
                    {quiz.title?.replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "")}
                  </h3>
                  {quiz.description && (
                    <p className="text-white/70 text-xs mt-1 line-clamp-1">
                      {quiz.description}
                    </p>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col gap-3">
                  {/* Stats Row */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-semibold text-gray-700">{quiz.questions_count || 0}</span>
                      <span>Questions</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-semibold text-gray-700">{quiz.attempts || 0}</span>
                      <span>Attempts</span>
                    </div>
                    {duration && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold text-gray-700">{duration}</span>
                      </div>
                    )}
                  </div>

                  {/* Share Link */}
                  {quiz.is_published && quiz.share_token && (
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="text-xs text-gray-500 font-mono truncate flex-1">
                        {buildShareUrl(quiz)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyLink(quiz);
                        }}
                        className={`shrink-0 p-1 rounded transition-colors ${
                          copiedId === quiz.id
                            ? "text-green-600"
                            : "text-gray-400 hover:text-gray-700 hover:bg-gray-200"
                        }`}
                        title={copiedId === quiz.id ? "Copied!" : "Copy link"}
                      >
                        {copiedId === quiz.id ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Toggle Switch — only for published quizzes */}
                  {quiz.is_published && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-gray-500">
                        Student Access
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleAccess(quiz.id, isOpen);
                        }}
                        disabled={togglingQuizId === quiz.id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                          togglingQuizId === quiz.id
                            ? "bg-gray-300 cursor-not-allowed"
                            : isOpen
                              ? "bg-green-500"
                              : "bg-gray-300"
                        }`}
                        title={isOpen ? "Click to close quiz" : "Click to open quiz"}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                            isOpen ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
                    <button
                      onClick={() =>
                        navigate(
                          `/instructor-dashboard/instructor-quiz/${quiz.id}`,
                        )
                      }
                      className="flex-1 bg-brand-gold text-brand-navy py-2 rounded-lg text-sm font-semibold hover:bg-brand-gold-dark transition-colors"
                    >
                      {quiz.is_published ? "View" : "Continue"}
                    </button>
                    {quiz.is_published && (
                      <button
                        onClick={() =>
                          navigate(
                            sectionId
                              ? `/instructor-dashboard/quiz-results/${quiz.id}?section=${sectionId}`
                              : `/instructor-dashboard/quiz-results/${quiz.id}`,
                          )
                        }
                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                      >
                        Results
                      </button>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await handleArchive(quiz.id, quiz.title);
                      }}
                      disabled={archivingQuizId === quiz.id}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                        archivingQuizId === quiz.id
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-red-50 text-red-500 hover:bg-red-100 border border-red-200"
                      }`}
                      title="Archive this quiz"
                    >
                      {archivingQuizId === quiz.id ? (
                        "..."
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          <span className="hidden sm:inline">Archive</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
