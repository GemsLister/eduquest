import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

/**
 * PeerReviews — Instructor Peer Review List Page
 * Shows all quiz analysis submissions assigned to the current instructor for peer review.
 * Route: /instructor-dashboard/peer-reviews
 */
export const PeerReviews = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (user?.id) loadAssignedReviews();
  }, [user?.id]);

  const loadAssignedReviews = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let peerData = [];

      // Strategy 1: Direct column query
      const { data: colData, error: colErr } = await supabase
        .from("quiz_analysis_submissions")
        .select("*, quizzes(*)")
        .eq("assigned_reviewer_id", user.id)
        .order("created_at", { ascending: false });

      if (!colErr && Array.isArray(colData) && colData.length > 0) {
        peerData = colData;
      } else {
        // Strategy 2: Fallback query matching assigned_reviewer_id column or analysis_results JSONB
        const { data: allAccessible, error: allErr } = await supabase
          .from("quiz_analysis_submissions")
          .select("*, quizzes(*)")
          .order("created_at", { ascending: false });

        if (!allErr && Array.isArray(allAccessible)) {
          peerData = allAccessible.filter(
            (s) =>
              (s.assigned_reviewer_id === user.id ||
                s.analysis_results?.assigned_reviewer_id === user.id) &&
              s.instructor_id !== user.id,
          );
        }
      }

      if (peerData.length > 0) {
        const instructorIds = [
          ...new Set(peerData.map((s) => s.instructor_id).filter(Boolean)),
        ];
        let profileMap = {};
        if (instructorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, username")
            .in("id", instructorIds);

          profiles?.forEach((p) => {
            profileMap[p.id] = p;
          });
        }

        const quizIds = [
          ...new Set(peerData.map((s) => s.quiz_id).filter(Boolean)),
        ];
        let quizMap = new Map();
        if (quizIds.length > 0) {
          try {
            const { data: quizRows } = await supabase
              .from("quizzes")
              .select("id, parent_quiz_id, title, description, is_published, version_number");

            quizRows?.forEach((q) => {
              quizMap.set(q.id, q);
            });
          } catch (e) {
            console.warn("Could not query quizzes directly:", e);
          }
        }

        const findRootId = (quizId) => {
          if (!quizId) return null;
          let curr = quizId;
          let visited = new Set();
          while (curr && !visited.has(curr)) {
            visited.add(curr);
            const q = quizMap.get(curr);
            if (q && q.parent_quiz_id) {
              curr = q.parent_quiz_id;
            } else {
              break;
            }
          }
          return curr;
        };

        const enrichedData = peerData.map((s) => {
          const joinedQuiz = s.quizzes || quizMap.get(s.quiz_id) || null;
          const quizTitle =
            joinedQuiz?.title ||
            s.analysis_results?.quiz_title ||
            s.analysis_results?.title ||
            s.analysis_results?.summary?.quizTitle ||
            "Quiz";
          return {
            ...s,
            quizzes: joinedQuiz ? { ...joinedQuiz, title: quizTitle } : { title: quizTitle },
            profiles: profileMap[s.instructor_id] || null,
          };
        });

        // Deduplicate chains: keep only the latest submission per quiz chain for the peer reviewer
        const getCleanTitle = (s) => {
          const rawTitle =
            s.quizzes?.title ||
            s.analysis_results?.quiz_title ||
            s.analysis_results?.title ||
            s.analysis_results?.summary?.quizTitle ||
            "";
          return rawTitle.replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/i, "").trim().toLowerCase();
        };

        const getChainKey = (s) => {
          const baseTitle = getCleanTitle(s);
          const instructor = s.instructor_id || s.quizzes?.instructor_id || "unknown";
          if (baseTitle) return `title_${instructor}_${baseTitle}`;

          const rootQuizId = findRootId(s.quiz_id) || s.quizzes?.parent_quiz_id || s.quiz_id;
          if (rootQuizId) return `quiz_${rootQuizId}`;

          return `sub_${s.id}`;
        };

        const chains = new Map();
        for (const sub of enrichedData) {
          const key = getChainKey(sub);
          if (!chains.has(key)) chains.set(key, []);
          chains.get(key).push(sub);
        }

        const latestPeerReviews = [];
        for (const chainSubs of chains.values()) {
          const sorted = [...chainSubs].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          latestPeerReviews.push(sorted[0]);
        }

        latestPeerReviews.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setSubmissions(latestPeerReviews);
      } else {
        setSubmissions([]);
      }
    } catch (err) {
      console.error("Error loading assigned reviews:", err);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  // Status badge helper
  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-700 border border-yellow-300",
      approved: "bg-green-100 text-green-700 border border-green-300",
      revision_requested: "bg-orange-100 text-orange-700 border border-orange-300",
      faculty_head_review: "bg-blue-100 text-blue-700 border border-blue-300",
      faculty_head_approved: "bg-green-100 text-green-700 border border-green-300",
    };
    const labels = {
      pending: "Pending Review",
      approved: "Approved",
      revision_requested: "Revision Requested",
      faculty_head_review: "At Dept. Head",
      faculty_head_approved: "Final Approved",
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-600 border border-gray-200"}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getInstructorName = (profiles) => {
    if (!profiles) return "Unknown";
    return `${profiles.first_name || ""} ${profiles.last_name || ""}`.trim() ||
      profiles.username || profiles.email || "Unknown";
  };

  // Badge counts
  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, approved: 0, revision_requested: 0, faculty_head_review: 0 };
    submissions.forEach((s) => {
      c.all++;
      if (s.status === "pending") c.pending++;
      else if (s.status === "revision_requested") c.revision_requested++;
      else if (s.status === "faculty_head_review") c.faculty_head_review++;
      else if (s.status === "approved" || s.status === "faculty_head_approved") c.approved++;
    });
    return c;
  }, [submissions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  const filtered = useMemo(() => {
    let list = submissions;
    if (filter !== "all") {
      if (filter === "approved") {
        list = list.filter((s) => s.status === "approved" || s.status === "faculty_head_approved");
      } else {
        list = list.filter((s) => s.status === filter);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.quizzes?.title?.toLowerCase().includes(q) ||
          getInstructorName(s.profiles).toLowerCase().includes(q)
      );
    }
    return list;
  }, [submissions, filter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filterTabs = [
    { key: "all", label: "All", count: counts.all },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "revision_requested", label: "Revision Requested", count: counts.revision_requested },
    { key: "faculty_head_review", label: "At Dept. Head", count: counts.faculty_head_review },
    { key: "approved", label: "Approved", count: counts.approved },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Peer Reviews
        </h1>
        <p className="text-white/60 text-sm mt-1">Quiz analyses assigned to you for peer review</p>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                filter === tab.key
                  ? "bg-brand-navy text-white border-brand-navy shadow"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-navy hover:text-brand-navy"
              }`}
            >
              {tab.label}
              <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                filter === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quiz title or instructor name..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 text-sm bg-white"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold mb-3"></div>
                <p className="text-gray-500 text-sm">Loading assigned reviews...</p>
              </div>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-semibold text-gray-500">No peer reviews found</p>
              <p className="text-sm mt-1">You have no quiz analyses assigned to you for review.</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Quiz Title</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Submitted By</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Date Submitted</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Status</th>
                    <th className="text-right px-5 py-3.5 font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((submission) => (
                    <tr
                      key={submission.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/instructor-dashboard/peer-reviews/${submission.id}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-800">
                          {(submission.quizzes?.title || submission.analysis_results?.quiz_title || submission.analysis_results?.title || submission.analysis_results?.summary?.quizTitle || "Quiz").replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "")}
                        </div>
                        {submission.quizzes?.subject && (
                          <div className="text-xs text-gray-400 mt-0.5">{submission.quizzes.subject}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-600">{getInstructorName(submission.profiles)}</td>
                      <td className="px-5 py-4 text-gray-500">
                        {new Date(submission.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(submission.status)}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/instructor-dashboard/peer-reviews/${submission.id}`);
                          }}
                          className="px-4 py-1.5 bg-brand-navy hover:bg-brand-indigo text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          {submission.status === "pending" ? "Review" : "View"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="px-3 py-1.5 text-xs rounded border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ‹ Prev
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="px-3 py-1.5 text-xs rounded border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

