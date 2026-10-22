import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { notify } from "../utils/notify.jsx";

/**
 * ReuseQuestionModal
 * Allows instructors to retrieve/reuse questions directly from Question Bank
 * into an existing or newly created quiz within the same subject.
 */
// Statuses where a quiz is under review and must not be changed
const REVIEW_LOCKED_STATUSES = ["pending", "faculty_head_review", "approved", "faculty_head_approved"];

// Insert a copied question; retries without is_private when that column
// hasn't been migrated yet (Postgres 42703 = undefined column).
const insertQuestionCopy = async (payload) => {
  let { data, error } = await supabase.from("questions").insert(payload).select();
  if (error && (error.code === "42703" || error.message?.includes("is_private"))) {
    const { is_private: _isPrivate, ...withoutPrivacy } = payload;
    ({ data, error } = await supabase.from("questions").insert(withoutPrivacy).select());
  }
  return { id: data?.[0]?.id || null, error };
};

export const ReuseQuestionModal = ({
  isOpen,
  onClose,
  questionsToReuse = [], // Array of question objects to reuse
  user,
  onSuccess,
  navigate,
  defaultSubjectId = null,
}) => {
  const [activeTab, setActiveTab] = useState("existing"); // "existing" | "new"
  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Subject management state
  const [subjects, setSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [currentSubjectId, setCurrentSubjectId] = useState(null);

  // New Quiz Form State
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [newQuizDescription, setNewQuizDescription] = useState("");
  const [newQuizDuration, setNewQuizDuration] = useState("");

  const sampleQuestion = questionsToReuse[0] || null;

  // Fetch all subjects on mount
  useEffect(() => {
    if (!isOpen) return;

    const fetchSubjects = async () => {
      try {
        setSubjectsLoading(true);
        const { data, error } = await supabase
          .from("subjects")
          .select("id, name, code, description")
          .or("is_archived.is.null,is_archived.eq.false")
          .order("name", { ascending: true });

        if (error) throw error;
        setSubjects(data || []);

        // Resolve initial subject ID
        const resolvedSubjectId =
          sampleQuestion?.subject_id ||
          sampleQuestion?.quizzes?.subject_id ||
          sampleQuestion?.sections?.subject_id ||
          sampleQuestion?.subjects?.id ||
          defaultSubjectId ||
          (data && data.length > 0 ? data[0].id : null);

        setCurrentSubjectId(resolvedSubjectId);
      } catch (err) {
        console.error("Error fetching subjects:", err);
      } finally {
        setSubjectsLoading(false);
      }
    };

    fetchSubjects();
  }, [isOpen, sampleQuestion, defaultSubjectId]);

  // Fetch quizzes for currentSubjectId across all relationship paths
  useEffect(() => {
    if (!isOpen || !user || !currentSubjectId) {
      setQuizzes([]);
      return;
    }

    const fetchSubjectQuizzes = async () => {
      try {
        setQuizzesLoading(true);

        const uniqueQuizzes = [];
        const seen = new Set();

        // 1. Quizzes directly assigned to subject
        const { data: subjectQuizzes, error: subjectError } = await supabase
          .from("quizzes")
          .select("id, title, description, duration, is_published, is_private, created_at, subject_id, instructor_id, is_archived")
          .eq("instructor_id", user.id)
          .eq("subject_id", currentSubjectId)
          .or("is_archived.is.null,is_archived.eq.false")
          .order("created_at", { ascending: false });

        if (!subjectError && subjectQuizzes) {
          subjectQuizzes.forEach((q) => {
            if (!q.is_archived && !seen.has(q.id)) {
              seen.add(q.id);
              uniqueQuizzes.push(q);
            }
          });
        }

        // 2. Sections belonging to this subject
        const { data: sectionsData } = await supabase
          .from("sections")
          .select("id")
          .eq("subject_id", currentSubjectId)
          .or("is_archived.is.null,is_archived.eq.false");

        if (sectionsData && sectionsData.length > 0) {
          const sectionIds = sectionsData.map((s) => s.id);

          // Junction table quiz_sections
          const { data: junctionQuizzes } = await supabase
            .from("quiz_sections")
            .select("quiz_id, quizzes(id, title, description, duration, is_published, is_private, created_at, subject_id, instructor_id, is_archived)")
            .in("section_id", sectionIds);

          junctionQuizzes?.forEach((jq) => {
            if (
              jq.quizzes &&
              jq.quizzes.instructor_id === user.id &&
              !jq.quizzes.is_archived &&
              !seen.has(jq.quizzes.id)
            ) {
              seen.add(jq.quizzes.id);
              uniqueQuizzes.push(jq.quizzes);
            }
          });

          // Direct section_id assignment
          const { data: directQuizzes } = await supabase
            .from("quizzes")
            .select("id, title, description, duration, is_published, is_private, created_at, subject_id, instructor_id, is_archived")
            .in("section_id", sectionIds)
            .or("is_archived.is.null,is_archived.eq.false");

          directQuizzes?.forEach((dq) => {
            if (dq.instructor_id === user.id && !dq.is_archived && !seen.has(dq.id)) {
              seen.add(dq.id);
              uniqueQuizzes.push(dq);
            }
          });
        }

        // 3. Fallback: if no subject-specific quizzes found, include unassigned quizzes owned by instructor
        if (uniqueQuizzes.length === 0) {
          const { data: allUserQuizzes } = await supabase
            .from("quizzes")
            .select("id, title, description, duration, is_published, is_private, created_at, subject_id, section_id, instructor_id, is_archived")
            .eq("instructor_id", user.id)
            .or("is_archived.is.null,is_archived.eq.false")
            .order("created_at", { ascending: false });

          if (allUserQuizzes && allUserQuizzes.length > 0) {
            allUserQuizzes.forEach((q) => {
              if (!q.is_archived && !seen.has(q.id)) {
                if (!q.subject_id || String(q.subject_id) === String(currentSubjectId)) {
                  seen.add(q.id);
                  uniqueQuizzes.push(q);
                }
              }
            });
          }
        }

        // Published quizzes are locked, so they can't receive questions
        const editableQuizzes = uniqueQuizzes
          .filter((q) => !q.is_published)
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        setQuizzes(editableQuizzes);
        if (editableQuizzes.length > 0) {
          setSelectedQuizId(editableQuizzes[0].id);
        } else {
          setSelectedQuizId("");
        }
      } catch (err) {
        console.error("Error fetching subject quizzes:", err);
        notify.error("Failed to load exams: " + err.message);
        setQuizzes([]);
      } finally {
        setQuizzesLoading(false);
      }
    };

    fetchSubjectQuizzes();
  }, [isOpen, user, currentSubjectId]);

  if (!isOpen) return null;

  const count = questionsToReuse.length;

  const currentSubjectObj = subjects.find((s) => String(s.id) === String(currentSubjectId));
  const currentSubjectName =
    currentSubjectObj?.name ||
    sampleQuestion?.subject_name ||
    sampleQuestion?.subjects?.name ||
    sampleQuestion?.quizzes?.subjects?.name ||
    "Selected Subject";

  const currentSubjectCode =
    currentSubjectObj?.code ||
    currentSubjectObj?.description ||
    sampleQuestion?.subjects?.code ||
    "";

  const handleAddToExistingQuiz = async (e) => {
    e.preventDefault();
    if (!selectedQuizId) {
      notify.warning("Please select a target exam.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: latestSub } = await supabase
        .from("quiz_analysis_submissions")
        .select("status")
        .eq("quiz_id", selectedQuizId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (REVIEW_LOCKED_STATUSES.includes(latestSub?.status)) {
        notify.error("This exam is in the review process and can't be changed.");
        return;
      }

      // Fetch existing questions for selectedQuizId to check duplicates
      const { data: existingTargetQuestions } = await supabase
        .from("questions")
        .select("id, text")
        .eq("quiz_id", selectedQuizId)
        .or("is_archived.is.null,is_archived.eq.false");

      const existingQuestionTexts = new Set(
        (existingTargetQuestions || []).map((q) => (q.text || "").toLowerCase().trim()).filter(Boolean)
      );

      const { data: existingJunctions } = await supabase
        .from("quiz_questions")
        .select("question_id, order_index, questions(text)")
        .eq("quiz_id", selectedQuizId);

      const existingQuestionIds = new Set(
        (existingJunctions || []).map((j) => j.question_id)
      );
      (existingJunctions || []).forEach((j) => {
        if (j.questions?.text) {
          existingQuestionTexts.add((j.questions.text || "").toLowerCase().trim());
        }
      });

      let maxOrder = 0;
      (existingJunctions || []).forEach((j) => {
        if (typeof j.order_index === "number" && j.order_index > maxOrder) {
          maxOrder = j.order_index;
        }
      });

      let addedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let lastError = null;
      for (let i = 0; i < questionsToReuse.length; i++) {
        const q = questionsToReuse[i];
        const normalizedText = (q.text || "").toLowerCase().trim();

        if (existingQuestionIds.has(q.id) || (normalizedText && existingQuestionTexts.has(normalizedText))) {
          skippedCount++;
          continue;
        }

        maxOrder++;
        
        const clonePayload = {
          quiz_id: selectedQuizId,
          type: q.type || "mcq",
          text: q.text,
          options: q.options || null,
          correct_answer: q.correct_answer,
          points: q.points || 1,
          is_archived: false,
          blooms_level: q.blooms_level || null,
          is_private: q.is_private !== false,
          subject_id: currentSubjectId || q.subject_id || null,
        };

        const { id: newQId, error: cloneErr } = await insertQuestionCopy(clonePayload);
        if (cloneErr || !newQId) {
          console.error("Failed to copy question:", cloneErr);
          lastError = cloneErr;
          failedCount++;
          continue;
        }

        await supabase.from("quiz_questions").insert({
          quiz_id: selectedQuizId,
          question_id: newQId,
          order_index: maxOrder,
        });
        existingQuestionIds.add(newQId);
        if (normalizedText) existingQuestionTexts.add(normalizedText);
        addedCount++;
      }

      const targetQuizObj = quizzes.find((qz) => qz.id === selectedQuizId);
      const quizTitleText = targetQuizObj ? `"${targetQuizObj.title}"` : "selected exam";

      if (failedCount > 0) {
        notify.error(
          `${failedCount} question(s) couldn't be added to ${quizTitleText}${lastError?.message ? `: ${lastError.message}` : "."}`,
        );
      }
      if (addedCount > 0) {
        notify.success(`Added ${addedCount} question(s) to ${quizTitleText}.${skippedCount > 0 ? ` ${skippedCount} duplicate(s) skipped.` : ""}`);
      } else if (skippedCount > 0 && failedCount === 0) {
        notify.info(`Question(s) are already in ${quizTitleText}. No duplicates were added.`);
      }

      // Keep the modal open on total failure so the user can retry
      if (addedCount === 0 && failedCount > 0) return;

      if (onSuccess) onSuccess(selectedQuizId, addedCount);
      onClose();
    } catch (err) {
      console.error("Error reusing question(s):", err);
      notify.error("Failed to add question to exam: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNewQuizAndAdd = async (e) => {
    e.preventDefault();
    if (!newQuizTitle.trim()) {
      notify.warning("Exam title is required.");
      return;
    }
    if (!currentSubjectId) {
      notify.error("Subject ID is missing. Please select a subject first.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the new quiz under currentSubjectId
      const { data: newQuiz, error: quizErr } = await supabase
        .from("quizzes")
        .insert([
          {
            instructor_id: user.id,
            subject_id: currentSubjectId,
            title: newQuizTitle.trim(),
            description: newQuizDescription.trim() || null,
            duration: newQuizDuration ? parseInt(newQuizDuration) : null,
            is_published: false,
            is_private: true,
          },
        ])
        .select()
        .single();

      if (quizErr) throw quizErr;
      if (!newQuiz) throw new Error("Failed to create new exam.");

      // 2. Clone questions to the new quiz
      let addedCount = 0;
      let lastError = null;
      for (let idx = 0; idx < questionsToReuse.length; idx++) {
        const q = questionsToReuse[idx];
        const clonePayload = {
          quiz_id: newQuiz.id,
          type: q.type || "mcq",
          text: q.text,
          options: q.options || null,
          correct_answer: q.correct_answer,
          points: q.points || 1,
          is_archived: false,
          blooms_level: q.blooms_level || null,
          is_private: q.is_private !== false,
          subject_id: currentSubjectId || q.subject_id || null,
        };

        const { id: newQId, error: cloneErr } = await insertQuestionCopy(clonePayload);
        if (cloneErr || !newQId) {
          console.error("Failed to copy question:", cloneErr);
          lastError = cloneErr;
          continue;
        }

        await supabase.from("quiz_questions").insert({
          quiz_id: newQuiz.id,
          question_id: newQId,
          order_index: idx,
        });
        addedCount++;
      }

      if (addedCount < count) {
        notify.error(
          `Created "${newQuiz.title}", but ${count - addedCount} question(s) couldn't be copied${lastError?.message ? `: ${lastError.message}` : "."}`,
        );
      } else {
        notify.success(`Created new exam "${newQuiz.title}" and added ${count} question(s).`);
      }

      if (onSuccess) onSuccess(newQuiz.id);
      onClose();

      // Navigate to the newly created quiz editor
      if (navigate) {
        const isPathAdmin = window.location.pathname.startsWith("/admin-dashboard");
        const editPath = isPathAdmin
          ? `/admin-dashboard/create-quiz/${newQuiz.id}`
          : `/instructor-dashboard/instructor-quiz/${newQuiz.id}`;
        navigate(editPath);
      }
    } catch (err) {
      console.error("Error creating new quiz with reused question(s):", err);
      notify.error("Failed to create exam: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10">
        {/* Header */}
        <div className="bg-brand-navy text-white p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gold block mb-0.5">
              Reuse Question Bank Items
            </span>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>Reuse Question{count > 1 ? "s" : ""} in Exam</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-gold text-brand-navy font-extrabold">
                {count} Selected
              </span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-base transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Subject Selection / Banner */}
        <div className="bg-indigo-50 border-b border-indigo-200 px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-indigo-900 font-semibold">
            <span>📖 Subject:</span>
            {subjects.length > 0 ? (
              <select
                value={currentSubjectId || ""}
                onChange={(e) => setCurrentSubjectId(e.target.value)}
                disabled={subjectsLoading}
                className="px-3 py-1 bg-white border border-indigo-300 text-indigo-900 font-bold rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-gold text-xs"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} {sub.code ? `(${sub.code})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="px-2.5 py-1 bg-white border border-indigo-300 text-indigo-800 font-bold rounded-md shadow-2xs">
                {currentSubjectName} {currentSubjectCode ? `(${currentSubjectCode})` : ""}
              </span>
            )}
          </div>
          <span className="text-[11px] text-indigo-700 italic">
            Questions can only be added to exams in the same subject.
          </span>
        </div>

        {/* Question Text Preview Box */}
        {sampleQuestion && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Preview {count > 1 ? `(1 of ${count})` : ""}:
            </span>
            <p className="font-bold text-slate-800 line-clamp-2">
              "{sampleQuestion.text}"
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab("existing")}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all ${
              activeTab === "existing"
                ? "border-brand-gold text-brand-navy bg-white shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            Add to Existing Exam ({quizzes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all ${
              activeTab === "new"
                ? "border-brand-gold text-brand-navy bg-white shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            + Create New Exam
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {activeTab === "existing" ? (
            <form onSubmit={handleAddToExistingQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Exam for {currentSubjectName}:
                </label>
                {quizzesLoading ? (
                  <div className="p-4 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
                    Loading subject exams...
                  </div>
                ) : quizzes.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <p className="text-xs font-bold text-amber-900">
                      No active exams found for {currentSubjectName}.
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1">
                      Switch to "+ Create New Exam" tab above to create a new exam for this subject.
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedQuizId}
                    onChange={(e) => setSelectedQuizId(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  >
                    {quizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} {q.is_published ? "(Published)" : "(Draft)"} - Created {new Date(q.created_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || quizzes.length === 0 || !selectedQuizId}
                  className="px-6 py-2.5 bg-brand-navy hover:bg-brand-navy/90 text-white text-xs font-extrabold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  {submitting ? "Adding..." : `Add ${count} Question${count > 1 ? "s" : ""} to Selected Exam`}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateNewQuizAndAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Exam Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Unit 1 Exam on Basic Concepts"
                  value={newQuizTitle}
                  onChange={(e) => setNewQuizTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Brief overview or instructions for students..."
                  value={newQuizDescription}
                  onChange={(e) => setNewQuizDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Duration in Minutes (Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 60"
                  value={newQuizDuration}
                  onChange={(e) => setNewQuizDuration(e.target.value)}
                  min={1}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newQuizTitle.trim()}
                  className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-xs font-extrabold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  {submitting ? "Creating & Adding..." : `Create Exam & Add ${count} Question${count > 1 ? "s" : ""}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
