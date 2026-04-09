import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { notify } from "../../utils/notify.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { SelectSubjectModal } from "../../components/SelectSubjectModal.jsx";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { QuizAnalysisResults } from "../../components/QuizAnalysisResults.jsx";

const QUESTION_TYPES = [{ value: "mcq", label: "Multiple Choice" }];
const NEW_QUIZ_DRAFT_KEY = "eduquest_new_quiz_draft";

export const InstructorQuiz = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { quizId } = useParams();
  const confirm = useConfirm();
  const { user: authUser } = useAuth();
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizDuration, setQuizDuration] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(quizId ? true : false);
  const [error, setError] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [shareToken, setShareToken] = useState("");
  const [showShareUrl, setShowShareUrl] = useState(false);
  const [showAddQuestionPopup, setShowAddQuestionPopup] = useState(false);
  const [questionCount, setQuestionCount] = useState(1);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [saveSectionsLoading, setSaveSectionsLoading] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [userId, setUserId] = useState(null);
  const [returnToQuizzesAfterAssign, setReturnToQuizzesAfterAssign] =
    useState(false);
  const [returnFilter, setReturnFilter] = useState("approved");
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [quizReviewStatus, setQuizReviewStatus] = useState(null);
  const [revisionStatus, setRevisionStatus] = useState(null);
  const [revisionOverallFeedback, setRevisionOverallFeedback] = useState("");
  const [revisionQuestionFeedbackById, setRevisionQuestionFeedbackById] =
    useState({});
  const [revisionQuestionFeedbackByText, setRevisionQuestionFeedbackByText] =
    useState({});
  const [revisionQuestionFeedbackByIndex, setRevisionQuestionFeedbackByIndex] =
    useState({});
  const revisionOfSubmissionId =
    location.state?.revisionOfSubmissionId || null;

  const isApprovedStatus =
    quizReviewStatus === "approved" ||
    quizReviewStatus === "faculty_head_approved";
  const isReviewLocked =
    quizReviewStatus === "pending" ||
    quizReviewStatus === "faculty_head_review";
  const isEditingDisabled = isPublished || isReviewLocked || isApprovedStatus;

  const normalizeQuestionText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  // Archive subject modal state
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [questionToArchive, setQuestionToArchive] = useState(null);

  const toggleQuestion = (questionId) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };
  const autoSaveTimer = useRef(null);
  const initialLoadDone = useRef(false);

  // Track unsaved changes after initial load
  const markDirty = useCallback(() => {
    if (initialLoadDone.current) {
      setHasUnsavedChanges(true);
    }
  }, []);

  // On mount for new quizzes, auto-restore draft from localStorage
  useEffect(() => {
    if (quizId) return;
    try {
      const saved = localStorage.getItem(NEW_QUIZ_DRAFT_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved);
      const hasDraft = draft.title || draft.questions?.length > 0;
      if (!hasDraft) return;

      if (draft.title) setQuizTitle(draft.title);
      if (draft.description) setQuizDescription(draft.description);
      if (draft.duration) setQuizDuration(draft.duration);
      if (draft.questions?.length > 0) {
        setQuestions(draft.questions);
        setExpandedQuestions(new Set(draft.questions.map((q) => q.id)));
      }
      setShowDraftBanner(true);
    } catch {
      // ignore parse errors
    }
  }, [quizId]);

  const discardDraft = () => {
    localStorage.removeItem(NEW_QUIZ_DRAFT_KEY);
    setQuizTitle("");
    setQuizDescription("");
    setQuizDuration("");
    setQuestions([]);
    setShowDraftBanner(false);
  };

  // Ref to always hold the latest draft data for the beforeunload handler
  const draftDataRef = useRef(null);
  useEffect(() => {
    if (!quizId) {
      draftDataRef.current = {
        title: quizTitle,
        description: quizDescription,
        duration: quizDuration,
        questions,
      };
    }
  }, [quizId, quizTitle, quizDescription, quizDuration, questions]);

  // Save draft to localStorage immediately on tab close / browser crash
  useEffect(() => {
    if (quizId) return;

    const handleBeforeUnload = () => {
      const data = draftDataRef.current;
      if (data && (data.title || data.questions.length > 0)) {
        try {
          localStorage.setItem(NEW_QUIZ_DRAFT_KEY, JSON.stringify(data));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [quizId]);

  // Auto-save draft to localStorage immediately on every change (no debounce)
  useEffect(() => {
    if (quizId) return;
    if (!quizTitle && questions.length === 0) return;

    try {
      localStorage.setItem(
        NEW_QUIZ_DRAFT_KEY,
        JSON.stringify({
          title: quizTitle,
          description: quizDescription,
          duration: quizDuration,
          questions,
        }),
      );
      setLastSaved(new Date());
    } catch {
      // ignore storage errors
    }
  }, [quizId, quizTitle, quizDescription, quizDuration, questions]);

  // Auto-save every 30 seconds when there are unsaved changes
  useEffect(() => {
    if (!quizId || isEditingDisabled || !hasUnsavedChanges) return;

    autoSaveTimer.current = setTimeout(async () => {
      if (!quizTitle.trim()) return;
      try {
        await supabase
          .from("quizzes")
          .update({
            title: quizTitle,
            description: quizDescription || null,
            duration: quizDuration ? parseInt(quizDuration) : null,
          })
          .eq("id", quizId);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 30000);

    return () => clearTimeout(autoSaveTimer.current);
  }, [
    hasUnsavedChanges,
    quizTitle,
    quizDescription,
    quizDuration,
    quizId,
    isEditingDisabled,
  ]);

  useEffect(() => {
    loadSections();
    if (quizId) {
      loadQuiz();
    } else {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    if (location.state?.openSections) {
      setReturnToQuizzesAfterAssign(Boolean(location.state?.returnToQuizzes));
      setReturnFilter(location.state?.returnFilter || "approved");
      setShowSectionModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const saveSectionAssignments = async () => {
    if (!quizId) return;

    setSaveSectionsLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from("quiz_sections")
        .delete()
        .eq("quiz_id", quizId);

      if (deleteError) throw deleteError;

      if (selectedSectionIds.length > 0) {
        const sectionInserts = selectedSectionIds.map((sectionId) => ({
          quiz_id: quizId,
          section_id: sectionId,
        }));

        const { error: insertError } = await supabase
          .from("quiz_sections")
          .insert(sectionInserts);

        if (insertError) throw insertError;
      }

      const { error: updateError } = await supabase
        .from("quizzes")
        .update({ section_id: selectedSectionIds[0] || null })
        .eq("id", quizId);

      if (updateError) throw updateError;
    } finally {
      setSaveSectionsLoading(false);
    }
  };

  const handleCloseSectionModal = async () => {
    try {
      await saveSectionAssignments();
      setShowSectionModal(false);

      if (returnToQuizzesAfterAssign) {
        navigate("/instructor-dashboard/quizzes", {
          state: { filter: returnFilter || "approved" },
        });
      }
    } catch (err) {
      console.error("Failed to save section assignments:", err);
      notify.error("Failed to save section assignments: " + err.message);
    }
  };

  const loadSections = async () => {
    try {
      if (!authUser) return;
      setUserId(authUser.id);
      const { data } = await supabase
        .from("sections")
        .select("*")
        .eq("instructor_id", authUser.id)
        .eq("is_archived", false);
      if (data) setAvailableSections(data);
    } catch (e) {
      console.error("Failed to load sections", e);
    }
  };

  const loadQuiz = async () => {
    try {
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();

      if (quizError) throw quizError;
      if (!quiz) throw new Error("Quiz not found");

      const { data: latestSubmission } = await supabase
        .from("quiz_analysis_submissions")
        .select("status")
        .eq("quiz_id", quizId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Check if this quiz or any related quiz (parent/child) has been approved
      const approvedStatuses = ["approved", "faculty_head_approved"];
      let isApproved = approvedStatuses.includes(latestSubmission?.status);
      if (!isApproved && quiz.parent_quiz_id) {
        const { data: parentApproved } = await supabase
          .from("quiz_analysis_submissions")
          .select("status")
          .eq("quiz_id", quiz.parent_quiz_id)
          .in("status", approvedStatuses)
          .limit(1)
          .maybeSingle();
        if (parentApproved) isApproved = true;
      }
      if (!isApproved) {
        // Check if any child revision quiz has been approved
        const { data: childQuizzes } = await supabase
          .from("quizzes")
          .select("id")
          .eq("parent_quiz_id", quizId);
        if (childQuizzes && childQuizzes.length > 0) {
          const childIds = childQuizzes.map((c) => c.id);
          const { data: childApproved } = await supabase
            .from("quiz_analysis_submissions")
            .select("status")
            .in("quiz_id", childIds)
            .in("status", approvedStatuses)
            .limit(1)
            .maybeSingle();
          if (childApproved) isApproved = true;
        }
      }

      // Check for revision feedback across all versions in the quiz chain
      let latestRevisionSubmission = null;
      if (!isApproved) {
        // Collect all quiz IDs in the version chain
        const chainQuizIds = [quizId];
        if (quiz.parent_quiz_id) {
          chainQuizIds.push(quiz.parent_quiz_id);
          // Also include sibling versions (other revisions of the same parent)
          const { data: siblingQuizzes } = await supabase
            .from("quizzes")
            .select("id")
            .eq("parent_quiz_id", quiz.parent_quiz_id)
            .neq("id", quizId);
          if (siblingQuizzes) {
            chainQuizIds.push(...siblingQuizzes.map((q) => q.id));
          }
        }

        // Find the most recent revision feedback across the entire chain
        const { data: chainRevisionSub } = await supabase
          .from("quiz_analysis_submissions")
          .select("status, admin_feedback, question_feedback, analysis_results")
          .in("quiz_id", chainQuizIds)
          .in("status", ["revision_requested"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        latestRevisionSubmission = chainRevisionSub;
      }

      setQuizTitle(quiz.title?.replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "") || "");
      setQuizDescription(quiz.description || "");
      setQuizDuration(quiz.duration || "");
      setIsPublished(quiz.is_published || false);
      setQuizReviewStatus(isApproved ? "approved" : (latestSubmission?.status || null));

      if (latestRevisionSubmission) {
        const qf = latestRevisionSubmission.question_feedback || {};
        const snapshots =
          latestRevisionSubmission.analysis_results?.questionSnapshots || [];
        const analysisItems =
          latestRevisionSubmission.analysis_results?.analysis || [];

        const feedbackByText = {};
        const feedbackByIndex = {};

        // Use questionSnapshots for mapping (preserves original order via orderIndex)
        if (snapshots.length > 0) {
          snapshots.forEach((snap) => {
            const fb = qf[snap.questionId];
            if (!fb) return;
            const textKey = normalizeQuestionText(snap.questionText);
            if (textKey && !feedbackByText[textKey]) {
              feedbackByText[textKey] = fb;
            }
            if (snap.orderIndex != null) {
              feedbackByIndex[snap.orderIndex] = fb;
            }
          });
        } else {
          // Fallback for older submissions without snapshots
          analysisItems.forEach((item, idx) => {
            const fb = qf[item.questionId];
            if (!fb) return;
            const textKey = normalizeQuestionText(item.questionText);
            if (textKey && !feedbackByText[textKey]) {
              feedbackByText[textKey] = fb;
            }
            feedbackByIndex[idx] = fb;
          });
        }

        setRevisionStatus(latestRevisionSubmission.status);
        setRevisionOverallFeedback(
          latestRevisionSubmission.admin_feedback || "",
        );
        setRevisionQuestionFeedbackById(qf);
        setRevisionQuestionFeedbackByText(feedbackByText);
        setRevisionQuestionFeedbackByIndex(feedbackByIndex);
      } else {
        setRevisionStatus(null);
        setRevisionOverallFeedback("");
        setRevisionQuestionFeedbackById({});
        setRevisionQuestionFeedbackByText({});
        setRevisionQuestionFeedbackByIndex({});
      }

      setShareToken(quiz.share_token || "");

      const { data: qsData, error: qsError } = await supabase
        .from("quiz_sections")
        .select("section_id")
        .eq("quiz_id", quizId);
      if (!qsError && qsData && qsData.length > 0) {
        setSelectedSectionIds(qsData.map((d) => d.section_id));
      } else if (quiz.section_id) {
        setSelectedSectionIds([quiz.section_id]); // fallback for old data
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("created_at", { ascending: true });

      if (questionsError) throw questionsError;

      const transformedQuestions = questionsData.map((q) => {
        let correctAnswerValue;
        if (q.type === "mcq") {
          correctAnswerValue = q.options.indexOf(q.correct_answer);
        } else if (q.type === "true_false") {
          correctAnswerValue = q.correct_answer === "true" ? 0 : 1;
        } else {
          correctAnswerValue = q.correct_answer;
        }
        return {
          id: q.id,
          type: q.type,
          text: q.text,
          options: q.type === "mcq" ? q.options : [""],
          correctAnswer: correctAnswerValue,
          points: q.points || 1,
        };
      });

      setQuestions(transformedQuestions);
      setTimeout(() => {
        initialLoadDone.current = true;
      }, 100);
    } catch (err) {
      setError(err.message || "Failed to load quiz");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    if (isEditingDisabled) return;
    setQuestionCount(1);
    setShowAddQuestionPopup(true);
  };

  const getQuestionRevisionFeedback = (question, index) => {
    return (
      revisionQuestionFeedbackById[String(question.id)] ||
      revisionQuestionFeedbackByText[normalizeQuestionText(question.text)] ||
      revisionQuestionFeedbackByIndex[index] ||
      ""
    );
  };

  const addMultipleQuestions = (count) => {
    if (isEditingDisabled) return;
    const newQuestions = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      type: "mcq",
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      points: 1,
    }));
    // Auto-expand new questions
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      newQuestions.forEach((q) => next.add(q.id));
      return next;
    });
    setQuestions([...questions, ...newQuestions]);
    setShowAddQuestionPopup(false);
  };

  const updateQuestion = (id, field, value) => {
    if (isEditingDisabled) return;
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)),
    );
  };

  const updateOption = (questionId, optionIndex, value) => {
    if (isEditingDisabled) return;
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((opt, idx) =>
                idx === optionIndex ? value : opt,
              ),
            }
          : q,
      ),
    );
  };

  const addOption = (questionId) => {
    if (isEditingDisabled) return;
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, ""] } : q,
      ),
    );
  };

  const removeOption = (questionId, optionIndex) => {
    if (isEditingDisabled) return;
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((_, idx) => idx !== optionIndex) }
          : q,
      ),
    );
  };

  const generateShareToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 12; i++) {
      // Increased length for better uniqueness
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      notify.success("URL copied to clipboard!");
    });
  };

  const archiveQuestion = async (id) => {
    if (isEditingDisabled) return;
    setDeletingQuestionId(id);

    // If it's a new question (temp ID from Date.now()), just remove from state
    if (typeof id === "number" && id > 10000000000) {
      setQuestions(questions.filter((q) => q.id !== id));
      setDeletingQuestionId(null);
      return;
    }

    // If it's a saved question from database, show subject selection modal
    const questionToArchiveItem = questions.find((q) => q.id === id);
    if (questionToArchiveItem) {
      setQuestionToArchive(questionToArchiveItem);
      setShowSubjectModal(true);
    }
    setDeletingQuestionId(null);
  };

  // Handle subject selection for archiving
  const handleArchiveWithSubject = async (sectionId) => {
    if (!questionToArchive) return;

    try {
      const updateData = {
        is_archived: true,
        updated_at: new Date().toISOString(),
      };

      if (sectionId) {
        updateData.section_id = sectionId;
      }

      const { error } = await supabase
        .from("questions")
        .update(updateData)
        .eq("id", questionToArchive.id);

      if (error) throw error;

      // Remove from local state for instant UI feedback
      setQuestions((prevQuestions) =>
        prevQuestions.filter((q) => q.id !== questionToArchive.id),
      );
      notify.success(
        "Question archived to Question Bank! You can restore it from there.",
      );

      setShowSubjectModal(false);
      setQuestionToArchive(null);
    } catch (err) {
      console.error("Error archiving question:", err);
      notify.error("Error archiving question: " + err.message);
    }
  };

  const handleSaveQuiz = async (publish = false, silent = false) => {
    if (quizId && isReviewLocked) {
      notify.error("This quiz is under review and can only be viewed.");
      return false;
    }

    setError("");

    if (!quizTitle.trim()) {
      notify.error("Quiz title is required");
      return;
    }

    if (publish && questions.length === 0) {
      notify.error("Add at least one question before publishing");
      return;
    }

    for (let q of questions) {
      if (!q.text.trim()) {
        notify.error("All questions must have text");
        return;
      }
      if (
        q.type === "mcq" &&
        q.options.filter((opt) => opt.trim()).length < 2
      ) {
        notify.error(
          publish
            ? "MCQ questions must have at least 2 options to publish"
            : "Warning: MCQ questions should have at least 2 options",
        );
        if (publish) return;
      }
    }

    setLoading(true);
    try {
      if (!authUser) {
        notify.error("User not authenticated");
        setLoading(false);
        return;
      }

      let quizData;
      let newToken = shareToken;

      if (quizId) {
        // Always generate a new share token when publishing, even if one exists
        if (publish) {
          newToken = generateShareToken();
        }

        const { data, error: updateError } = await supabase
          .from("quizzes")
          .update({
            title: quizTitle,
            description: quizDescription || null,
            duration: quizDuration ? parseInt(quizDuration) : null,
            is_published: publish || isPublished,
            share_token: publish ? newToken : shareToken || null,
          })
          .eq("id", quizId)
          .select();

        if (updateError) throw updateError;
        quizData = data[0];

        const { data: existingQuestions } = await supabase
          .from("questions")
          .select("id")
          .eq("quiz_id", quizId);
        const existingQuestionIds = new Set(
          existingQuestions?.map((q) => q.id) || [],
        );

        for (const q of questions) {
          if (existingQuestionIds.has(q.id)) {
            const { error: updateQuestionError } = await supabase
              .from("questions")
              .update({
                text: q.text,
                options:
                  q.type === "mcq"
                    ? q.options.filter((opt) => opt.trim())
                    : null,
                correct_answer:
                  q.type === "mcq"
                    ? q.options[q.correctAnswer]
                    : q.type === "true_false"
                      ? q.correctAnswer === 0
                        ? "true"
                        : "false"
                      : q.correctAnswer,
                points: q.points,
              })
              .eq("id", q.id);
            if (updateQuestionError) throw updateQuestionError;
          }
        }

        const questionsToAdd = questions
          .filter((q) => !existingQuestionIds.has(q.id))
          .map((q) => ({
            quiz_id: quizData.id,
            type: q.type,
            text: q.text,
            options:
              q.type === "mcq" ? q.options.filter((opt) => opt.trim()) : null,
            correct_answer:
              q.type === "mcq"
                ? q.options[q.correctAnswer]
                : q.type === "true_false"
                  ? q.correctAnswer === 0
                    ? "true"
                    : "false"
                  : q.correctAnswer,
            points: q.points,
          }));

        if (questionsToAdd.length > 0) {
          const { error: questionsError } = await supabase
            .from("questions")
            .insert(questionsToAdd);
          if (questionsError) throw questionsError;

          // Refresh questions so temporary client IDs are replaced with DB IDs.
          // This prevents re-inserting the same questions on subsequent saves/submissions.
          await loadQuiz();
        }
      } else {
        newToken = publish ? generateShareToken() : null;

        const { data: newQuiz, error: quizError } = await supabase
          .from("quizzes")
          .insert([
            {
              instructor_id: authUser.id,
              section_id: selectedSectionIds[0] || null,
              title: quizTitle,
              description: quizDescription || null,
              duration: quizDuration ? parseInt(quizDuration) : null,
              is_published: publish,
              share_token: newToken,
            },
          ])
          .select();

        if (quizError) throw quizError;
        if (!newQuiz || newQuiz.length === 0)
          throw new Error("Failed to create quiz");
        quizData = newQuiz[0];

        if (questions.length > 0) {
          const questionsData = questions.map((q) => ({
            quiz_id: quizData.id,
            type: q.type,
            text: q.text,
            options:
              q.type === "mcq" ? q.options.filter((opt) => opt.trim()) : null,
            correct_answer:
              q.type === "mcq"
                ? q.options[q.correctAnswer]
                : q.type === "true_false"
                  ? q.correctAnswer === 0
                    ? "true"
                    : "false"
                  : q.correctAnswer,
            points: q.points,
          }));
          const { error: questionsError } = await supabase
            .from("questions")
            .insert(questionsData);
          if (questionsError) throw questionsError;
        }
      }

      // Sync the many-to-many relationship in quiz_sections
      if (quizData) {
        try {
          const { error: deleteError } = await supabase
            .from("quiz_sections")
            .delete()
            .eq("quiz_id", quizData.id);

          // If no error deleting (meaning table exists)
          if (!deleteError && selectedSectionIds.length > 0) {
            const sectionInserts = selectedSectionIds.map((sId) => ({
              quiz_id: quizData.id,
              section_id: sId,
            }));
            await supabase.from("quiz_sections").insert(sectionInserts);
          }
        } catch (tableError) {
          console.warn("quiz_sections table might not exist yet:", tableError);
        }

        await supabase
          .from("quizzes")
          .update({
            section_id:
              selectedSectionIds.length > 0 ? selectedSectionIds[0] : null,
          })
          .eq("id", quizData.id);
      }

      if (newToken) setShareToken(newToken);

      // Clear the new-quiz localStorage draft once successfully saved
      localStorage.removeItem(NEW_QUIZ_DRAFT_KEY);

      if (publish) {
        setShowShareUrl(true);
        notify.success("Quiz published! Share URL generated.");
      } else if (!silent) {
        notify.success("Draft saved!");
        setTimeout(() => {
          navigate("/instructor-dashboard/quizzes");
        }, 1000);
      }
      return true;
    } catch (err) {
      notify.error(err.message || "Failed to save quiz");
      console.error(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
          <p className="mt-4 text-brand-navy font-semibold">Loading quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white">
      {/* Hero Banner */}
      <div className="bg-brand-navy px-6 py-5">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate("/instructor-dashboard/quizzes")}
            className="text-white/80 hover:text-white font-semibold text-sm transition-colors flex items-center gap-1"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Quizzes
          </button>
          <span className="text-white/40">/</span>
          <span className="text-white/70 text-sm">
            {quizId ? "Edit Quiz" : "New Quiz"}
          </span>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {quizTitle || (quizId ? "Untitled Quiz" : "Create Quiz")}
            </h1>
            <p className="text-white/70 text-sm mt-1">
              {quizId
                ? isPublished
                  ? "Published quiz — view results or manage questions"
                  : isApprovedStatus
                    ? "Approved — you can now publish this quiz"
                    : isReviewLocked
                      ? "Submitted for review — view only until Senior Faculty decision"
                      : "Draft — add questions and submit for review when ready"
                : "Set up your quiz and start adding questions"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-save indicator */}
            {!quizId && lastSaved && (
              <span className="text-white/60 text-xs flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-green-300" />
                Draft auto-saved{" "}
                {lastSaved.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            {quizId && !isEditingDisabled && (
              <span className="text-white/60 text-xs flex items-center gap-1.5">
                {hasUnsavedChanges ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-yellow-300 animate-pulse" />
                    Unsaved changes
                  </>
                ) : lastSaved ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-green-300" />
                    Saved{" "}
                    {lastSaved.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </>
                ) : null}
              </span>
            )}
            {quizId && (
              <span
                className={`px-3 py-1.5 rounded-full font-bold text-xs ${
                  isPublished
                    ? "bg-white/20 text-white"
                    : isApprovedStatus
                      ? "bg-green-400/90 text-green-900"
                      : "bg-yellow-400/90 text-yellow-900"
                }`}
              >
                {isPublished ? "Published" : isApprovedStatus ? "Approved" : "Draft"}
              </span>
            )}
          </div>
        </div>

        {quizId && isReviewLocked && (
          <div className="mt-4 px-4 py-2 bg-yellow-100 border border-yellow-300 rounded-lg text-sm text-yellow-800 font-semibold">
            This quiz is currently under review and cannot be edited.
          </div>
        )}
        {quizId && isApprovedStatus && !isPublished && (
          <div className="mt-4 px-4 py-2 bg-green-100 border border-green-300 rounded-lg text-sm text-green-800 font-semibold">
            This quiz has been approved! You can now publish it to make it available to students.
          </div>
        )}

        {/* Quick action buttons for published quizzes */}
        {quizId && isPublished && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() =>
                navigate(
                  selectedSectionIds.length > 0
                    ? `/instructor-dashboard/quiz-results/${quizId}?section=${selectedSectionIds[0]}`
                    : `/instructor-dashboard/quiz-results/${quizId}`,
                )
              }
              className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              View Results
            </button>
            <button
              onClick={() =>
                navigate(`/instructor-dashboard/question-bank/${quizId}`)
              }
              className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Question Bank
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
        {showDraftBanner && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-400 rounded-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-yellow-600 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-yellow-800 font-semibold text-sm">
                Draft restored — your previous progress has been recovered.
              </span>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setShowDraftBanner(false)}
                className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 px-4 py-1.5 rounded-lg font-semibold text-sm transition-colors"
              >
                OK
              </button>
              <button
                onClick={discardDraft}
                className="bg-white hover:bg-gray-100 text-gray-600 border border-gray-300 px-4 py-1.5 rounded-lg font-semibold text-sm transition-colors"
              >
                Start Fresh
              </button>
            </div>
          </div>
        )}
        {(showShareUrl || isPublished) && shareToken && (
          <div className="mb-6 p-6 bg-brand-navy/5 border-2 border-brand-navy/20 rounded-lg">
            <h3 className="text-lg font-bold text-brand-navy mb-3 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-green-600"
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
              Quiz Published Successfully!
            </h3>
            <p className="text-gray-700 mb-4">
              Share the link for each subject with the corresponding students:
            </p>
            {selectedSectionIds.length > 0 ? (
              <div className="space-y-3">
                {selectedSectionIds.map((sId) => {
                  const sec = availableSections.find((s) => s.id === sId);
                  const sectionUrl = `${window.location.origin}/quiz/${shareToken}?section=${sId}`;
                  return (
                    <div key={sId}>
                      <p className="text-xs font-semibold text-gray-500 mb-1">
                        {sec?.section_name || sec?.name || sId}
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={sectionUrl}
                          readOnly
                          className="flex-1 px-4 py-3 bg-white border border-brand-navy/20 rounded-lg font-mono text-sm"
                        />
                        <button
                          onClick={() => copyToClipboard(sectionUrl)}
                          className="bg-brand-gold hover:bg-brand-gold-dark text-brand-navy px-6 py-3 rounded-lg font-semibold transition"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}/quiz/${shareToken}`}
                  readOnly
                  className="flex-1 px-4 py-3 bg-white border border-brand-navy/20 rounded-lg font-mono text-sm"
                />
                <button
                  onClick={() =>
                    copyToClipboard(
                      `${window.location.origin}/quiz/${shareToken}`,
                    )
                  }
                  className="bg-brand-gold hover:bg-brand-gold-dark text-brand-navy px-6 py-3 rounded-lg font-semibold transition"
                >
                  Copy Link
                </button>
              </div>
            )}
            <p className="text-sm text-gray-600 mt-3 bg-white p-3 rounded border border-gray-200">
              <strong>Share Code:</strong>{" "}
              <code className="bg-gray-100 px-2 py-1 rounded font-mono">
                {shareToken}
              </code>
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-brand-navy mb-4">
            Quiz Information
          </h2>

          {quizReviewStatus !== "approved" && quizReviewStatus !== "faculty_head_approved" &&
            (revisionOverallFeedback ||
              Object.keys(revisionQuestionFeedbackById).length > 0) && (
            <div
              className="mb-4 px-4 py-3 border rounded-lg bg-orange-50 border-orange-200"
            >
              <p className="text-sm font-bold text-orange-700">
                Senior Faculty Revision Feedback
              </p>
              {revisionOverallFeedback && (
                <p className="text-sm mt-1 text-orange-800">

                  {revisionOverallFeedback}
                </p>
              )}
              {!revisionOverallFeedback && (
                <p className="text-xs mt-1 text-gray-600">
                  See question-level comments below.
                </p>
              )}
            </div>
          )}

          {isEditingDisabled && (
            <div className="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 font-semibold">
              🔒 This quiz is view-only right now.
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Quiz Title *
              </label>
              <input
                required
                type="text"
                value={quizTitle}
                onChange={(e) => {
                  setQuizTitle(e.target.value);
                  markDirty();
                }}
                placeholder="e.g., Biology Chapter 5 Test"
                disabled={isEditingDisabled}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 ${isEditingDisabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description / Instructions
              </label>
              <textarea
                value={quizDescription}
                onChange={(e) => {
                  setQuizDescription(e.target.value);
                  markDirty();
                }}
                placeholder="Enter quiz instructions or description for students (optional)"
                disabled={isEditingDisabled}
                rows={3}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 resize-none ${isEditingDisabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Duration (minutes)
              </label>
              <input
                required
                type="number"
                value={quizDuration}
                onChange={(e) => {
                  setQuizDuration(e.target.value);
                  markDirty();
                }}
                placeholder="Leave blank for unlimited"
                disabled={isEditingDisabled}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 ${isEditingDisabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
              />
            </div>
          </div>
        </div>

        {showAddQuestionPopup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-[340px]">
              <h3 className="text-lg font-bold text-brand-navy mb-4">
                How many questions do you want to add?
              </h3>
              <input
                type="number"
                min="1"
                max="100"
                value={questionCount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setQuestionCount("");
                  } else {
                    setQuestionCount(
                      Math.max(1, Math.min(100, parseInt(val) || 1)),
                    );
                  }
                }}
                onBlur={() => {
                  if (questionCount === "" || questionCount < 1)
                    setQuestionCount(1);
                }}
                autoFocus
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 mb-4 text-center text-lg"
              />
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    addMultipleQuestions(parseInt(questionCount) || 1)
                  }
                  className="flex-1 bg-brand-gold text-brand-navy py-2 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors"
                >
                  Add {parseInt(questionCount) || 1} Question
                  {(parseInt(questionCount) || 1) > 1 ? "s" : ""}
                </button>
                <button
                  onClick={() => setShowAddQuestionPopup(false)}
                  className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section Selection Modal */}
        {showSectionModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                handleCloseSectionModal();
              }}
            />
            <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-bold text-gray-800 mb-1">
                Assign to Subjects
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Select which subjects this quiz should appear in.
              </p>

              {availableSections.length === 0 ? (
                <div className="text-sm text-gray-500 py-4 text-center">
                  No sections available. Create one first!
                </div>
              ) : (
                <>
                  {/* Select All */}
                  <label className="flex items-center gap-3 border-b border-gray-200 pb-3 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        selectedSectionIds.length === availableSections.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSectionIds(
                            availableSections.map((s) => s.id),
                          );
                        } else {
                          setSelectedSectionIds([]);
                        }
                      }}
                      disabled={isEditingDisabled}
                      className="form-checkbox h-4 w-4 text-brand-gold-dark border-gray-300 rounded"
                    />
                    <span className="text-sm font-semibold text-gray-800">
                      Select All
                    </span>
                    <span className="ml-auto text-xs text-gray-400">
                      {selectedSectionIds.length}/{availableSections.length}
                    </span>
                  </label>

                  {/* Section List */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {availableSections.map((sec) => (
                      <label
                        key={sec.id}
                        className={`flex items-center gap-3 border p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedSectionIds.includes(sec.id)
                            ? "border-brand-gold bg-brand-gold/10"
                            : "border-gray-200 hover:bg-gray-50"
                        } ${isEditingDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSectionIds.includes(sec.id)}
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedSectionIds([
                                ...selectedSectionIds,
                                sec.id,
                              ]);
                            else
                              setSelectedSectionIds(
                                selectedSectionIds.filter(
                                  (id) => id !== sec.id,
                                ),
                              );
                          }}
                          disabled={isEditingDisabled}
                          className="form-checkbox h-4 w-4 text-brand-gold-dark border-gray-300 rounded"
                        />
                        <div>
                          <span className="block text-sm font-medium text-gray-800">
                            {sec.section_name || sec.name || "Untitled Section"}
                          </span>
                          {sec.description && (
                            <span className="block text-xs text-gray-500">
                              {sec.description}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleCloseSectionModal()}
                  disabled={saveSectionsLoading}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveSectionsLoading ? "Saving..." : "Done"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-brand-navy">
                Questions ({questions.length})
              </h2>
            </div>
            {!isEditingDisabled && (
              <div className="flex gap-2">
                <button
                  onClick={addQuestion}
                  className="bg-brand-gold text-brand-navy px-4 py-2 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors text-sm"
                >
                  + Add Question
                </button>
              </div>
            )}
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500 mb-4">No questions added yet</p>
              {!isEditingDisabled && (
                <button
                  onClick={addQuestion}
                  className="bg-brand-gold text-brand-navy px-6 py-2 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors"
                >
                  Add First Question
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question, idx) => {
                const questionFeedback = getQuestionRevisionFeedback(
                  question,
                  idx,
                );
                return (
                  <div
                    key={question.id}
                    className="border-2 border-gray-200 rounded-lg p-5 hover:border-brand-gold transition-colors"
                  >
                    {/* Collapsible header */}
                    <div
                      className="flex justify-between items-center cursor-pointer select-none"
                      onClick={() => toggleQuestion(question.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expandedQuestions.has(question.id) ? "rotate-90" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-800 truncate">
                          {idx + 1}.{" "}
                          {question.text || (
                            <span className="text-gray-400 italic">
                              Untitled question
                            </span>
                          )}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-xs text-gray-400 uppercase">
                          {question.type === "mcq"
                            ? "MCQ"
                            : question.type === "true_false"
                              ? "T/F"
                              : question.type}
                        </span>
                        <span className="text-xs bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded-full font-semibold">
                          {question.points || 1} pt
                          {(question.points || 1) > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Expandable content */}
                    {expandedQuestions.has(question.id) && (
                      <div className="mt-4">
                        {questionFeedback && quizReviewStatus !== "approved" && quizReviewStatus !== "faculty_head_approved" && (
                          <div
                            className="mb-4 p-3 border rounded-lg bg-orange-50 border-orange-200"
                          >
                            <p className="text-xs font-semibold mb-1 text-orange-700">
                              Senior Faculty Feedback on this question:
                            </p>
                            <p className="text-sm text-orange-800">

                              {questionFeedback}
                            </p>
                          </div>
                        )}

                        {!isEditingDisabled && (
                          <div className="flex justify-end gap-2 mb-4">
                            <button
                              onClick={async (e) => {
                                e.preventDefault();
                                const confirmed = await confirm({
                                  title: "Archive Question",
                                  message:
                                    "Archive this question to Question Bank? You can restore it later.",
                                  confirmText: "Archive",
                                  cancelText: "Cancel",
                                  variant: "warning",
                                });
                                if (confirmed) {
                                  archiveQuestion(question.id).catch((err) =>
                                    console.error(
                                      "Failed to archive question:",
                                      err,
                                    ),
                                  );
                                }
                              }}
                              disabled={deletingQuestionId === question.id}
                              className={`${deletingQuestionId === question.id ? "text-gray-400 cursor-not-allowed" : "text-yellow-600 hover:text-yellow-800"} text-sm font-semibold px-3 py-1 transition-colors`}
                            >
                              {deletingQuestionId === question.id ? (
                                "..."
                              ) : (
                                <>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3.5 w-3.5 inline mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                                    />
                                  </svg>
                                  Archive
                                </>
                              )}
                            </button>
                            <button
                              onClick={async (e) => {
                                e.preventDefault();
                                const confirmed = await confirm({
                                  title: "Remove Question",
                                  message:
                                    "Remove this question permanently? This cannot be undone.",
                                  confirmText: "Remove",
                                  cancelText: "Cancel",
                                  variant: "danger",
                                });
                                if (confirmed) {
                                  if (
                                    typeof question.id === "number" &&
                                    question.id > 10000000000
                                  ) {
                                    setQuestions(
                                      questions.filter(
                                        (q) => q.id !== question.id,
                                      ),
                                    );
                                  } else {
                                    supabase
                                      .from("questions")
                                      .delete()
                                      .eq("id", question.id)
                                      .then(({ error }) => {
                                        if (error) {
                                          console.error("Delete error:", error);
                                          notify.error(
                                            "Remove failed: " + error.message,
                                          );
                                        } else {
                                          setQuestions(
                                            questions.filter(
                                              (q) => q.id !== question.id,
                                            ),
                                          );
                                        }
                                      });
                                  }
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-sm font-semibold px-3 py-1 transition-colors"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5 inline mr-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Remove
                            </button>
                          </div>
                        )}

                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Question Text *
                          </label>
                          <textarea
                            value={question.text}
                            onChange={(e) =>
                              updateQuestion(
                                question.id,
                                "text",
                                e.target.value,
                              )
                            }
                            placeholder="Enter the question"
                            rows="2"
                            disabled={isEditingDisabled}
                            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 ${isEditingDisabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "cursor-text"}`}
                          />
                        </div>

                        {question.type === "mcq" && (
                          <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Options *
                            </label>
                            <div className="space-y-2">
                              {question.options.map((option, optIdx) => (
                                <div
                                  key={optIdx}
                                  className="flex gap-2 items-center"
                                >
                                  <input
                                    type="radio"
                                    name={`correct-${question.id}`}
                                    checked={question.correctAnswer === optIdx}
                                    onChange={() =>
                                      updateQuestion(
                                        question.id,
                                        "correctAnswer",
                                        optIdx,
                                      )
                                    }
                                    disabled={isEditingDisabled}
                                    className="mt-0.5"
                                  />
                                  <span className="text-sm font-semibold text-gray-500 w-5">
                                    ({String.fromCharCode(97 + optIdx)})
                                  </span>
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) =>
                                      updateOption(
                                        question.id,
                                        optIdx,
                                        e.target.value,
                                      )
                                    }
                                    placeholder={`Option ${String.fromCharCode(97 + optIdx)}`}
                                    disabled={isEditingDisabled}
                                    className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold ${isEditingDisabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "cursor-text"}`}
                                  />
                                  {!isEditingDisabled &&
                                    question.options.length > 2 && (
                                      <button
                                        onClick={() =>
                                          removeOption(question.id, optIdx)
                                        }
                                        className="text-red-500 hover:text-red-700 px-3 py-2"
                                      >
                                        ✕
                                      </button>
                                    )}
                                </div>
                              ))}
                            </div>
                            {!isEditingDisabled && (
                              <button
                                onClick={() => addOption(question.id)}
                                className="text-sm text-brand-gold-dark font-semibold mt-2 hover:text-brand-navy"
                              >
                                + Add Option
                              </button>
                            )}
                          </div>
                        )}

                        {question.type === "true_false" && (
                          <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Correct Answer *
                            </label>
                            <div className="flex gap-4">
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`tf-${question.id}`}
                                  checked={question.correctAnswer === 0}
                                  onChange={() =>
                                    updateQuestion(
                                      question.id,
                                      "correctAnswer",
                                      0,
                                    )
                                  }
                                  disabled={isEditingDisabled}
                                  className="mr-2"
                                />
                                <span className="text-gray-700">True</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`tf-${question.id}`}
                                  checked={question.correctAnswer === 1}
                                  onChange={() =>
                                    updateQuestion(
                                      question.id,
                                      "correctAnswer",
                                      1,
                                    )
                                  }
                                  disabled={isEditingDisabled}
                                  className="mr-2"
                                />
                                <span className="text-gray-700">False</span>
                              </label>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Points
                          </label>
                          <input
                            type="number"
                            value={question.points}
                            onChange={(e) =>
                              updateQuestion(
                                question.id,
                                "points",
                                Math.max(1, parseInt(e.target.value) || 1),
                              )
                            }
                            disabled={isEditingDisabled}
                            min="1"
                            className={`w-20 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold ${isEditingDisabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-8">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Primary Actions */}
            {!isEditingDisabled && (
              <>
                <button
                  onClick={() => {
                    handleSaveQuiz(false);
                    setHasUnsavedChanges(false);
                    setLastSaved(new Date());
                  }}
                  disabled={loading}
                  className="bg-brand-gold hover:bg-brand-gold-dark text-brand-navy px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  {loading ? "Saving..." : "Save as Draft"}
                </button>

                <button
                  onClick={async () => {
                    if (quizId) {
                      const hasUnsaved = questions.some(
                        (q) => typeof q.id === "number" && q.id > 10000000000,
                      );
                      if (hasUnsaved) {
                        const saved = await handleSaveQuiz(false, true);
                        if (!saved) return;
                      }
                    }
                    setShowAnalysisModal(true);
                  }}
                  disabled={
                    questions.length === 0 ||
                    questions.some((q) => !q.text.trim())
                  }
                  className="bg-brand-navy hover:bg-brand-indigo text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    questions.length === 0
                      ? "Add questions first"
                      : "Analyze questions with AI and submit for Senior Faculty review"
                  }
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
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  Submit for Review
                </button>
              </>
            )}

            {/* Divider between primary and secondary */}
            {!isEditingDisabled && quizId && (
              <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block" />
            )}

            {/* Secondary Actions */}
            {quizId && !isEditingDisabled && (
              <button
                onClick={() =>
                  navigate(`/instructor-dashboard/question-bank/${quizId}`)
                }
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                Question Bank
              </button>
            )}

            {/* Publish button for approved quizzes */}
            {quizId && isApprovedStatus && !isPublished && (
              <button
                onClick={() => handleSaveQuiz(true)}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {loading ? "Publishing..." : "Publish Quiz"}
              </button>
            )}

            {/* Right-aligned navigation */}
            <div className="ml-auto">
              <button
                onClick={() => navigate("/instructor-dashboard/quizzes")}
                className="text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors"
              >
                {quizId ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* end .p-6 wrapper */}

      {/* Bloom's Taxonomy Analysis Modal */}
      {showAnalysisModal && (
        <QuizAnalysisResults
          quizId={quizId || "draft"}
          quizTitle={quizTitle}
          questions={questions.filter((q) => q.text.trim())}
          instructorId={userId}
          previousSubmissionId={revisionOfSubmissionId}
          onBeforeSubmitReview={async () => {
            if (!quizId) return false;
            return await handleSaveQuiz(false, true);
          }}
          onClose={() => setShowAnalysisModal(false)}
        />
      )}

      {/* Archive Subject Selection Modal */}
      <SelectSubjectModal
        isOpen={showSubjectModal}
        onClose={() => {
          setShowSubjectModal(false);
          setQuestionToArchive(null);
        }}
        onConfirm={handleArchiveWithSubject}
        questionText={questionToArchive?.text}
      />
    </div>
  );
};
