import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { exportBloomsPdf } from "../../utils/exportBloomsPdf";
import { exportQuizPaperPdf } from "../../utils/exportQuizPaperPdf";

export const FacultyHeadQuizApprovals = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("faculty_head_review");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quiz_analysis_submissions")
        .select("*, quizzes(title, description, duration)")
        .in("status", ["faculty_head_review", "faculty_head_approved"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const instructorIds = [...new Set(data.map((s) => s.instructor_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, username")
          .in("id", instructorIds);

        const profileMap = {};
        profiles?.forEach((p) => {
          profileMap[p.id] = p;
        });

        // Filter out superseded submissions (older versions that have been resubmitted)
        const supersededIds = new Set();
        // Check previous_submission_id chain within these results
        data.forEach((s) => {
          if (s.previous_submission_id) {
            supersededIds.add(s.previous_submission_id);
          }
        });

        // Also check across ALL submissions to find any that supersede these
        const currentIds = data.map((s) => s.id);
        if (currentIds.length > 0) {
          const { data: newerSubs } = await supabase
            .from("quiz_analysis_submissions")
            .select("previous_submission_id")
            .in("previous_submission_id", currentIds);
          (newerSubs || []).forEach((s) => {
            supersededIds.add(s.previous_submission_id);
          });
        }

        const visibleData = data.filter((s) => !supersededIds.has(s.id));

        // Fetch section data for each submission
        const enriched = await Promise.all(
          visibleData.map(async (s) => {
            let section = null;
            if (s.quiz_id) {
              const { data: qs } = await supabase
                .from("quiz_sections")
                .select("section_id, sections(name, subject_code)")
                .eq("quiz_id", s.quiz_id)
                .limit(1)
                .maybeSingle();
              section = qs?.sections || null;
            }
            return {
              ...s,
              profiles: profileMap[s.instructor_id] || null,
              section,
            };
          }),
        );

        setAllSubmissions(enriched);
      } else {
        setAllSubmissions([]);
      }
    } catch (err) {
      console.error("Error loading submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const c = { faculty_head_review: 0, faculty_head_approved: 0, all: 0 };
    allSubmissions.forEach((s) => {
      c.all++;
      if (c[s.status] !== undefined) c[s.status]++;
    });
    return c;
  }, [allSubmissions]);

  const filtered = useMemo(() => {
    let list = allSubmissions;
    if (filter !== "all") {
      list = list.filter((s) => s.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => {
        const title = (s.quizzes?.title || "").toLowerCase();
        const p = s.profiles;
        const name = p
          ? `${p.first_name || ""} ${p.last_name || ""} ${p.username || ""} ${p.email || ""}`.toLowerCase()
          : "";
        return title.includes(q) || name.includes(q);
      });
    }
    return list;
  }, [allSubmissions, filter, search]);

  const getInstructorName = (submission) => {
    const p = submission.profiles;
    if (!p) return "Unknown Instructor";
    const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
    return name || p.username || p.email || "Unknown Instructor";
  };

  const getInitials = (submission) => {
    const p = submission.profiles;
    if (!p) return "?";
    if (p.first_name || p.last_name) {
      return (
        ((p.first_name || "")[0] + (p.last_name || "")[0]).toUpperCase() || "?"
      );
    }
    return (p.username || p.email || "?")[0].toUpperCase();
  };

  const avatarColors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-teal-500",
  ];

  const getAvatarColor = (id) => {
    let hash = 0;
    for (let i = 0; i < (id || "").length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const getStatusBadge = (status) => {
    const config = {
      faculty_head_review: {
        bg: "bg-yellow-100 text-yellow-700",
        label: "Pending Approval",
      },
      faculty_head_approved: {
        bg: "bg-green-100 text-green-700",
        label: "Approved",
      },
    };
    const c = config[status] || {
      bg: "bg-gray-100 text-gray-600",
      label: status,
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleExportPdf = async (e, submission) => {
    e.stopPropagation();
    const p = submission.profiles;
    const instructorName = p
      ? `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
        p.username ||
        p.email
      : undefined;

    let reviewerName, approverName, semesterOverride, schoolYearOverride;
    if (user) {
      const { data: signatories } = await supabase
        .from("tos_signatories")
        .select(
          "reviewer_name, approver_name, semester_override, school_year_override",
        )
        .eq("faculty_head_id", user.id)
        .single();
      if (signatories) {
        reviewerName = signatories.reviewer_name;
        approverName = signatories.approver_name;
        semesterOverride = signatories.semester_override;
        schoolYearOverride = signatories.school_year_override;
      }
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
      facultyHeadApprovedAt: submission.faculty_head_approved_at,
    });
  };

  const handleExportQuizPaper = async (e, submission) => {
    e.stopPropagation();
    const p = submission.profiles;
    const instructorName = p
      ? `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
        p.username ||
        p.email
      : undefined;

    let semesterOverride, schoolYearOverride;
    if (user) {
      const { data: signatories } = await supabase
        .from("tos_signatories")
        .select("semester_override, school_year_override")
        .eq("faculty_head_id", user.id)
        .single();
      if (signatories) {
        semesterOverride = signatories.semester_override;
        schoolYearOverride = signatories.school_year_override;
      }
    }

    let questions = submission.analysis_results?.questionSnapshots || [];
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

    const questionFeedback = submission.question_feedback || {};
    const questionFeedbackByNumber = {};
    (submission.analysis_results?.analysis || []).forEach((item, idx) => {
      const fb = questionFeedback[item.questionId];
      if (fb) questionFeedbackByNumber[idx + 1] = fb;
    });

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
  };

  const tabs = [
    { key: "faculty_head_review", label: "Pending", dotColor: "bg-yellow-400" },
    {
      key: "faculty_head_approved",
      label: "Approved",
      dotColor: "bg-green-500",
    },
    { key: "all", label: "All", dotColor: "bg-gray-400" },
  ];

  return (
    <>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
          Department Head
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          Quiz Approvals
          {counts.faculty_head_review > 0 && (
            <span className="flex items-center gap-2 px-3 py-1 bg-yellow-400/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-sm font-bold text-yellow-300">
                {counts.faculty_head_review} pending
              </span>
            </span>
          )}
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Approve quiz analyses reviewed by the Senior Faculty
        </p>
      </div>

      <div className="p-6">
        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by quiz title or instructor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="flex bg-gray-100 rounded-xl p-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  filter === tab.key
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${tab.dotColor}`} />
                {tab.label}
                <span
                  className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                    filter === tab.key
                      ? "bg-brand-navy text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold mx-auto mb-3"></div>
              <p className="text-gray-500 text-sm">Loading submissions...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-brand-navy/10 rounded-2xl flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-brand-navy"
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
            <h3 className="text-lg font-bold text-gray-700 mb-2">
              {search ? "No Results Found" : "No Submissions"}
            </h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              {search
                ? `No submissions match "${search}".`
                : "Quiz analyses forwarded by Senior Faculty will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((submission) => {
              const summary = submission.analysis_results?.summary;
              const lotsPct = summary?.lotsPercentage || 0;
              const hotsPct = summary?.hotsPercentage || 0;

              return (
                <div
                  key={submission.id}
                  onClick={() =>
                    navigate(
                      `/faculty-head-dashboard/quiz-approvals/${submission.id}`,
                    )
                  }
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-gold/30 transition-all p-5 cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${getAvatarColor(
                        submission.instructor_id,
                      )}`}
                    >
                      {getInitials(submission)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-gray-800 group-hover:text-brand-navy transition-colors truncate">
                          {(
                            submission.quizzes?.title || "Untitled Quiz"
                          ).replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "")}
                        </h3>
                        {getStatusBadge(submission.status)}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                        <span>
                          by{" "}
                          <span className="font-semibold text-gray-600">
                            {getInstructorName(submission)}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3"
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
                          {timeAgo(submission.created_at)}
                        </span>
                      </div>

                      {summary && (
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-brand-navy/10 rounded-lg text-xs font-semibold text-brand-navy">
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
                                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {summary.totalQuestions} questions
                          </span>

                          <div className="flex items-center gap-2">
                            <div className="flex h-2 w-24 rounded-full overflow-hidden bg-gray-100">
                              {lotsPct > 0 && (
                                <div
                                  className="bg-emerald-500 transition-all"
                                  style={{ width: `${lotsPct}%` }}
                                />
                              )}
                              {hotsPct > 0 && (
                                <div
                                  className="bg-amber-500 transition-all"
                                  style={{ width: `${hotsPct}%` }}
                                />
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400 font-medium">
                              <span className="text-emerald-600 font-semibold">
                                {lotsPct}%
                              </span>
                              {" / "}
                              <span className="text-amber-600 font-semibold">
                                {hotsPct}%
                              </span>
                            </span>
                          </div>

                          {summary.flaggedCount > 0 && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg text-xs font-semibold text-red-600">
                              {summary.flaggedCount} flagged
                            </span>
                          )}
                        </div>
                      )}

                      {submission.admin_feedback && (
                        <div className="mt-3 flex items-start gap-2 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                            />
                          </svg>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-blue-600">
                              Senior Faculty Feedback
                            </p>
                            <p className="text-xs text-blue-700 line-clamp-2">
                              {submission.admin_feedback}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center self-center gap-2">
                      {submission.status === "faculty_head_approved" && (
                        <>
                          <button
                            onClick={(e) => handleExportPdf(e, submission)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                            title="Export TOS PDF"
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
                            onClick={(e) =>
                              handleExportQuizPaper(e, submission)
                            }
                            className="px-3 py-1.5 bg-brand-navy hover:bg-brand-indigo text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                            title="Export Quiz Paper"
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
                        </>
                      )}
                      <div className="w-9 h-9 rounded-lg bg-brand-gold/10 flex items-center justify-center group-hover:bg-brand-navy transition-colors">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-brand-navy group-hover:text-white transition-colors"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
