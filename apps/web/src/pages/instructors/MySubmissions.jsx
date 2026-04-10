import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { BloomsVisualizationPanel } from "../../components/BloomsVisualization";
import { QuizSuggestions } from "../../components/QuizSuggestions";
import { exportBloomsPdf } from "../../utils/exportBloomsPdf";
import { exportQuizPaperPdf } from "../../utils/exportQuizPaperPdf";
import { createRevisionCopy } from "../../services/createRevisionCopy";
import { notify } from "../../utils/notify.jsx";

const ITEMS_PER_PAGE = 5;

export const MySubmissions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [instructorName, setInstructorName] = useState(null);
  const [creatingRevisionFor, setCreatingRevisionFor] = useState(null);

  useEffect(() => {
    loadSubmissions();
  }, [filter]);

  const loadSubmissions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch instructor's own profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, username")
        .eq("id", user.id)
        .single();
      if (profile) {
        const name =
          `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
          profile.username ||
          profile.email;
        setInstructorName(name);
      }

      let query = supabase
        .from("quiz_analysis_submissions")
        .select("*, quizzes(*)")
        .eq("instructor_id", user.id)
        .order("created_at", { ascending: false });

      if (filter === "pending") {
        query = query.in("status", ["pending", "faculty_head_review"]);
      } else if (filter === "approved") {
        query = query.in("status", ["approved", "faculty_head_approved"]);
      } else if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch section data and check for newer versions for each submission
      const enriched = await Promise.all(
        (data || []).map(async (sub) => {
          if (!sub.quiz_id) return sub;
          const { data: qs } = await supabase
            .from("quiz_sections")
            .select("section_id, sections(name, subject_code)")
            .eq("quiz_id", sub.quiz_id)
            .limit(1)
            .maybeSingle();

          // Check if a newer version exists in the chain
          let hasNewerVersion = false;
          const quiz = sub.quizzes;
          if (quiz) {
            const rootId = quiz.parent_quiz_id || sub.quiz_id;
            const { data: newer } = await supabase
              .from("quizzes")
              .select("id")
              .eq("parent_quiz_id", rootId)
              .eq("is_archived", false)
              .gt("version_number", quiz.version_number || 1)
              .limit(1);
            hasNewerVersion = newer && newer.length > 0;
          }

          return { ...sub, section: qs?.sections || null, hasNewerVersion };
        }),
      );

      setSubmissions(enriched);
    } catch (err) {
      console.error("Error loading submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
      approved: "bg-green-100 text-green-700 border-green-300",
      revision_requested: "bg-orange-100 text-orange-700 border-orange-300",
      faculty_head_review: "bg-blue-100 text-blue-700 border-blue-300",
      faculty_head_approved: "bg-green-100 text-green-700 border-green-300",
    };
    const labels = {
      pending: "Pending Review",
      approved: "Approved",
      revision_requested: "Revision Requested",
      faculty_head_review: "Awaiting Department Head",
      faculty_head_approved: "Approved by Department Head",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  const getStatusIcon = (status) => {
    const base =
      "w-8 h-8 rounded-full flex items-center justify-center shrink-0";
    switch (status) {
      case "pending":
        return (
          <span className={`${base} bg-brand-gold/15`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-brand-gold-dark"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
        );
      case "approved":
        return (
          <span className={`${base} bg-green-100`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </span>
        );
      case "revision_requested":
        return (
          <span className={`${base} bg-amber-100`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </span>
        );
      case "faculty_head_review":
        return (
          <span className={`${base} bg-blue-100`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
        );
      case "faculty_head_approved":
        return (
          <span className={`${base} bg-green-100`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </span>
        );
      default:
        return (
          <span className={`${base} bg-gray-100`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </span>
        );
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const normalizeQuestionText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const totalPages = Math.ceil(submissions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedSubmissions = submissions.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    } else if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-brand-navy px-6 py-8">
        <h1 className="text-2xl md:text-3xl font-black text-white">
          Quiz Analysis Submissions
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Track the status of your forwarded quiz analysis
        </p>
      </div>

      <div className="p-6">
        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "approved", label: "Approved" },
            { key: "revision_requested", label: "Needs Revision" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap text-sm ${
                filter === tab.key
                  ? "bg-brand-navy text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-brand-navy/10 rounded-2xl flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-brand-navy/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Submissions Found
            </h3>
            <p className="text-gray-500">
              {filter === "all"
                ? "You haven't submitted any quiz analyses yet. Analyze a quiz and forward it to the Senior Faculty for review."
                : "No submissions match the selected filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex flex-col gap-4">
                  {/* Title and Status */}
                  <div className="flex items-center gap-3">
                    {getStatusIcon(submission.status)}
                    <h3 className="text-lg font-bold text-gray-800 flex-1 flex items-center gap-2">
                      {(submission.quizzes?.title || "Unknown Quiz").replace(
                        /\s*\(Revised(?:\s+\d+)?\)\s*$/,
                        "",
                      )}
                      {(submission.quizzes?.version_number || 0) > 1 && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-full text-[10px] font-bold">
                          V{submission.quizzes.version_number}
                        </span>
                      )}
                    </h3>
                    {getStatusBadge(submission.status)}
                  </div>

                  {/* Quick Stats */}
                  {submission.analysis_results?.summary && (
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-gray-500">Questions:</span>
                        <span className="font-bold text-gray-800">
                          {submission.analysis_results.summary.totalQuestions}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-emerald-500">LOTS:</span>
                        <span className="font-bold text-emerald-600">
                          {submission.analysis_results.summary.lotsCount} (
                          {submission.analysis_results.summary.lotsPercentage}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-amber-500">HOTS:</span>
                        <span className="font-bold text-amber-600">
                          {submission.analysis_results.summary.hotsCount} (
                          {submission.analysis_results.summary.hotsPercentage}%)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Instructor Message */}
                  {submission.instructor_message && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-600 mb-1">
                        Your Note:
                      </p>
                      <p className="text-sm text-blue-800">
                        {submission.instructor_message}
                      </p>
                    </div>
                  )}

                  {/* Senior Faculty Overall Feedback */}
                  {submission.admin_feedback && (
                    <div
                      className={`p-3 rounded-lg border ${
                        submission.status === "approved"
                          ? "bg-green-50 border-green-200"
                          : "bg-orange-50 border-orange-200"
                      }`}
                    >
                      <p
                        className={`text-xs font-semibold mb-1 ${
                          submission.status === "approved"
                            ? "text-green-600"
                            : "text-orange-600"
                        }`}
                      >
                        Overall Senior Faculty Feedback:
                      </p>
                      <p
                        className={`text-sm ${
                          submission.status === "approved"
                            ? "text-green-800"
                            : "text-orange-800"
                        }`}
                      >
                        {submission.admin_feedback}
                      </p>
                    </div>
                  )}

                  {/* Per-Question Feedback Summary */}
                  {submission.question_feedback &&
                    Object.keys(submission.question_feedback).length > 0 && (
                      <div className="p-3 rounded-lg border bg-orange-50 border-orange-200">
                        <p className="text-xs font-semibold text-orange-600 mb-2">
                          Question-Specific Feedback (
                          {Object.keys(submission.question_feedback).length}{" "}
                          question
                          {Object.keys(submission.question_feedback).length > 1
                            ? "s"
                            : ""}
                          ):
                        </p>
                        <div className="space-y-2">
                          {submission.analysis_results?.analysis?.map(
                            (item, idx) => {
                              const fb =
                                submission.question_feedback[item.questionId];
                              if (!fb) return null;
                              return (
                                <div
                                  key={item.questionId}
                                  className="p-2 bg-white rounded border border-orange-100"
                                >
                                  <p className="text-xs font-bold text-gray-500 mb-0.5">
                                    Q{idx + 1}:{" "}
                                    <span className="font-normal text-gray-700">
                                      {item.questionText.length > 80
                                        ? item.questionText.slice(0, 80) + "..."
                                        : item.questionText}
                                    </span>
                                  </p>
                                  <p className="text-sm text-orange-800">
                                    {fb}
                                  </p>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    )}

                  {/* Expandable Charts */}
                  {submission.analysis_results?.summary && (
                    <div>
                      <button
                        onClick={() =>
                          setExpandedId(
                            expandedId === submission.id ? null : submission.id,
                          )
                        }
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                      >
                        <span
                          className={`transition-transform duration-200 inline-block ${
                            expandedId === submission.id ? "rotate-90" : ""
                          }`}
                        >
                          ▶
                        </span>
                        {expandedId === submission.id
                          ? "Hide Charts"
                          : "View Charts"}
                      </button>
                      {expandedId === submission.id && (
                        <div className="mt-3 space-y-4">
                          {/* TOS Compliance Badge */}
                          {(() => {
                            const lotsPct =
                              submission.analysis_results.summary
                                .lotsPercentage || 0;
                            const hotsPct =
                              submission.analysis_results.summary
                                .hotsPercentage || 0;
                            const isCompliant =
                              Math.abs(lotsPct - 30) <= 5 &&
                              Math.abs(hotsPct - 70) <= 5;
                            return (
                              <div
                                className={`p-4 rounded-xl border-2 flex items-center gap-4 ${isCompliant ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}
                              >
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isCompliant ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
                                >
                                  {isCompliant ? (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-5 w-5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={3}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  ) : (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-5 w-5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={3}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                                      />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p
                                    className={`font-bold text-sm ${isCompliant ? "text-green-800" : "text-red-800"}`}
                                  >
                                    {isCompliant
                                      ? "TOS Compliant"
                                      : "TOS Non-Compliant"}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Target: 30% LOTS / 70% HOTS
                                  </p>
                                  <div className="flex gap-4 mt-1">
                                    <span
                                      className={`text-xs font-semibold ${Math.abs(lotsPct - 30) <= 5 ? "text-green-600" : "text-red-600"}`}
                                    >
                                      LOTS: {lotsPct}%
                                      {lotsPct !== 30 &&
                                        ` (${30 - lotsPct > 0 ? "+" : ""}${30 - lotsPct}%)`}
                                    </span>
                                    <span
                                      className={`text-xs font-semibold ${Math.abs(hotsPct - 70) <= 5 ? "text-green-600" : "text-red-600"}`}
                                    >
                                      HOTS: {hotsPct}%
                                      {hotsPct !== 70 &&
                                        ` (${70 - hotsPct > 0 ? "+" : ""}${70 - hotsPct}%)`}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          <BloomsVisualizationPanel
                            summary={submission.analysis_results.summary}
                          />
                          <QuizSuggestions
                            summary={submission.analysis_results.summary}
                          />

                          {/* Per-Question Breakdown */}
                          {submission.analysis_results.analysis?.length > 0 && (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 text-gray-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                    />
                                  </svg>
                                  Per-Question Breakdown
                                  <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-semibold rounded-full">
                                    {
                                      submission.analysis_results.analysis
                                        .length
                                    }{" "}
                                    questions
                                  </span>
                                </h4>
                              </div>
                              {/* Table Header */}
                              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <div className="col-span-1">#</div>
                                <div className="col-span-5">Question</div>
                                <div className="col-span-2">Level</div>
                                <div className="col-span-2">Type</div>
                                <div className="col-span-2 text-right">
                                  Confidence
                                </div>
                              </div>
                              <div className="divide-y divide-gray-100">
                                {submission.analysis_results.analysis.map(
                                  (item, idx) => {
                                    const snapshots =
                                      submission.analysis_results
                                        .questionSnapshots || [];
                                    const snapshotById = snapshots.find(
                                      (s) =>
                                        String(s.questionId) ===
                                        String(item.questionId),
                                    );
                                    const snapshotByText = snapshots.find(
                                      (s) =>
                                        normalizeQuestionText(
                                          s.questionText,
                                        ) ===
                                        normalizeQuestionText(
                                          item.questionText,
                                        ),
                                    );
                                    const snapshot =
                                      snapshotById ||
                                      snapshotByText ||
                                      snapshots[idx] ||
                                      null;
                                    const options = Array.isArray(
                                      snapshot?.options,
                                    )
                                      ? snapshot.options
                                      : [];

                                    return (
                                      <div
                                        key={item.questionId}
                                        className={`px-4 py-3 text-sm ${item.needsReview ? "bg-yellow-50" : "bg-white"}`}
                                      >
                                        <div className="grid grid-cols-12 gap-2 items-start">
                                          <div className="col-span-1 text-gray-400 font-semibold pt-0.5">
                                            {idx + 1}
                                          </div>
                                          <div className="col-span-5 text-gray-700 break-words">
                                            {item.questionText}
                                            {options.length > 0 && (
                                              <div className="mt-2 space-y-1.5">
                                                {options.map((opt, optIdx) => {
                                                  const letter =
                                                    String.fromCharCode(
                                                      65 + optIdx,
                                                    );
                                                  const isCorrect =
                                                    String(opt) ===
                                                    String(
                                                      snapshot?.correctAnswer,
                                                    );
                                                  return (
                                                    <div
                                                      key={`${item.questionId}-opt-${optIdx}`}
                                                      className={`text-xs border rounded px-2 py-1 break-words ${
                                                        isCorrect
                                                          ? "border-green-300 bg-green-50 text-green-800"
                                                          : "border-gray-200 bg-gray-50 text-gray-700"
                                                      }`}
                                                    >
                                                      <div className="flex items-start gap-1.5 min-w-0">
                                                        <span className="font-semibold shrink-0">
                                                          {letter}.
                                                        </span>
                                                        <span className="min-w-0 break-words break-all whitespace-pre-wrap">
                                                          {String(opt || "")}
                                                        </span>
                                                        {isCorrect && (
                                                          <span className="ml-1 font-bold shrink-0">
                                                            Correct
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                          <div className="col-span-2 pt-0.5">
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${
                                                {
                                                  Remembering:
                                                    "bg-blue-100 text-blue-700 border-blue-300",
                                                  Understanding:
                                                    "bg-cyan-100 text-cyan-700 border-cyan-300",
                                                  Applying:
                                                    "bg-green-100 text-green-700 border-green-300",
                                                  Analyzing:
                                                    "bg-yellow-100 text-yellow-700 border-yellow-300",
                                                  Evaluating:
                                                    "bg-orange-100 text-orange-700 border-orange-300",
                                                  Creating:
                                                    "bg-purple-100 text-purple-700 border-purple-300",
                                                }[item.bloomsLevel] ||
                                                "bg-gray-100 text-gray-700 border-gray-300"
                                              }`}
                                            >
                                              {item.bloomsLevel}
                                            </span>
                                          </div>
                                          <div className="col-span-2 pt-0.5">
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${item.thinkingOrder === "HOTS" ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"}`}
                                            >
                                              {item.thinkingOrder}
                                            </span>
                                            {item.needsReview && (
                                              <span
                                                className="ml-1 text-yellow-500 text-xs"
                                                title="Low confidence"
                                              >
                                                !
                                              </span>
                                            )}
                                          </div>
                                          <div className="col-span-2 text-right pt-0.5">
                                            <span
                                              className={`font-semibold ${item.confidence >= 0.9 ? "text-green-600" : item.confidence >= 0.75 ? "text-yellow-600" : "text-red-600"}`}
                                            >
                                              {(item.confidence * 100).toFixed(
                                                1,
                                              )}
                                              %
                                            </span>
                                          </div>
                                        </div>
                                        {submission.question_feedback?.[
                                          item.questionId
                                        ] && (
                                          <div className="mt-2 ml-8 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                                            <p className="text-xs font-semibold text-orange-600 mb-0.5">
                                              Senior Faculty Feedback:
                                            </p>
                                            <p className="text-sm text-orange-800">
                                              {
                                                submission.question_feedback[
                                                  item.questionId
                                                ]
                                              }
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                    <span>Submitted {formatDate(submission.created_at)}</span>
                    <div className="flex items-center gap-3">
                      {submission.reviewed_at && (
                        <span>
                          Reviewed {formatDate(submission.reviewed_at)}
                        </span>
                      )}
                      <button
                        onClick={async () => {
                          // Fetch signatory names and semester/school year settings
                          let reviewerName,
                            approverName,
                            semesterOverride,
                            schoolYearOverride;
                          const { data: signatories } = await supabase
                            .from("tos_signatories")
                            .select(
                              "reviewer_name, approver_name, semester_override, school_year_override",
                            )
                            .order("updated_at", { ascending: false })
                            .limit(1)
                            .single();
                          if (signatories) {
                            reviewerName = signatories.reviewer_name;
                            approverName = signatories.approver_name;
                            semesterOverride = signatories.semester_override;
                            schoolYearOverride =
                              signatories.school_year_override;
                          }
                          await exportBloomsPdf({
                            quizTitle: submission.quizzes?.title,
                            results: submission.analysis_results,
                            instructorName,
                            reviewerName,
                            approverName,
                            submittedAt: submission.created_at,
                            adminFeedback: submission.admin_feedback,
                            status: submission.status,
                            subjectCode: submission.section?.subject_code,
                            courseName: submission.section?.name,
                            semesterOverride,
                            schoolYearOverride,
                            reviewedAt: submission.reviewed_at,
                            facultyHeadApprovedAt:
                              submission.faculty_head_approved_at,
                          });
                        }}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        PDF
                      </button>
                      <button
                        onClick={async () => {
                          let semesterOverride, schoolYearOverride;
                          const { data: signatories } = await supabase
                            .from("tos_signatories")
                            .select("semester_override, school_year_override")
                            .order("updated_at", { ascending: false })
                            .limit(1)
                            .single();
                          if (signatories) {
                            semesterOverride = signatories.semester_override;
                            schoolYearOverride =
                              signatories.school_year_override;
                          }

                          // Get questions from snapshots in analysis_results
                          const snapshots =
                            submission.analysis_results?.questionSnapshots ||
                            [];
                          // If no snapshots, fetch questions from DB
                          let questions = snapshots;
                          if (questions.length === 0 && submission.quiz_id) {
                            const { data: qRows } = await supabase
                              .from("questions")
                              .select("id, text, type, options")
                              .eq("quiz_id", submission.quiz_id)
                              .order("created_at", { ascending: true });
                            questions = (qRows || []).map((q) => ({
                              questionId: q.id,
                              questionText: q.text,
                              type: q.type,
                              options: q.options || [],
                            }));
                          }

                          const questionFeedback =
                            submission.question_feedback || {};
                          const questionFeedbackByNumber = {};
                          (submission.analysis_results?.analysis || []).forEach(
                            (item, idx) => {
                              const fb = questionFeedback[item.questionId];
                              if (fb) questionFeedbackByNumber[idx + 1] = fb;
                            },
                          );

                          await exportQuizPaperPdf({
                            quizTitle: submission.quizzes?.title,
                            quizDescription: submission.quizzes?.description,
                            instructorName,
                            courseName: submission.section?.name,
                            semesterOverride,
                            schoolYearOverride,
                            submittedAt: submission.created_at,
                            questions,
                            questionFeedback,
                            questionFeedbackByNumber,
                          });
                        }}
                        className="px-3 py-1.5 bg-brand-navy hover:bg-brand-indigo text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Quiz Paper
                      </button>
                      {submission.status === "revision_requested" &&
                        !submission.hasNewerVersion && (
                          <button
                            disabled={creatingRevisionFor === submission.id}
                            onClick={async () => {
                              try {
                                setCreatingRevisionFor(submission.id);
                                const newQuiz = await createRevisionCopy(
                                  submission.quiz_id,
                                );
                                navigate(
                                  `/instructor-dashboard/instructor-quiz/${newQuiz.id}`,
                                  {
                                    state: {
                                      revisionOfSubmissionId: submission.id,
                                    },
                                  },
                                );
                              } catch (err) {
                                console.error(
                                  "Error creating revision copy:",
                                  err,
                                );
                                notify.error(
                                  "Failed to create revision: " + err.message,
                                );
                              } finally {
                                setCreatingRevisionFor(null);
                              }
                            }}
                            className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            {creatingRevisionFor === submission.id
                              ? "Creating Revision..."
                              : "Edit & Resubmit"}
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-xs text-gray-400">
                  Showing {startIndex + 1}–
                  {Math.min(endIndex, submissions.length)} of{" "}
                  {submissions.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  {Array.from(
                    { length: totalPages },
                    (_, index) => index + 1,
                  ).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors ${
                        page === currentPage
                          ? "bg-brand-gold text-brand-navy"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
