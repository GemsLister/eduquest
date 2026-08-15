import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { SystemActivityTimeline } from "../../components/SystemActivityTimeline";
import { QuizStatusHistory } from "../../components/QuizStatusHistory";

export const History = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("system-activity"); // "system-activity" or "quiz-history"

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, status, created_at, updated_at, is_private, sections(name)")
        .eq("instructor_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { bg: "bg-gray-100 text-gray-700", label: "Draft" },
      submitted_for_review: { bg: "bg-amber-100 text-amber-700", label: "Submitted for Review" },
      approved: { bg: "bg-emerald-100 text-emerald-700", label: "Approved" },
      rejected: { bg: "bg-red-100 text-red-700", label: "Rejected" },
      scheduled: { bg: "bg-blue-100 text-blue-700", label: "Scheduled" },
      published: { bg: "bg-green-100 text-green-700", label: "Published" },
      ongoing: { bg: "bg-purple-100 text-purple-700", label: "Ongoing" },
      completed: { bg: "bg-indigo-100 text-indigo-700", label: "Completed" },
      archived: { bg: "bg-gray-200 text-gray-600", label: "Archived" },
    };
    const c = config[status] || { bg: "bg-gray-100 text-gray-600", label: status };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  // Pagination State for Examination History by Quiz tab
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || quiz.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedQuizzes = filteredQuizzes.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-brand-navy mb-1 flex items-center gap-2">
          <span>📜</span> System Activity & Audit Trail
        </h1>
        <p className="text-slate-500 text-sm">
          Comprehensive, append-only history log tracking WHO did WHAT, WHICH ITEM was affected, WHEN, PREVIOUS/NEW STATE, and REASON.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("system-activity")}
            className={`px-5 py-3 font-extrabold text-xs tracking-wider uppercase transition-colors border-b-2 ${
              activeTab === "system-activity"
                ? "text-brand-navy border-brand-navy bg-slate-50 rounded-t-xl"
                : "text-slate-500 border-transparent hover:text-slate-800"
            }`}
          >
            ⏱️ System Activity Audit Trail
          </button>
          <button
            onClick={() => setActiveTab("quiz-history")}
            className={`px-5 py-3 font-extrabold text-xs tracking-wider uppercase transition-colors border-b-2 ${
              activeTab === "quiz-history"
                ? "text-brand-navy border-brand-navy bg-slate-50 rounded-t-xl"
                : "text-slate-500 border-transparent hover:text-slate-800"
            }`}
          >
            📋 Examination History by Quiz
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "system-activity" && <SystemActivityTimeline />}

      {activeTab === "quiz-history" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search examinations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>
              <div className="w-full sm:w-56">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted_for_review">Submitted for Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quiz List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold"></div>
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <p className="text-slate-500 font-medium text-sm">No examinations found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedQuizzes.map((quiz) => (
                <div key={quiz.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all">
                  <div
                    className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setSelectedQuiz(selectedQuiz?.id === quiz.id ? null : quiz)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-base text-brand-navy">{quiz.title}</h3>
                          {getStatusBadge(quiz.status)}
                          {quiz.is_private && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              🔒 Private
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                          <span>Created: {formatDate(quiz.created_at)}</span>
                          <span>•</span>
                          <span>Last Updated: {formatDate(quiz.updated_at)}</span>
                          {quiz.sections && (
                            <>
                              <span>•</span>
                              <span>Section: {quiz.sections.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand-indigo">
                          {selectedQuiz?.id === quiz.id ? "Hide History ▲" : "View History ▼"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedQuiz?.id === quiz.id && (
                    <div className="border-t border-slate-200 p-5 bg-slate-50/70">
                      <QuizStatusHistory quizId={quiz.id} quizTitle={quiz.title} />
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination Controls Bar */}
              {filteredQuizzes.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 text-xs font-semibold text-slate-600">
                  <span>
                    Showing <strong>{startIndex + 1}</strong>–<strong>{Math.min(startIndex + ITEMS_PER_PAGE, filteredQuizzes.length)}</strong> of <strong>{filteredQuizzes.length}</strong> examinations
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs"
                    >
                      Previous
                    </button>
                    <span className="px-3.5 py-1.5 bg-slate-100 rounded-xl text-slate-800 font-extrabold">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
