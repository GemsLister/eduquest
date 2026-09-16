import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

// Clean SVG Icons for Timeline Actions
const ActionIcon = ({ type }) => {
  switch (type) {
    case "create_quiz":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      );
    case "edit_quiz":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case "submit_review":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      );
    case "forward":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      );
    case "revision":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "approve":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "publish":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "unpublish":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    case "archive":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      );
    case "restore":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case "question":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "bank":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      );
    case "flag":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

/**
 * SystemActivityTimeline
 * Comprehensive, append-only General System Activity Audit Trail UI component.
 * Displays WHO did WHAT, WHICH ITEM was affected, WHEN it happened, PREVIOUS/NEW STATE,
 * and REASON/CHANGE DETAILS with fully enriched real Subject and Section names.
 */
export const SystemActivityTimeline = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeDetailLog, setActiveDetailLog] = useState(null);

  useEffect(() => {
    fetchSystemActivityLogs();
  }, []);

  const fetchSystemActivityLogs = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 1. Fetch unified audit rows
      let rawAuditRows = [];
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "get_unified_system_activity",
        { p_limit: 200 }
      );

      if (!rpcErr && rpcData && rpcData.length > 0) {
        rawAuditRows = rpcData;
      } else {
        const { data: auditRows, error: aErr } = await supabase
          .from("audit_trail")
          .select(
            "id, action, table_name, record_id, item_name, subject_name, section_name, previous_status, new_status, reason, change_summary, user_id, user_role, old_values, new_values, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(200);

        if (!aErr && auditRows) {
          rawAuditRows = auditRows.map((r) => ({
            log_id: r.id,
            action: r.action,
            table_name: r.table_name,
            record_id: r.record_id,
            item_name: r.item_name,
            subject_name: r.subject_name,
            section_name: r.section_name,
            previous_status: r.previous_status,
            new_status: r.new_status,
            reason: r.reason,
            change_summary: r.change_summary,
            user_id: r.user_id,
            user_role: r.user_role,
            old_values: r.old_values,
            new_values: r.new_values,
            created_at: r.created_at,
          }));
        }
      }

      if (!rawAuditRows || rawAuditRows.length === 0) {
        setLogs([]);
        return;
      }

      // 2. Extract all IDs to fetch rich relational context in batch
      const userIds = [...new Set(rawAuditRows.map((r) => r.user_id).filter(Boolean))];
      const candidateIds = [
        ...new Set(
          rawAuditRows.flatMap((r) => [
            r.record_id,
            r.new_values?.quizId,
            r.new_values?.quiz_id,
            r.new_values?.sectionId,
            r.new_values?.section_id,
            r.new_values?.subjectId,
            r.new_values?.subject_id,
            r.old_values?.quizId,
            r.old_values?.quiz_id,
          ]).filter(Boolean)
        ),
      ];

      // 3. Batch fetch Profiles, Quizzes, Sections, Questions, and Subjects
      const [profilesRes, quizzesRes, quizSectionsRes, questionsRes, sectionsRes, subjectsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("id, first_name, last_name, username, email, is_admin, is_faculty_head").in("id", userIds)
          : Promise.resolve({ data: [] }),
        candidateIds.length > 0
          ? supabase.from("quizzes").select("id, title, is_private, instructor_id, subject_id, section_id, subjects(id, name, code), sections(id, name, code)").in("id", candidateIds)
          : Promise.resolve({ data: [] }),
        candidateIds.length > 0
          ? supabase.from("quiz_sections").select("quiz_id, section_id, sections(id, name, code, subject_id, subjects(id, name, code))").in("quiz_id", candidateIds)
          : Promise.resolve({ data: [] }),
        candidateIds.length > 0
          ? supabase.from("questions").select("id, text, quiz_id, subject_id, section_id, subjects(id, name, code), sections(id, name, code), quizzes(id, title, subjects(id, name, code), sections(id, name, code))").in("id", candidateIds)
          : Promise.resolve({ data: [] }),
        supabase.from("sections").select("id, name, code, subject_id, subjects(id, name, code)"),
        supabase.from("subjects").select("id, name, code, description"),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p) => [String(p.id), p]));
      const quizMap = new Map((quizzesRes.data || []).map((q) => [String(q.id), q]));
      const questionMap = new Map((questionsRes.data || []).map((q) => [String(q.id), q]));
      const sectionMap = new Map((sectionsRes.data || []).map((s) => [String(s.id), s]));
      const subjectMap = new Map((subjectsRes.data || []).map((s) => [String(s.id), s]));

      // Build quiz-to-section junction map
      const quizSectionJunctionMap = new Map();
      (quizSectionsRes.data || []).forEach((qs) => {
        if (qs && qs.quiz_id && qs.sections) {
          quizSectionJunctionMap.set(String(qs.quiz_id), qs.sections);
        }
      });

      // 4. Map & enrich every audit row with actual names
      const enrichedLogs = rawAuditRows.map((r) => {
        const prof = profileMap.get(String(r.user_id));
        const fullName = prof
          ? `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || prof.username || prof.email
          : r.user_full_name && r.user_full_name !== "System User"
          ? r.user_full_name
          : "System User";

        const recIdStr = r.record_id ? String(r.record_id) : "";
        const newQuizIdStr = r.new_values?.quizId ? String(r.new_values.quizId) : r.new_values?.quiz_id ? String(r.new_values.quiz_id) : "";
        
        // Find associated Quiz, Question, Section, Subject
        const quiz = quizMap.get(recIdStr) || quizMap.get(newQuizIdStr) || (r.record_id ? questionMap.get(recIdStr)?.quizzes : null);
        const question = questionMap.get(recIdStr);
        const junctionSection = quiz ? quizSectionJunctionMap.get(String(quiz.id)) : null;
        const section = sectionMap.get(recIdStr) || quiz?.sections || junctionSection || question?.sections || question?.quizzes?.sections || null;
        
        const subjectIdCandidate = quiz?.subject_id || section?.subject_id || question?.subject_id || question?.quizzes?.subject_id || null;
        const subject = subjectMap.get(String(subjectIdCandidate)) || quiz?.subjects || section?.subjects || question?.subjects || question?.quizzes?.subjects || null;

        // Resolve Item Name
        let resolvedItemName = r.item_name;
        if (!resolvedItemName || resolvedItemName === "System Item" || resolvedItemName === "Quiz") {
          resolvedItemName =
            quiz?.title ||
            r.new_values?.quizTitle ||
            r.new_values?.title ||
            r.new_values?.itemName ||
            (question?.text ? `Q: ${question.text.slice(0, 50)}${question.text.length > 50 ? "..." : ""}` : null) ||
            section?.name ||
            (r.action?.includes("ANALYSIS") ? "Item Analysis Assessment" : "Assessment Item");
        }

        // Resolve Subject Name
        let resolvedSubjectName = r.subject_name;
        if (!resolvedSubjectName || resolvedSubjectName === "General Subject") {
          resolvedSubjectName =
            subject?.name ||
            (subject?.code ? `${subject.code} ${subject.name || ""}`.trim() : null) ||
            r.new_values?.subjectName ||
            r.new_values?.subject_name ||
            null;
        }

        // Resolve Section Name
        let resolvedSectionName = r.section_name;
        if (!resolvedSectionName || resolvedSectionName === "General Section") {
          resolvedSectionName =
            section?.name ||
            (section?.code ? `${section.code} ${section.name || ""}`.trim() : null) ||
            r.new_values?.sectionName ||
            r.new_values?.section_name ||
            null;
        }

        return {
          log_id: r.log_id || r.id,
          action: r.action,
          table_name: r.table_name,
          record_id: r.record_id,
          item_name: resolvedItemName,
          subject_name: resolvedSubjectName,
          section_name: resolvedSectionName,
          previous_status: r.previous_status || r.new_values?.previousStatus,
          new_status: r.new_status || r.new_values?.status,
          reason: r.reason || r.new_values?.reason || r.new_values?.feedback,
          change_summary: r.change_summary || r.new_values?.changeSummary,
          user_id: r.user_id,
          user_full_name: fullName,
          user_role: r.user_role || (prof?.is_admin ? "admin" : prof?.is_faculty_head ? "faculty_head" : "instructor"),
          is_private_item: quiz?.is_private || false,
          created_at: r.created_at,
        };
      });

      setLogs(enrichedLogs);
    } catch (err) {
      console.error("Error fetching system activity logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  // Convert internal action key to Human-Readable Title & Icon Type
  const getActionInfo = (actionKey) => {
    const act = (actionKey || "").toUpperCase();

    if (act.includes("CREATED") && act.includes("QUIZ")) {
      return { label: "Created a quiz", badge: "bg-emerald-50 text-emerald-800 border-emerald-200", iconType: "create_quiz" };
    }
    if (act.includes("EDITED") || act.includes("UPDATED")) {
      return { label: "Edited a quiz", badge: "bg-blue-50 text-blue-800 border-blue-200", iconType: "edit_quiz" };
    }
    if (act.includes("SUBMITTED") || act.includes("REVIEW_REQUESTED")) {
      return { label: "Submitted a quiz for review", badge: "bg-amber-50 text-amber-800 border-amber-200", iconType: "submit_review" };
    }
    if (act.includes("FORWARDED")) {
      return { label: "Forwarded quiz to Head", badge: "bg-indigo-50 text-indigo-800 border-indigo-200", iconType: "forward" };
    }
    if (act.includes("REVISION") || act.includes("REJECTED")) {
      return { label: "Returned quiz for revision", badge: "bg-rose-50 text-rose-800 border-rose-200", iconType: "revision" };
    }
    if (act.includes("APPROVED")) {
      return { label: "Approved a quiz", badge: "bg-emerald-50 text-emerald-800 border-emerald-200", iconType: "approve" };
    }
    if (act.includes("PUBLISHED")) {
      return { label: "Published a quiz", badge: "bg-teal-50 text-teal-800 border-teal-200", iconType: "publish" };
    }
    if (act.includes("UNPUBLISHED")) {
      return { label: "Unpublished a quiz", badge: "bg-slate-100 text-slate-800 border-slate-200", iconType: "unpublish" };
    }
    if (act.includes("ARCHIVED")) {
      return { label: "Archived a quiz", badge: "bg-slate-100 text-slate-700 border-slate-200", iconType: "archive" };
    }
    if (act.includes("RESTORED")) {
      return { label: "Restored a quiz", badge: "bg-sky-50 text-sky-800 border-sky-200", iconType: "restore" };
    }
    if (act.includes("QUESTION_CREATED") || act.includes("ADD_QUESTION")) {
      return { label: "Created a question", badge: "bg-purple-50 text-purple-800 border-purple-200", iconType: "question" };
    }
    if (act.includes("QUESTION_BANK") || act.includes("QUESTION_REVISED_SAVED_TO_BANK")) {
      return { label: "Added to Question Bank", badge: "bg-amber-50 text-amber-800 border-amber-200", iconType: "bank" };
    }
    if (act.includes("ITEM_FLAGGED") || act.includes("ANALYSIS")) {
      return { label: "Flagged item in Item Analysis", badge: "bg-rose-50 text-rose-800 border-rose-200", iconType: "flag" };
    }

    const defaultLabel = actionKey.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { label: defaultLabel, badge: "bg-slate-50 text-slate-800 border-slate-200", iconType: "default" };
  };

  const getRoleBadge = (role) => {
    const r = (role || "").toLowerCase();
    if (r === "admin") {
      return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wide">Admin</span>;
    }
    if (r === "faculty_head") {
      return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">Department Head</span>;
    }
    if (r === "senior_faculty") {
      return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wide">Senior Faculty</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">Instructor</span>;
  };

  // Pagination State
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, roleFilter]);

  // Filtering
  const filteredLogs = logs.filter((log) => {
    if (roleFilter !== "all" && (log.user_role || "").toLowerCase() !== roleFilter) {
      return false;
    }
    if (categoryFilter !== "all") {
      const act = (log.action || "").toUpperCase();
      if (categoryFilter === "workflows" && !act.includes("SUBMIT") && !act.includes("APPROV") && !act.includes("REJECT") && !act.includes("FORWARD") && !act.includes("REVISION")) return false;
      if (categoryFilter === "edits" && !act.includes("CREATED") && !act.includes("EDITED") && !act.includes("UPDATE")) return false;
      if (categoryFilter === "questions" && !act.includes("QUESTION") && !act.includes("BANK")) return false;
      if (categoryFilter === "publishing" && !act.includes("PUBLISH") && !act.includes("ARCHIVE")) return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const actionInfo = getActionInfo(log.action);
      const matchLabel = actionInfo.label.toLowerCase().includes(q);
      const matchUser = (log.user_full_name || "").toLowerCase().includes(q);
      const matchItem = (log.item_name || "").toLowerCase().includes(q);
      const matchReason = (log.reason || "").toLowerCase().includes(q);
      const matchSubject = (log.subject_name || "").toLowerCase().includes(q);
      const matchSection = (log.section_name || "").toLowerCase().includes(q);
      if (!matchLabel && !matchUser && !matchItem && !matchReason && !matchSubject && !matchSection) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Search user, action, quiz, subject, section, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>
          </div>

          {/* Action Category Filter */}
          <div className="w-full md:w-56">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            >
              <option value="all">All Action Categories</option>
              <option value="workflows">Approvals & Review Workflows</option>
              <option value="edits">Creations & Edits</option>
              <option value="publishing">Publishing & Archiving</option>
              <option value="questions">Questions & Question Bank</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="w-full md:w-44">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            >
              <option value="all">All Roles</option>
              <option value="instructor">Instructor</option>
              <option value="faculty_head">Department Head</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Activity Timeline Stream */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold mb-3"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Activity Audit Log...
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-base font-bold text-slate-800">
            No System Activity Records Found
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Try adjusting your search criteria or dropdown filters above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {paginatedLogs.map((log) => {
              const actionInfo = getActionInfo(log.action);
              const hasSubRow = log.subject_name || log.section_name || (log.previous_status && log.new_status);

              return (
                <div key={log.log_id} className="relative group">
                  {/* Timeline node icon */}
                  <div className="absolute -left-6 top-1.5 w-6 h-6 rounded-full bg-white border-2 border-slate-300 group-hover:border-brand-navy shadow-xs flex items-center justify-center text-xs z-10 transition-colors">
                    <ActionIcon type={actionInfo.iconType} />
                  </div>

                  {/* Main Card */}
                  <div className="bg-white border border-slate-200 hover:border-brand-navy/30 rounded-2xl p-4 shadow-xs transition-all duration-200 space-y-2.5">
                    {/* Summary Header Line */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${actionInfo.badge}`}>
                          {actionInfo.label}
                        </span>
                        {getRoleBadge(log.user_role)}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                        <span>{formatDate(log.created_at)}</span>
                        <span>•</span>
                        <span>{formatTime(log.created_at)}</span>
                        <span className="text-slate-400 font-normal">({formatRelativeTime(log.created_at)})</span>
                      </div>
                    </div>

                    {/* Sentential Statement */}
                    <div className="text-sm font-semibold text-slate-800">
                      <span className="font-extrabold text-brand-navy">{log.user_full_name || "System User"}</span>
                      {" "}{actionInfo.label.toLowerCase()}{" "}
                      <span className="font-extrabold text-slate-900">"{log.item_name}"</span>
                    </div>

                    {/* Context Sub-row with real Subject and Section */}
                    {hasSubRow && (
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        {log.subject_name && (
                          <span className="inline-flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            Subject: <strong className="text-slate-700">{log.subject_name}</strong>
                          </span>
                        )}
                        {log.subject_name && log.section_name && <span>•</span>}
                        {log.section_name && (
                          <span className="inline-flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Section: <strong className="text-slate-700">{log.section_name}</strong>
                          </span>
                        )}
                        {(log.subject_name || log.section_name) && log.previous_status && log.new_status && <span>•</span>}
                        {log.previous_status && log.new_status && (
                          <span className="inline-flex items-center gap-1.5">
                            Status Transition:
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase">{log.previous_status}</span>
                            <span className="text-slate-400">→</span>
                            <span className="px-2 py-0.5 bg-brand-navy text-white rounded text-[10px] font-bold uppercase">{log.new_status}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Reason callout if present */}
                    {log.reason && (
                      <div className="bg-amber-50/80 border-l-4 border-amber-400 p-2.5 rounded-r-xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-0.5">
                          Reason / Feedback:
                        </span>
                        <p className="text-xs text-amber-950 italic">"{log.reason}"</p>
                      </div>
                    )}

                    {/* Details Toggle Button */}
                    <div className="flex items-center justify-end pt-1">
                      <button
                        onClick={() => setActiveDetailLog(log)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-brand-navy transition-colors shadow-2xs"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls Bar */}
          {filteredLogs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 text-xs font-semibold text-slate-600 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span>
                Showing <strong>{startIndex + 1}</strong>–<strong>{Math.min(startIndex + ITEMS_PER_PAGE, filteredLogs.length)}</strong> of <strong>{filteredLogs.length}</strong> activity records
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

      {/* Structured Details Modal / Drawer */}
      {activeDetailLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-brand-navy text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-brand-gold uppercase block mb-0.5">
                  Audit Entry Details
                </span>
                <h3 className="text-lg font-extrabold">{getActionInfo(activeDetailLog.action).label}</h3>
              </div>
              <button
                onClick={() => setActiveDetailLog(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: 7-Point Attribution */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-3 divide-y divide-slate-100 text-xs">
                {/* 1. Action */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase tracking-wide">Action Performed</span>
                  <span className="font-bold text-slate-900">{getActionInfo(activeDetailLog.action).label}</span>
                </div>

                {/* 2. User */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase tracking-wide">User</span>
                  <span className="font-extrabold text-brand-navy">{activeDetailLog.user_full_name}</span>
                </div>

                {/* 3. Role */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase tracking-wide">Role</span>
                  <div>{getRoleBadge(activeDetailLog.user_role)}</div>
                </div>

                {/* 4. Affected Item */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase tracking-wide">Affected Item / Quiz</span>
                  <span className="font-bold text-slate-900">{activeDetailLog.item_name}</span>
                </div>

                {/* 5. Subject */}
                {activeDetailLog.subject_name && (
                  <div className="pt-2 flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase tracking-wide">Subject</span>
                    <span className="font-semibold text-slate-700">{activeDetailLog.subject_name}</span>
                  </div>
                )}

                {/* 6. Section */}
                {activeDetailLog.section_name && (
                  <div className="pt-2 flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase tracking-wide">Section</span>
                    <span className="font-semibold text-slate-700">{activeDetailLog.section_name}</span>
                  </div>
                )}

                {/* 7. Date & Time */}
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase tracking-wide">Date & Time</span>
                  <span className="font-semibold text-slate-700">
                    {formatDate(activeDetailLog.created_at)} • {formatTime(activeDetailLog.created_at)}
                  </span>
                </div>

                {/* 8. Previous Status */}
                {activeDetailLog.previous_status && (
                  <div className="pt-2 flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase tracking-wide">Previous Status</span>
                    <span className="font-bold text-slate-600 uppercase">{activeDetailLog.previous_status}</span>
                  </div>
                )}

                {/* 9. New Status */}
                {activeDetailLog.new_status && (
                  <div className="pt-2 flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase tracking-wide">New Status</span>
                    <span className="font-bold text-emerald-600 uppercase">{activeDetailLog.new_status}</span>
                  </div>
                )}

                {/* 10. Reason / Comment */}
                {activeDetailLog.reason && (
                  <div className="pt-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wide block mb-1">Reason / Feedback</span>
                    <p className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 italic text-amber-950 font-medium">
                      "{activeDetailLog.reason}"
                    </p>
                  </div>
                )}

                {/* 11. Change Details */}
                {activeDetailLog.change_summary && (
                  <div className="pt-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wide block mb-1">Change Summary</span>
                    <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-mono text-[11px]">
                      {activeDetailLog.change_summary}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActiveDetailLog(null)}
                className="px-5 py-2 bg-brand-navy hover:bg-brand-indigo text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
