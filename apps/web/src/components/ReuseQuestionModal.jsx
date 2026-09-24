import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { notify } from "../utils/notify.jsx";

/**
 * ReuseQuestionModal
 * Allows instructors to retrieve/reuse questions directly from Question Bank
 * into an existing or newly created quiz within the same subject.
 */
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

        // Sort newest first
        uniqueQuizzes.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        setQuizzes(uniqueQuizzes);
        if (uniqueQuizzes.length > 0) {
          setSelectedQuizId(uniqueQuizzes[0].id);
        } else {
          setSelectedQuizId("");
        }
      } catch (err) {
        console.error("Error fetching subject quizzes:", err);
        notify.error("Failed to load quizzes: " + err.message);
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
      notify.warning("Please select a target quiz.");
      return;
    }

    setSubmitting(true);
    try {
      // Fetch existing order_index max for selected quiz
      const { data: existingJunctions } = await supabase
        .from("quiz_questions")
        .select("question_id, order_index")
        .eq("quiz_id", selectedQuizId);

      const existingQuestionIds = new Set(
        (existingJunctions || []).map((j) => j.question_id)
      );

      let maxOrder = 0;
      (existingJunctions || []).forEach((j) => {
        if (typeof j.order_index === "number" && j.order_index > maxOrder) {
          maxOrder = j.order_index;
        }
      });

      let addedCount = 0;
      for (let i = 0; i < questionsToReuse.length; i++) {
        const q = questionsToReuse[i];
        maxOrder++;
        
        const isPriv = q.is_private === false || q.blooms_level === "public" ? false : true;
        const clonePayload = {
          quiz_id: selectedQuizId,
          instructor_id: user?.id || null,
          type: q.type || "mcq",
          text: q.text,
          options: q.options || null,
          correct_answer: q.correct_answer,
          points: q.points || 1,
          is_archived: false,
          blooms_level: isPriv ? "private" : "public",
          is_private: isPriv,
          subject_id: currentSubjectId || q.subject_id || null,
        };

        let { data: newCloneData, error: cloneErr } = await supabase
          .from("questions")
          .insert(clonePayload)
          .select();

        if (cloneErr) {
          delete clonePayload.is_private;
          delete clonePayload.instructor_id;
          const retry = await supabase.from("questions").insert(clonePayload).select();
          newCloneData = retry.data;
        }

        const newQId = newCloneData?.[0]?.id;
        if (newQId) {
          await supabase.from("quiz_questions").insert({
            quiz_id: selectedQuizId,
            question_id: newQId,
            order_index: maxOrder,
          });
          addedCount++;
        }
      }

      const targetQuizObj = quizzes.find((qz) => qz.id === selectedQuizId);
      const quizTitleText = targetQuizObj ? `"${targetQuizObj.title}"` : "selected quiz";

      if (addedCount > 0) {
        notify.success(`Successfully added ${addedCount} question(s) to ${quizTitleText}!`);
      }

      if (onSuccess) onSuccess(selectedQuizId);
      onClose();
    } catch (err) {
      console.error("Error reusing question(s):", err);
      notify.error("Failed to add question to quiz: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNewQuizAndAdd = async (e) => {
    e.preventDefault();
    if (!newQuizTitle.trim()) {
      notify.warning("Quiz title is required.");
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
      if (!newQuiz) throw new Error("Failed to create new quiz.");

      // 2. Clone questions to the new quiz
      for (let idx = 0; idx < questionsToReuse.length; idx++) {
        const q = questionsToReuse[idx];
        const isPriv = q.is_private === false || q.blooms_level === "public" ? false : true;
        const clonePayload = {
          quiz_id: newQuiz.id,
          instructor_id: user?.id || null,
          type: q.type || "mcq",
          text: q.text,
          options: q.options || null,
          correct_answer: q.correct_answer,
          points: q.points || 1,
          is_archived: false,
          blooms_level: isPriv ? "private" : "public",
          is_private: isPriv,
          subject_id: currentSubjectId || q.subject_id || null,
        };

        let { data: newCloneData, error: cloneErr } = await supabase
          .from("questions")
          .insert(clonePayload)
          .select();

        if (cloneErr) {
          delete clonePayload.is_private;
          delete clonePayload.instructor_id;
          const retry = await supabase.from("questions").insert(clonePayload).select();
          newCloneData = retry.data;
        }

        const newQId = newCloneData?.[0]?.id;
        if (newQId) {
          await supabase.from("quiz_questions").insert({
            quiz_id: newQuiz.id,
            question_id: newQId,
            order_index: idx,
          });
        }
      }

      notify.success(`Created new quiz "${newQuiz.title}" and added ${count} question(s)!`);

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
      notify.error("Failed to create quiz: " + err.message);
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
              <span>Reuse Question{count > 1 ? "s" : ""} in Quiz</span>
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
            Questions can only be added to quizzes in the same subject.
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
            Add to Existing Quiz ({quizzes.length})
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
            + Create New Quiz
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {activeTab === "existing" ? (
            <form onSubmit={handleAddToExistingQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Quiz for {currentSubjectName}:
                </label>
                {quizzesLoading ? (
                  <div className="p-4 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
                    Loading subject quizzes...
                  </div>
                ) : quizzes.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <p className="text-xs font-bold text-amber-900">
                      No active quizzes found for {currentSubjectName}.
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1">
                      Switch to "+ Create New Quiz" tab above to create a new quiz for this subject.
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
                  {submitting ? "Adding..." : `Add ${count} Question${count > 1 ? "s" : ""} to Selected Quiz`}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateNewQuizAndAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quiz Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Unit 1 Quiz on Basic Concepts"
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
                  {submitting ? "Creating & Adding..." : `Create Quiz & Add ${count} Question${count > 1 ? "s" : ""}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
