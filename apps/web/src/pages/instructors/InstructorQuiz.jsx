import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { SelectSubjectModal } from "../../components/SelectSubjectModal.jsx";
import { supabase } from "../../supabaseClient.js";
import { QuizAnalysisResults } from "../../components/QuizAnalysisResults.jsx";
import { QuizRevisionHistory } from "../../components/container/quiz/QuizRevisionHistory.jsx";
import { logAudit } from "../../services/auditService.js";
import { ImportQuestionBankModal } from "../../components/ImportQuestionBankModal.jsx";

const QUESTION_TYPES = [{ value: "mcq", label: "Multiple Choice" }];

const transformQuestions = (rows) => {
  const seenIds = new Set();
  const seenTexts = new Set();
  const uniqueRows = (rows || []).filter((q) => {
    if (!q || !q.id) return false;
    const normalizedText = (q.text || "").toLowerCase().trim();
    if (seenIds.has(q.id)) return false;
    if (normalizedText && seenTexts.has(normalizedText)) return false;
    seenIds.add(q.id);
    if (normalizedText) seenTexts.add(normalizedText);
    return true;
  });

  return uniqueRows.map((q) => {
    let correctAnswerValue;
    if (q.type === "mcq") {
      correctAnswerValue = Array.isArray(q.options)
        ? q.options.indexOf(q.correct_answer)
        : 0;
      if (correctAnswerValue === -1) correctAnswerValue = 0;
    } else if (q.type === "true_false") {
      correctAnswerValue = q.correct_answer === "true" ? 0 : 1;
    } else {
      correctAnswerValue = q.correct_answer;
    }
    return {
      id: q.id,
      type: q.type,
      text: q.text,
      options: q.type === "mcq" && Array.isArray(q.options)
        ? q.options
        : [""],
      correctAnswer: correctAnswerValue,
      points: q.points || 1,
    };
  });
};

