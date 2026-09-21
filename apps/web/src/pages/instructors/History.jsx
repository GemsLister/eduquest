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
      draft: { bg: "bg-slate-100 text-slate-700 border border-slate-200", label: "Draft" },
      submitted_for_review: { bg: "bg-amber-50 text-amber-700 border border-amber-200", label: "Submitted for Review" },
      approved: { bg: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Approved" },
      rejected: { bg: "bg-rose-50 text-rose-700 border border-rose-200", label: "Rejected" },
      scheduled: { bg: "bg-sky-50 text-sky-700 border border-sky-200", label: "Scheduled" },
      published: { bg: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Published" },
      ongoing: { bg: "bg-purple-50 text-purple-700 border border-purple-200", label: "Ongoing" },
      completed: { bg: "bg-indigo-50 text-indigo-700 border border-indigo-200", label: "Completed" },
      archived: { bg: "bg-slate-100 text-slate-600 border border-slate-200", label: "Archived" },
    };
    const c = config[status] || { bg: "bg-slate-100 text-slate-600 border border-slate-200", label: status };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${c.bg}`}>
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
    <div className="flex-1 overflow-auto bg-authentic-white min-h-screen">
      {/* Signature Top Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8 shadow-xs border-b border-white/10 mb-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-xs font-bold tracking-widest uppercase mb-1">
              INSTRUCTOR DASHBOARD
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Activity History & Audit Trail
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Comprehensive audit log tracking system actions, examination revisions, review status transitions, and audit reasons
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8 space-y-6">
        {/* Tabs Bar */}
        <div className="inline-flex p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 gap-1.5 shadow-2xs">
          <button
            onClick={() => setActiveTab("system-activity")}
            className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs tracking-wider uppercase rounded-xl transition-all ${
              activeTab === "system-activity"
                ? "bg-brand-navy text-white shadow-xs"
                : "text-slate-600 hover:text-brand-navy hover:bg-white/60"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>System Activity Audit Trail</span>
          </button>
          <button
            onClick={() => setActiveTab("quiz-history")}
            className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs tracking-wider uppercase rounded-xl transition-all ${
              activeTab === "quiz-history"
                ? "bg-brand-navy text-white shadow-xs"
                : "text-slate-600 hover:text-brand-navy hover:bg-white/60"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Examination History by Quiz</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "system-activity" && <SystemActivityTimeline />}

        {activeTab === "quiz-history" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search examinations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 bg-white text-slate-800 shadow-2xs transition-all placeholder:text-slate-400"
                  />
                </div>
                <div className="w-full sm:w-64">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 bg-white shadow-2xs transition-all"
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
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 text-center">
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Private
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
                        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-navy bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-all shadow-2xs">
                          <span>{selectedQuiz?.id === quiz.id ? "Hide History" : "View History"}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${selectedQuiz?.id === quiz.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
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
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all shadow-2xs"
                      >
                        Previous
                      </button>
                      <span className="px-3.5 py-1.5 bg-brand-navy text-white rounded-xl font-bold shadow-xs">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all shadow-2xs"
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
    </div>
  );
};