export const InstructorQuiz = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { quizId } = useParams();
  const confirm = useConfirm();
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizDuration, setQuizDuration] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(quizId ? true : false);
  const [error, setError] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [saveStatus, setSaveStatus] = useState("");
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [shareToken, setShareToken] = useState("");
  const [showShareUrl, setShowShareUrl] = useState(false);
  const [sectionShareTokens, setSectionShareTokens] = useState([]);
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
  const [parentQuizId, setParentQuizId] = useState(null);
  const [restoredFromSnapshot, setRestoredFromSnapshot] = useState(0);
  const [crossSectionSource, setCrossSectionSource] = useState(null);
  const [crossSectionSourceQuiz, setCrossSectionSourceQuiz] = useState(null);
  const [autoSharing, setAutoSharing] = useState(false);

  // Question Bank import modal state
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTargetIndex, setBankTargetIndex] = useState(null);

  const handleImportFromBank = (importedQuestion) => {
    if (bankTargetIndex !== null && bankTargetIndex >= 0 && bankTargetIndex < questions.length) {
      const updated = [...questions];
      const targetId = updated[bankTargetIndex].id;
      updated[bankTargetIndex] = {
        ...importedQuestion,
        id: targetId,
      };
      setQuestions(updated);
      setExpandedQuestions(new Set([...expandedQuestions, targetId]));
      markDirty();
      toast.success(`Question #${bankTargetIndex + 1} updated from Question Bank!`);
    } else {
      const newQuestionObj = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        ...importedQuestion,
      };
      setQuestions([...questions, newQuestionObj]);
      setExpandedQuestions(new Set([...expandedQuestions, newQuestionObj.id]));
      markDirty();
      toast.success("New question imported from Question Bank!");
    }
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImportCSVFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result;
        if (!content) return;

        let parsedItems = [];

        if (file.name.toLowerCase().endsWith(".json")) {
          let json = JSON.parse(content);
          if (!Array.isArray(json)) {
            json = json.questions || json.data || json.items || [json];
          }
          parsedItems = json;
        } else {
          const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
          if (lines.length < 2) {
            toast.error("CSV file must have a header row and at least one question row.");
            return;
          }
          const headers = parseCSVLine(lines[0]).map((h) =>
            h.toLowerCase().trim().replace(/^"|"$/g, "")
          );

          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            const rowObj = {};
            headers.forEach((h, idx) => {
              let val = cols[idx] ?? "";
              if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1).replace(/""/g, '"');
              }
              rowObj[h] = val;
            });
            parsedItems.push(rowObj);
          }
        }

        const newQuestions = [];
        const now = Date.now();

        parsedItems.forEach((raw, idx) => {
          const text =
            raw.text ||
            raw.question ||
            raw.question_text ||
            raw["question text"] ||
            raw.item_text ||
            "";

          if (!text || String(text).trim() === "") return;

          let type = (raw.type || raw.question_type || "mcq").toString().toLowerCase().trim();
          if (!["mcq", "true_false", "identification"].includes(type)) type = "mcq";

          const points = parseInt(raw.points || raw.weight || raw.score || 1) || 1;

          // Process options
          let options = [];
          if (Array.isArray(raw.options)) {
            options = raw.options.map((o) => String(o).trim());
          } else {
            for (let k = 1; k <= 6; k++) {
              const optVal =
                raw[`option_${k}`] ||
                raw[`option ${k}`] ||
                raw[`option${k}`] ||
                raw[String.fromCharCode(64 + k).toLowerCase()] ||
                raw[String.fromCharCode(64 + k)];
              if (optVal !== undefined && optVal !== null && String(optVal).trim() !== "") {
                options.push(String(optVal).trim());
              }
            }
          }

          if (type === "mcq") {
            while (options.length < 4) {
              options.push("");
            }
          } else if (type === "true_false") {
            options = ["True", "False"];
          }

          // Determine correct answer
          let rawCorrect =
            raw.correct_answer ??
            raw.correct ??
            raw["correct answer"] ??
            raw.answer ??
            0;

          let correctAnswer = 0;
          if (typeof rawCorrect === "number") {
            correctAnswer = rawCorrect;
          } else if (typeof rawCorrect === "string") {
            const trimmed = rawCorrect.trim();
            if (/^[A-F]$/i.test(trimmed)) {
              correctAnswer = trimmed.toUpperCase().charCodeAt(0) - 65;
            } else if (!isNaN(parseInt(trimmed))) {
              correctAnswer = parseInt(trimmed);
            } else {
              const matchedIdx = options.findIndex(
                (opt) => String(opt).trim().toLowerCase() === trimmed.toLowerCase()
              );
              if (matchedIdx !== -1) correctAnswer = matchedIdx;
            }
          }

          newQuestions.push({
            id: now + idx + Math.floor(Math.random() * 1000),
            type,
            text: String(text).trim(),
            options,
            correctAnswer: Math.max(0, Math.min(correctAnswer, options.length - 1)),
            points,
            difficulty: raw.difficulty || null,
            blooms_level: raw.blooms_level || raw.blooms || null,
          });
        });

        if (newQuestions.length === 0) {
          toast.error("No valid questions found in the CSV file.");
          return;
        }

        setQuestions((prev) => {
          const updated = [...prev, ...newQuestions];
          const newTotalPages = Math.ceil(updated.length / QUESTIONS_PER_PAGE);
          setCurrentPage(newTotalPages);
          return updated;
        });

        setExpandedQuestions((prev) => {
          const next = new Set(prev);
          newQuestions.forEach((q) => next.add(q.id));
          return next;
        });

        markDirty();
        toast.success(`Successfully imported ${newQuestions.length} question(s) from CSV!`);
      } catch (err) {
        console.error("CSV import error:", err);
        toast.error("Failed to parse CSV file: " + err.message);
      } finally {
        if (e.target) e.target.value = "";
      }
    };

    reader.readAsText(file);
  };

  // Archive subject modal state
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [questionToArchive, setQuestionToArchive] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const QUESTIONS_PER_PAGE = 10;
  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages || 1);
  const startIndex = (validCurrentPage - 1) * QUESTIONS_PER_PAGE;
  const endIndex = startIndex + QUESTIONS_PER_PAGE;
  const paginatedQuestions = questions.slice(startIndex, endIndex);

  const renderPageButtons = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (validCurrentPage > 3) {
        pages.push("...");
      }
      const start = Math.max(2, validCurrentPage - 1);
      const end = Math.min(totalPages - 1, validCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (validCurrentPage < totalPages - 2) {
        pages.push("...");
      }
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    return pages.map((page, i) => {
      if (page === "...") {
        return (
          <span key={`dots-${i}`} className="px-2 text-sm text-gray-400 select-none">
            ...
          </span>
        );
      }
      return (
        <button
          key={page}
          type="button"
          onClick={() => setCurrentPage(page)}
          className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors ${
            validCurrentPage === page
              ? "bg-brand-gold text-brand-navy font-bold shadow-sm"
              : "border border-gray-200 hover:bg-gray-50 text-gray-600"
          }`}
        >
          {page}
        </button>
      );
    });
  };

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

  // Auto-save every 30 seconds when there are unsaved changes
  useEffect(() => {
    if (!quizId || isPublished || !hasUnsavedChanges) return;

    autoSaveTimer.current = setTimeout(async () => {
      if (!quizTitle.trim()) return;
      try {
        await supabase
          .from("quizzes")
          .update({
            title: quizTitle,
            description: quizDescription || null,
            duration: quizDuration ? parseInt(quizDuration) : null,
            is_private: isPrivate,
          })
          .eq("id", quizId);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 30000);

    return () => clearTimeout(autoSaveTimer.current);
  }, [hasUnsavedChanges, quizTitle, quizDescription, quizDuration, quizId, isPublished, isPrivate]);

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

        const { data: insertedSections, error: insertError } = await supabase
          .from("quiz_sections")
          .insert(sectionInserts)
          .select();

        if (insertError) throw insertError;

        // Update section share tokens state
        if (insertedSections) {
          const { data: sectionTokens } = await supabase
            .from("quiz_sections")
            .select("share_token, section_id, sections(*)")
            .eq("quiz_id", quizId);
          
          if (sectionTokens) {
            setSectionShareTokens(sectionTokens);
          }
        }
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
      toast.error("Failed to save section assignments: " + err.message);
    }
  };

  const handleAutoShareWithSubjectSections = async () => {
    if (!quizId) return;
    
    setAutoSharing(true);
    try {
      const { data, error } = await supabase.rpc("auto_share_quiz_with_subject_sections", {
        p_quiz_id: quizId
      });
      
      if (error) throw error;
      
      toast.success(`Quiz shared with ${data || 0} section(s)`);
      
      // Reload sections and tokens
      loadQuiz();
    } catch (err) {
      console.error("Auto-share failed:", err);
      toast.error("Failed to auto-share quiz: " + err.message);
    } finally {
      setAutoSharing(false);
    }
  };

  const loadSections = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: mySections } = await supabase
        .from("sections")
        .select("*")
        .eq("instructor_id", user.id);

      const subjectIds = Array.from(
        new Set((mySections || []).map((s) => s.subject_id).filter(Boolean))
      );

      let allSections = mySections || [];
      if (subjectIds.length > 0) {
        const { data: subjectSections } = await supabase
          .from("sections")
          .select("*")
          .in("subject_id", subjectIds)
          .eq("is_archived", false);

        if (subjectSections && subjectSections.length > 0) {
          const sectionMap = new Map();
          [...allSections, ...subjectSections].forEach((s) =>
            sectionMap.set(s.id, s)
          );
          allSections = Array.from(sectionMap.values());
        }
      }

      setAvailableSections(allSections);
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

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (quiz.is_private !== false && currentUser?.id && quiz.instructor_id !== currentUser.id) {
        toast.error("Permission denied: This quiz is private and can only be accessed by its owner.");
        navigate("/instructor-dashboard/quizzes");
        return;
      }

      setQuizTitle(quiz.title);
      setQuizDescription(quiz.description || "");
      setQuizDuration(quiz.duration || "");
      setIsPublished(quiz.is_published || false);
      setIsPrivate(quiz.is_private !== false);
      setShareToken(quiz.share_token || "");
      setParentQuizId(quiz.parent_quiz_id || null);

      // Load section-specific share tokens
      if (quizId) {
        console.log("Loading section tokens for quiz:", quizId);

        // Auto-share with any new sections in the same subject
        try {
          await supabase.rpc("auto_share_quiz_with_subject_sections", {
            p_quiz_id: quizId,
          });
        } catch (e) {
          console.warn("Auto-share on load skipped:", e);
        }

        const { data: sectionTokens, error: tokenError } = await supabase
          .from("quiz_sections")
          .select("share_token, section_id, sections(*)")
          .eq("quiz_id", quizId);
        
        console.log("Section tokens loaded:", sectionTokens);
        console.log("Token error:", tokenError);
        console.log("Number of sections:", sectionTokens?.length || 0);
        
        if (sectionTokens && sectionTokens.length > 0) {
          setSectionShareTokens(sectionTokens);
          
          // Check if any sections are missing tokens
          const missingTokens = sectionTokens.filter(st => !st.share_token);
          console.log("Sections missing tokens:", missingTokens);
          
          if (missingTokens.length > 0) {
            console.log("Generating tokens for sections without tokens...");
            const { error: genError } = await supabase.rpc("generate_share_tokens_for_quiz", {
              p_quiz_id: quizId
            });
            
            console.log("Token generation error:", genError);
            
            if (!genError) {
              // Reload tokens after generation
              const { data: newTokens } = await supabase
                .from("quiz_sections")
                .select("share_token, section_id, sections(*)")
                .eq("quiz_id", quizId);
              
              console.log("New tokens after generation:", newTokens);
              
              if (newTokens) {
                setSectionShareTokens(newTokens);
              }
            }
          }
        } else {
          console.log("No section tokens found. Quiz might not be assigned to sections.");
        }
      }

      const { data: qsData, error: qsError } = await supabase
        .from("quiz_sections")
        .select("section_id, sections(*)")
        .eq("quiz_id", quizId);
      
      console.log("Quiz sections data:", qsData);
      console.log("Quiz sections error:", qsError);
      
      if (!qsError && qsData && qsData.length > 0) {
        setSelectedSectionIds(qsData.map((d) => d.section_id));
        console.log("Quiz assigned to sections:", qsData.map(d => d.sections?.name || d.section_id));
      } else if (quiz.section_id) {
        setSelectedSectionIds([quiz.section_id]); // fallback for old data
        console.log("Using fallback section_id:", quiz.section_id);
      }

      const isMissingTableErr = (err) => {
        if (!err) return false;
        const msg = (err.message || "").toLowerCase();
        const code = err.code || "";
        return (
          code === "42P01" ||
          msg.includes("could not find the table") ||
          msg.includes("does not exist") ||
          (msg.includes("relation") && msg.includes("does not exist"))
        );
      };

      const loadViaJunction = async (id) => {
        try {
          const { data, error } = await supabase
            .from("quiz_questions")
            .select("questions(*), order_index")
            .eq("quiz_id", id)
            .order("order_index", { ascending: true });
          if (isMissingTableErr(error) || error) return null;
          if (!data || data.length === 0) {
            return { source: "junction-empty", rows: [] };
          }
          const rows = data
            .map((r) => r.questions)
            .filter(
              (q) =>
                q !== null &&
                (q.is_archived === null || q.is_archived === false),
            );
          return { source: "junction", rows };
        } catch {
          return null;
        }
      };

      const loadDirect = async (id) => {
        const { data, error } = await supabase
          .from("questions")
          .select("*")
          .eq("quiz_id", id)
          .or("is_archived.is.null,is_archived.eq.false")
          .order("created_at", { ascending: true });
        if (error) return null;
        return { source: "direct", rows: data || [] };
      };

      let resolved = null;

      resolved = await loadViaJunction(quizId);
      if (!resolved || resolved.rows.length === 0) {
        const direct = await loadDirect(quizId);
        if (direct && (resolved === null || direct.rows.length > 0)) {
          resolved = direct;
        }
      }

      if (!resolved || resolved.rows.length === 0) {
        if (quiz.parent_quiz_id) {
          const parentViaJunction = await loadViaJunction(quiz.parent_quiz_id);
          if (parentViaJunction && parentViaJunction.rows.length > 0) {
            resolved = parentViaJunction;
          } else {
            const parentDirect = await loadDirect(quiz.parent_quiz_id);
            if (parentDirect && parentDirect.rows.length > 0) {
              resolved = parentDirect;
            }
          }
        }
      }

      if (!resolved || resolved.rows.length === 0) {
        // Load questions from other quizzes in the same subject (cross-section sharing)
        try {
          const { data: instructorSubject } = await supabase
            .from("instructor_subjects")
            .select("subject_id")
            .eq("instructor_id", quiz.instructor_id)
            .limit(1)
            .maybeSingle();

          if (instructorSubject?.subject_id) {
            // Get all instructor_subject_ids for this subject
            const { data: instructorSubjectIds } = await supabase
              .from("instructor_subjects")
              .select("id")
              .eq("subject_id", instructorSubject.subject_id);

            const issIds = instructorSubjectIds?.map(iss => iss.id) || [];

            // Get all sections in the same subject
            const { data: subjectSections } = await supabase
              .from("instructor_subject_sections")
              .select("section_id")
              .in("instructor_subject_id", issIds);

            const sectionIds = subjectSections?.map(ss => ss.section_id) || [];

            // Get all quizzes from these sections (excluding current quiz)
            const { data: otherQuizzes } = await supabase
              .from("quiz_sections")
              .select("quiz_id")
              .in("section_id", sectionIds)
              .neq("quiz_id", quizId);

            const otherQuizIds = [...new Set(otherQuizzes?.map(oq => oq.quiz_id) || [])];

            // Try to load questions from these other quizzes
            for (const otherQuizId of otherQuizIds) {
              const otherQuizQuestions = await loadViaJunction(otherQuizId);
              if (otherQuizQuestions && otherQuizQuestions.rows.length > 0) {
                resolved = otherQuizQuestions;
                resolved._fromCrossSection = true;
                resolved._sourceQuizId = otherQuizId;
                setCrossSectionSource(otherQuizId);
                
                // Fetch the source quiz details
                const { data: sourceQuiz } = await supabase
                  .from("quizzes")
                  .select("title, instructor_id")
                  .eq("id", otherQuizId)
                  .single();
                
                if (sourceQuiz) {
                  setCrossSectionSourceQuiz(sourceQuiz);
                }
                
                console.log(`Loaded questions from cross-section quiz: ${otherQuizId}`);
                break;
              }
            }
          }
        } catch (crossSectionError) {
          console.error("Error loading cross-section questions:", crossSectionError);
        }
      }

      if (!resolved || resolved.rows.length === 0) {
        try {
          const { data: sub } = await supabase
            .from("quiz_analysis_submissions")
            .select("analysis_results")
            .eq("quiz_id", quizId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const snapshots =
            sub?.analysis_results?.questionSnapshots ||
            sub?.analysis_results?.analysis ||
            [];

          if (Array.isArray(snapshots) && snapshots.length > 0) {
            const restored = snapshots
              .slice()
              .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
              .map((snap) => {
                const qType = snap.type || "mcq";
                const isMCQ = qType === "mcq";
                const isTF = qType === "true_false";
                let rawOptions =
                  isMCQ && Array.isArray(snap.options) ? snap.options : [];
                while (isMCQ && rawOptions.length < 4) rawOptions.push("");
                rawOptions = rawOptions.filter(
                  (o, idx) =>
                    !isMCQ ||
                    idx < 4 ||
                    String(o || "").trim().length > 0,
                );
                if (isMCQ && rawOptions.length < 4) {
                  while (rawOptions.length < 4) rawOptions.push("");
                }

                let correctIdx = 0;
                const snapCorrect = snap.correctAnswer;
                if (isMCQ) {
                  if (typeof snapCorrect === "number") {
                    correctIdx = snapCorrect;
                  } else if (
                    typeof snapCorrect === "string" &&
                    rawOptions.length > 0
                  ) {
                    const matchIdx = rawOptions.findIndex(
                      (opt) =>
                        String(opt || "").toLowerCase() ===
                        String(snapCorrect || "").toLowerCase(),
                    );
                    if (matchIdx !== -1) correctIdx = matchIdx;
                  }
                } else if (isTF) {
                  correctIdx =
                    String(snapCorrect || "true").toLowerCase() === "true"
                      ? 0
                      : 1;
                }

                return {
                  id: `restored-${snap.questionId || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  type: isTF ? "true_false" : qType,
                  text: snap.questionText || snap.text || "",
                  options: isMCQ ? rawOptions : [""],
                  correctAnswer: isTF || isMCQ ? correctIdx : (snapCorrect ?? ""),
                  points: 1,
                  _restoredFromSnapshot: true,
                };
              });

            setQuestions(restored);
            setRestoredFromSnapshot(restored.length);
            setTimeout(() => {
              initialLoadDone.current = true;
            }, 100);
            return;
          }
        } catch (subErr) {
          console.warn(
            "[loadQuiz] Could not restore from analysis submission snapshot",
            subErr,
          );
        }
      }

      const finalRows = resolved?.rows || [];
      setQuestions(transformQuestions(finalRows));
      setTimeout(() => { initialLoadDone.current = true; }, 100);
    } catch (err) {
      setError(err.message || "Failed to load quiz");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    setQuestionCount(1);
    setShowAddQuestionPopup(true);
  };

  const addMultipleQuestions = (count) => {
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
    const updated = [...questions, ...newQuestions];
    setQuestions(updated);
    setShowAddQuestionPopup(false);
    const newTotalPages = Math.ceil(updated.length / QUESTIONS_PER_PAGE);
    setCurrentPage(newTotalPages);
  };

  const updateQuestion = (id, field, value) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)),
    );
  };

  const updateOption = (questionId, optionIndex, value) => {
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
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, ""] } : q,
      ),
    );
  };

  const removeOption = (questionId, optionIndex) => {
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
      setSaveStatus("URL copied to clipboard!");
      setTimeout(() => setSaveStatus(""), 2000);
    });
  };

  const archiveQuestion = async (id) => {
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
        updated_at: new Date().toISOString() 
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
      setQuestions((prevQuestions) => prevQuestions.filter((q) => q.id !== questionToArchive.id));
      toast.success(
        "Question archived to Question Bank! You can restore it from there.",
      );
      
      setShowSubjectModal(false);
      setQuestionToArchive(null);
    } catch (err) {
      console.error("Error archiving question:", err);
      toast.error("Error archiving question: " + err.message);
    }
  };

  const handleSaveQuiz = async (publish = false, redirectOnSave = true) => {
    setError("");
    setSaveStatus("Saving...");

    if (!quizTitle.trim()) {
      setError("Quiz title is required");
      setSaveStatus("");
      return false;
    }

    if (publish && questions.length === 0) {
      setError("Add at least one question before publishing");
      setSaveStatus("");
      return false;
    }

    for (let q of questions) {
      if (!q.text.trim()) {
        setError("All questions must have text");
        setSaveStatus("");
        return false;
      }
      if (
        q.type === "mcq" &&
        q.options.filter((opt) => opt.trim()).length < 2
      ) {
        setError(
          publish
            ? "MCQ questions must have at least 2 options to publish"
            : "Warning: MCQ questions should have at least 2 options",
        );
        if (publish) {
          setSaveStatus("");
          return false;
        }
      }
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("User not authenticated");
        setLoading(false);
        setSaveStatus("");
        return false;
      }

      let quizData;
      let newToken = shareToken;

      const formatCorrectAnswer = (q) => {
        if (q.type === "mcq") {
          const opts = (q.options || []).filter((opt) => opt && typeof opt === "string" && opt.trim());
          if (typeof q.correctAnswer === "number" && opts[q.correctAnswer]) {
            return opts[q.correctAnswer];
          }
          if (typeof q.correctAnswer === "string" && q.correctAnswer.trim()) {
            return q.correctAnswer.trim();
          }
          return opts[0] || "N/A";
        }
        if (q.type === "true_false") {
          return q.correctAnswer === 0 || q.correctAnswer === "true" || q.correctAnswer === true
            ? "true"
            : "false";
        }
        return String(q.correctAnswer || "N/A").trim() || "N/A";
      };

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
            is_private: isPrivate,
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
          if (typeof q.id !== "number" && existingQuestionIds.has(q.id)) {
            const { error: updateQuestionError } = await supabase
              .from("questions")
              .update({
                text: q.text,
                options:
                  q.type === "mcq"
                    ? (q.options || []).filter((opt) => opt && typeof opt === "string" && opt.trim())
                    : null,
                correct_answer: formatCorrectAnswer(q),
                points: q.points ? parseInt(q.points) : 1,
              })
              .eq("id", q.id);
            if (updateQuestionError) throw updateQuestionError;
          }
        }

        const baseSaveTime = Date.now();
        const questionsToAdd = questions
          .filter((q) => !existingQuestionIds.has(q.id))
          .map((q, idx) => ({
            quiz_id: quizData.id,
            section_id: selectedSectionIds[0] || null,
            type: q.type || "mcq",
            text: q.text,
            options:
              q.type === "mcq"
                ? (q.options || []).filter((opt) => opt && typeof opt === "string" && opt.trim())
                : null,
            correct_answer: formatCorrectAnswer(q),
            points: q.points ? parseInt(q.points) : 1,
            is_archived: false,
            created_at: new Date(baseSaveTime + idx * 100).toISOString(),
          }));

        if (questionsToAdd.length > 0) {
          const { error: questionsError } = await supabase
            .from("questions")
            .insert(questionsToAdd)
            .select();
          if (questionsError) {
            console.error("Error inserting new questions into database:", questionsError);
            throw questionsError;
          }
        }
      } else {
        newToken = publish ? generateShareToken() : null;

        const { data: newQuiz, error: quizError } = await supabase
          .from("quizzes")
          .insert([
            {
              instructor_id: user.id,
              section_id: selectedSectionIds[0] || null,
              title: quizTitle,
              description: quizDescription || null,
              duration: quizDuration ? parseInt(quizDuration) : null,
              is_published: publish,
              is_private: isPrivate,
              share_token: newToken,
            },
          ])
          .select();

        if (quizError) throw quizError;
        if (!newQuiz || newQuiz.length === 0)
          throw new Error("Failed to create quiz");
        quizData = newQuiz[0];

        // Log quiz creation in workflow history & audit log
        try {
          await supabase.rpc("log_quiz_status_change", {
            p_quiz_id: quizData.id,
            p_new_status: publish ? "published" : "draft",
            p_reason: publish ? "Quiz created and published live" : "Quiz created by instructor",
          });

          await logAudit({
            action: publish ? "QUIZ_PUBLISHED" : "QUIZ_CREATED",
            tableName: "quizzes",
            recordId: quizData.id,
            itemName: quizTitle,
            previousStatus: null,
            newStatus: publish ? "published" : "draft",
            reason: publish ? "Quiz created and published live" : "Quiz created by instructor",
          });
        } catch (hErr) {
          console.warn("Could not log quiz workflow history:", hErr);
        }

        if (questions.length > 0) {
          const baseCreateTime = Date.now();
          const questionsData = questions.map((q, idx) => ({
            quiz_id: quizData.id,
            section_id: selectedSectionIds[0] || null,
            type: q.type || "mcq",
            text: q.text,
            options:
              q.type === "mcq"
                ? (q.options || []).filter((opt) => opt && typeof opt === "string" && opt.trim())
                : null,
            correct_answer: formatCorrectAnswer(q),
            points: q.points ? parseInt(q.points) : 1,
            is_archived: false,
            created_at: new Date(baseCreateTime + idx * 100).toISOString(),
          }));
          const { error: questionsError } = await supabase
            .from("questions")
            .insert(questionsData)
            .select();
          if (questionsError) {
            console.error("Error inserting questions for new quiz into database:", questionsError);
            throw questionsError;
          }
        }

        navigate(`/instructor-dashboard/instructor-quiz/${quizData.id}`, { replace: true });
      }

      // Sync the many-to-many relationship in quiz_sections
      if (quizData) {
        try {
          const { error: deleteError } = await supabase
            .from("quiz_sections")
            .delete()
            .eq("quiz_id", quizData.id);

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

        try {
          const { data: allQuestions, error: qsFetchErr } = await supabase
            .from("questions")
            .select("*")
            .eq("quiz_id", quizData.id)
            .or("is_archived.is.null,is_archived.eq.false")
            .order("created_at", { ascending: true });

          if (!qsFetchErr && allQuestions && allQuestions.length > 0) {
            await supabase
              .from("quiz_questions")
              .delete()
              .eq("quiz_id", quizData.id);

            const junctionRows = allQuestions.map((q, idx) => ({
              quiz_id: quizData.id,
              question_id: q.id,
              order_index: idx,
            }));

            const { error: juncInsErr } = await supabase
              .from("quiz_questions")
              .insert(junctionRows);

            if (juncInsErr) {
              const msg = (juncInsErr.message || "").toLowerCase();
              const code = juncInsErr.code || "";
              const isMissingTable =
                code === "42P01" ||
                msg.includes("could not find the table") ||
                msg.includes("does not exist") ||
                (msg.includes("relation") && msg.includes("does not exist"));
              if (!isMissingTable) throw juncInsErr;
            }

            // Update React state with real database UUID questions
            setQuestions(transformQuestions(allQuestions));
          }
        } catch (junctionSyncErr) {
          console.warn(
            "quiz_questions sync skipped (table may not exist yet):",
            junctionSyncErr,
          );
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
      setRestoredFromSnapshot(0);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());

      if (publish) {
        setShowShareUrl(true);
        setSaveStatus("Quiz published! Share URL generated.");
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        setSaveStatus("Draft saved!");
        if (redirectOnSave) {
          setTimeout(() => {
            setSaveStatus("");
            navigate("/instructor-dashboard/quizzes");
          }, 1000);
        } else {
          setTimeout(() => setSaveStatus(""), 2000);
        }
      }

      if (!quizId && quizData?.id) {
        navigate(`/instructor-dashboard/quiz/${quizData.id}`, { replace: true });
      }
      return quizData || true;
    } catch (err) {
      setError(err.message || "Failed to save quiz");
      setSaveStatus("");
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
          <p className="mt-4 text-brand-navy font-semibold">
            Loading quiz...
          </p>
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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
                  : "Draft — add questions and submit for review when ready"
                : "Set up your quiz and start adding questions"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-save indicator */}
            {quizId && !isPublished && (
              <span className="text-white/60 text-xs flex items-center gap-1.5">
                {hasUnsavedChanges ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-yellow-300 animate-pulse" />
                    Unsaved changes
                  </>
                ) : lastSaved ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-green-300" />
                    Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </>
                ) : null}
              </span>
            )}
            {quizId && (
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1.5 rounded-full font-bold text-xs ${
                    isPrivate
                      ? "bg-gray-700/90 text-white border border-gray-600"
                      : "bg-emerald-600/90 text-white border border-emerald-500"
                  }`}
                >
                  {isPrivate ? "🔒 Private" : "🌐 Public"}
                </span>
                <span
                  className={`px-3 py-1.5 rounded-full font-bold text-xs ${
                    isPublished
                      ? "bg-white/20 text-white"
                      : "bg-yellow-400/90 text-yellow-900"
                  }`}
                >
                  {isPublished ? "Published" : "Draft"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick action buttons for published quizzes */}
        {quizId && isPublished && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() =>
                navigate(
                  selectedSectionIds.length > 0
                    ? `/instructor-dashboard/quiz-results/${quizId}?section=${selectedSectionIds[0]}`
                    : `/instructor-dashboard/quiz-results/${quizId}`
                )
              }
              className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Results
            </button>
            <button
              onClick={() =>
                navigate(`/instructor-dashboard/question-bank/${quizId}`)
              }
              className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Question Bank
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {saveStatus && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {saveStatus}
        </div>
      )}

      {(showShareUrl || isPublished) && (
        <div className="mb-6 p-6 bg-brand-navy/5 border-2 border-brand-navy/20 rounded-lg">
          <h3 className="text-lg font-bold text-brand-navy mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Quiz Published Successfully!
          </h3>
          <p className="text-gray-700 mb-4">
            Each section has its own unique share code. Share the corresponding code with each section:
          </p>
          
          {sectionShareTokens.length > 0 ? (
            <div className="space-y-3">
              {(() => {
                const userTokens = sectionShareTokens.filter(
                  (st) => st.sections?.instructor_id === userId
                );
                const tokensToDisplay = userTokens.length > 0 ? userTokens : sectionShareTokens;
                return tokensToDisplay.map((sectionToken) => {
                  const sectionUrl = `${window.location.origin}/quiz/${sectionToken.share_token}`;
                  return (
                    <div key={sectionToken.id || sectionToken.section_id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        {sectionToken.sections?.name || sectionToken.section_id}
                      </p>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={sectionUrl}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm"
                        />
                        <button
                          onClick={() => copyToClipboard(sectionUrl)}
                          className="bg-brand-gold hover:bg-brand-gold-dark text-brand-navy px-4 py-2 rounded-lg font-semibold transition text-sm"
                        >
                          Copy Link
                        </button>
                      </div>
                      <p className="text-xs text-gray-600">
                        <strong>Section Share Code:</strong>{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded font-mono">{sectionToken.share_token}</code>
                      </p>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-sm text-yellow-800 mb-3">
                No section-specific share codes available. Make sure the quiz is assigned to sections.
              </p>
              <button
                onClick={handleAutoShareWithSubjectSections}
                disabled={autoSharing}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold transition text-sm disabled:opacity-50"
              >
                {autoSharing ? "Sharing..." : "Auto-Share with Same Subject Sections"}
              </button>
            </div>
          )}
          
          {shareToken && (
            <p className="text-sm text-gray-600 mt-4 bg-white p-3 rounded border border-gray-200">
              <strong>General Quiz Code:</strong>{" "}
              <code className="bg-gray-100 px-2 py-1 rounded font-mono">{shareToken}</code>
              {" "}(for legacy access)
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-brand-navy mb-4">
          Quiz Information
        </h2>

        {isPublished && (
          <div className="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 font-semibold">
            🔒 This quiz is published and cannot be edited.
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
              onChange={(e) => { setQuizTitle(e.target.value); markDirty(); }}
              placeholder="e.g., Biology Chapter 5 Test"
              disabled={isPublished}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 ${isPublished ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description / Instructions
            </label>
            <textarea
              value={quizDescription}
              onChange={(e) => { setQuizDescription(e.target.value); markDirty(); }}
              placeholder="Enter quiz instructions or description for students (optional)"
              disabled={isPublished}
              rows={3}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 resize-none ${isPublished ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
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
              onChange={(e) => { setQuizDuration(e.target.value); markDirty(); }}
              placeholder="Leave blank for unlimited"
              disabled={isPublished}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 ${isPublished ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Quiz Visibility Setting
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  isPrivate
                    ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy"
                    : "border-gray-200 hover:bg-gray-50"
                } ${isPublished ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="edit_quiz_visibility"
                  checked={isPrivate}
                  disabled={isPublished}
                  onChange={() => {
                    setIsPrivate(true);
                    markDirty();
                  }}
                  className="mt-0.5 text-brand-navy focus:ring-brand-navy"
                />
                <div>
                  <span className="block text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    🔒 Private <span className="text-[10px] font-normal px-1.5 py-0.2 bg-gray-200 text-gray-700 rounded">Default</span>
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Only you can see this quiz and its questions. Hidden from all other instructors and Question Bank.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  !isPrivate
                    ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy"
                    : "border-gray-200 hover:bg-gray-50"
                } ${isPublished ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="edit_quiz_visibility"
                  checked={!isPrivate}
                  disabled={isPublished}
                  onChange={() => {
                    setIsPrivate(false);
                    markDirty();
                  }}
                  className="mt-0.5 text-brand-navy focus:ring-brand-navy"
                />
                <div>
                  <span className="block text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    🌐 Public
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Visible to other instructors. Questions are available in the Question Bank for shared subjects.
                  </span>
                </div>
              </label>
            </div>
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
                  setQuestionCount(Math.max(1, Math.min(100, parseInt(val) || 1)));
                }
              }}
              onBlur={() => {
                if (questionCount === "" || questionCount < 1) setQuestionCount(1);
              }}
              autoFocus
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 mb-4 text-center text-lg"
            />
            <div className="flex gap-3">
              <button
                onClick={() => addMultipleQuestions(parseInt(questionCount) || 1)}
                className="flex-1 bg-brand-gold text-brand-navy py-2 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors"
              >
                Add {parseInt(questionCount) || 1} Question{(parseInt(questionCount) || 1) > 1 ? "s" : ""}
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
                    disabled={isPublished}
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
                      } ${isPublished ? "opacity-50 cursor-not-allowed" : ""}`}
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
                              selectedSectionIds.filter((id) => id !== sec.id),
                            );
                        }}
                        disabled={isPublished}
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

      {quizId && (parentQuizId || isPublished) && (
        <QuizRevisionHistory parentQuizId={parentQuizId} currentQuizId={quizId} />
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        {restoredFromSnapshot > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <div className="text-amber-600 mt-0.5 text-lg">⚠️</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  {restoredFromSnapshot} questions restored from review snapshot
                </p>
                <p className="text-sm text-amber-800 mt-1">
                  These questions were recovered from your last submitted review
                  (because the original question rows were no longer in the database).
                  <span className="font-semibold">
                    Click "Save as Draft" below to permanently save them back to the
                    database.
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold text-brand-navy">
              Questions ({questions.length})
            </h2>
            {totalPages > 1 && (
              <p className="text-xs text-gray-500 mt-1">
                Showing {startIndex + 1}–{Math.min(endIndex, questions.length)} of {questions.length} questions (Page {validCurrentPage} of {totalPages})
              </p>
            )}
          </div>
          {!isPublished && (
            <div className="flex flex-wrap items-center gap-2">
              <label
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Import questions directly from a CSV or JSON file"
              >
                <span>📥</span>
                <span>Import CSV</span>
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleImportCSVFile}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => {
                  setBankTargetIndex(null);
                  setShowBankModal(true);
                }}
                className="bg-brand-navy hover:bg-brand-navy/90 text-white px-3.5 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center gap-1.5 shadow-xs"
                title="Import a new question from Question Bank"
              >
                <span>📚</span>
                <span>From Question Bank</span>
              </button>
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
          <div className="text-center py-8 bg-gray-50 rounded-lg space-y-4">
            <p className="text-gray-500 font-medium">No questions added yet</p>
            {!isPublished && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <label
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>📥</span>
                  <span>Import CSV</span>
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={handleImportCSVFile}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => {
                    setBankTargetIndex(null);
                    setShowBankModal(true);
                  }}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center gap-1.5 shadow-xs"
                >
                  <span>📚</span>
                  <span>From Question Bank</span>
                </button>
                <button
                  onClick={addQuestion}
                  className="bg-brand-gold text-brand-navy px-5 py-2 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors text-sm"
                >
                  Add First Question
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-6">
            {crossSectionSource && crossSectionSourceQuiz && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-indigo-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm text-indigo-800">
                      <strong>Shared Questions:</strong> These questions are from <strong>"{crossSectionSourceQuiz.title}"</strong> from another section in the same subject. You can use them as-is or modify them for your section.
                    </p>
                    <p className="text-xs text-indigo-600 mt-1">
                      Total questions: {questions.length}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {paginatedQuestions.map((question, index) => {
              const idx = startIndex + index;
              return (
              <div
                key={`${question.id}-${idx}`}
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
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-800 truncate">
                      {idx + 1}. {question.text || <span className="text-gray-400 italic">Untitled question</span>}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {!isPublished && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBankTargetIndex(idx);
                          setShowBankModal(true);
                        }}
                        className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-extrabold rounded-lg transition-colors flex items-center gap-1 border border-amber-300 shadow-2xs"
                        title={`Import question from Question Bank into Question #${idx + 1}`}
                      >
                        <span>📚</span>
                        <span>Question Bank</span>
                      </button>
                    )}
                    <span className="text-xs text-gray-400 uppercase">{question.type === "mcq" ? "MCQ" : question.type === "true_false" ? "T/F" : question.type}</span>
                    <span className="text-xs bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded-full font-semibold">{question.points || 1} pt{(question.points || 1) > 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Expandable content */}
                {expandedQuestions.has(question.id) && (
                <div className="mt-4">
                <div className="flex justify-end gap-2 mb-4">
                    {!isPublished && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setBankTargetIndex(idx);
                          setShowBankModal(true);
                        }}
                        className="text-amber-900 hover:text-amber-950 text-xs font-bold px-3 py-1 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 transition-colors flex items-center gap-1"
                        title={`Import question from Question Bank into Question #${idx + 1}`}
                      >
                        <span>📚</span>
                        <span>Import from Bank</span>
                      </button>
                    )}
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
                            console.error("Failed to archive question:", err),
                          );
                        }
                      }}
                      disabled={deletingQuestionId === question.id}
                      className={`${deletingQuestionId === question.id ? "text-gray-400 cursor-not-allowed" : "text-yellow-600 hover:text-yellow-800"} text-sm font-semibold px-3 py-1 transition-colors`}
                    >
                      {deletingQuestionId === question.id
                        ? "..."
                        : <><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>Archive</>}
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
                              questions.filter((q) => q.id !== question.id),
                            );
                          } else {
                            supabase
                              .from("questions")
                              .delete()
                              .eq("id", question.id)
                              .then(({ error }) => {
                                if (error) {
                                  console.error("Delete error:", error);
                                  toast.error(
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
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Remove
                    </button>
                  </div>

                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Question Text *
                  </label>
                  <textarea
                    value={question.text}
                    onChange={(e) =>
                      updateQuestion(question.id, "text", e.target.value)
                    }
                    placeholder="Enter the question"
                    rows="2"
                    disabled={isPublished}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20 ${isPublished ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                  />
                </div>

                {question.type === "mcq" && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Options *
                    </label>
                    <div className="space-y-2">
                      {question.options.map((option, optIdx) => (
                        <div key={optIdx} className="flex gap-2 items-center">
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
                            className="mt-0.5"
                          />
                          <span className="text-sm font-semibold text-gray-500 w-5">
                            ({String.fromCharCode(97 + optIdx)})
                          </span>
                          <input
                            type="text"
                            value={option}
                            onChange={(e) =>
                              updateOption(question.id, optIdx, e.target.value)
                            }
                            placeholder={`Option ${String.fromCharCode(97 + optIdx)}`}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold"
                          />
                          {question.options.length > 2 && (
                            <button
                              onClick={() => removeOption(question.id, optIdx)}
                              className="text-red-500 hover:text-red-700 px-3 py-2"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => addOption(question.id)}
                      className="text-sm text-brand-gold-dark font-semibold mt-2 hover:text-brand-navy"
                    >
                      + Add Option
                    </button>
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
                            updateQuestion(question.id, "correctAnswer", 0)
                          }
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
                            updateQuestion(question.id, "correctAnswer", 1)
                          }
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
                    min="1"
                    className="w-20 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold"
                  />
                </div>
                </div>
                )}
              </div>
            );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200 mt-6">
              <p className="text-sm text-gray-500 font-medium">
                Showing {startIndex + 1}–{Math.min(endIndex, questions.length)} of {questions.length} questions
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700"
                >
                  Prev
                </button>
                {renderPageButtons()}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-8">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Primary Actions */}
          {!isPublished && (
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {loading ? "Saving..." : "Save as Draft"}
              </button>

              <button
                onClick={() => setShowAnalysisModal(true)}
                disabled={
                  questions.length === 0 || questions.some((q) => !q.text.trim())
                }
                className="bg-brand-navy hover:bg-brand-indigo text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  questions.length === 0
                    ? "Add questions first"
                    : "Analyze questions with AI and submit for admin review"
                }
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Submit for Review
              </button>
            </>
          )}

          {/* Divider between primary and secondary */}
          {!isPublished && quizId && (
            <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block" />
          )}

          {/* Secondary Actions */}
          {quizId && !isPublished && (
            <button
              onClick={() =>
                navigate(`/instructor-dashboard/question-bank/${quizId}`)
              }
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Question Bank
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

      </div>{/* end .p-6 wrapper */}

      {/* Bloom's Taxonomy Analysis Modal */}
      {showAnalysisModal && (
        <QuizAnalysisResults
          quizId={quizId || "draft"}
          quizTitle={quizTitle}
          questions={questions.filter((q) => q.text.trim())}
          instructorId={userId}
          onBeforeSubmitReview={async () => {
            return await handleSaveQuiz(false, false);
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

      {/* Question Bank Import Modal */}
      <ImportQuestionBankModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        onSelectQuestion={handleImportFromBank}
        targetQuestionNumber={bankTargetIndex !== null ? bankTargetIndex + 1 : null}
        currentSubjectIds={availableSections.filter((s) => selectedSectionIds.includes(s.id)).map((s) => s.subject_id).filter(Boolean)}
        currentSubjectNames={availableSections.filter((s) => selectedSectionIds.includes(s.id)).map((s) => s.subject_name || s.name || s.subject_code).filter(Boolean)}
      />
    </div>
  );
};
