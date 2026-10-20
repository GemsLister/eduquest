import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { logAudit } from "../../services/auditService";

export const useQuestionBank = () => {
  const { user } = useAuth();
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [archivedQuestions, setArchivedQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const normalizeText = (value) => (value || "").toLowerCase().trim();

  const buildQuestionKey = (question) => {
    const options = Array.isArray(question.options)
      ? question.options.map((opt) => normalizeText(opt)).join("|")
      : "";

    return [
      normalizeText(question.text),
      normalizeText(question.type),
      options,
      normalizeText(question.correct_answer),
      String(question.points ?? 1),
    ].join("::");
  };

  const dedupeQuestions = (questions) => {
    const byKey = new Map();

    for (const question of questions) {
      const key = buildQuestionKey(question);
      const existing = byKey.get(key);

      const quizIdStr = question.quiz_id ? String(question.quiz_id) : null;
      const parentQuizIdStr = question.quizzes?.parent_quiz_id ? String(question.quizzes.parent_quiz_id) : (question.parent_quiz_id ? String(question.parent_quiz_id) : null);
      const isOwn = question.is_own || question.quizzes?.instructor_id === user?.id || (!question.quiz_id && true);
      const isPrivate = question.is_private === true || question.quizzes?.is_private !== false;

      if (!existing) {
        byKey.set(key, { 
          ...question, 
          is_own: isOwn,
          is_private: isPrivate,
          all_quiz_ids: quizIdStr ? [quizIdStr] : [],
          all_parent_quiz_ids: parentQuizIdStr ? [parentQuizIdStr] : []
        });
        continue;
      }

      if (quizIdStr && !existing.all_quiz_ids.includes(quizIdStr)) {
        existing.all_quiz_ids.push(quizIdStr);
      }

      if (parentQuizIdStr && !existing.all_parent_quiz_ids.includes(parentQuizIdStr)) {
        existing.all_parent_quiz_ids.push(parentQuizIdStr);
      }

      if (isOwn) existing.is_own = true;
      if (isPrivate) existing.is_private = true;
      if (!existing.quizzes && question.quizzes) {
        existing.quizzes = question.quizzes;
      }

      const existingTime = new Date(existing.created_at || 0).getTime();
      const currentTime = new Date(question.created_at || 0).getTime();
      if (currentTime < existingTime) {
        const accumulatedQuizIds = existing.all_quiz_ids;
        const accumulatedParentIds = existing.all_parent_quiz_ids;
        const accumulatedIsOwn = existing.is_own || isOwn;
        const accumulatedIsPrivate = existing.is_private || isPrivate;
        const accumulatedQuizzes = question.quizzes || existing.quizzes;

        byKey.set(key, { 
          ...question, 
          quizzes: accumulatedQuizzes,
          is_own: accumulatedIsOwn,
          is_private: accumulatedIsPrivate,
          all_quiz_ids: accumulatedQuizIds,
          all_parent_quiz_ids: accumulatedParentIds
        });
      }
    }

    return Array.from(byKey.values());
  };

  const fetchQuestions = async () => {
    if (!user) return;
    try {

      // 1. Fetch ALL of current user's quizzes (Private/Public, Draft/Published, Active/Archived)
      const { data: ownQuizzesData } = await supabase
        .from("quizzes")
        .select("id, parent_quiz_id, version_number, is_archived, instructor_id, is_private, is_published")
        .eq("instructor_id", user.id);

      const ownQuizzes = ownQuizzesData || [];

      // 2. Fetch ALL PUBLIC published quizzes from other instructors across all subjects/classes
      const { data: publicQuizzes } = await supabase
        .from("quizzes")
        .select("id, parent_quiz_id, version_number, is_archived, instructor_id, is_private, is_published")
        .neq("instructor_id", user.id)
        .or("is_archived.is.null,is_archived.eq.false")
        .eq("is_private", false)
        .eq("is_published", true);

      const coInstructorPublicQuizzes = publicQuizzes || [];

      const allAccessibleQuizzes = [...ownQuizzes, ...coInstructorPublicQuizzes];
      const quizIds = Array.from(
        new Set(
          allAccessibleQuizzes
            .flatMap((q) => [q.id, q.parent_quiz_id])
            .filter(Boolean)
        )
      );

      // Fetch questions from instructor's quizzes (including co-instructors)
      // Build in-memory quiz map from accessible quizzes
      const accessibleQuizMap = new Map();
      allAccessibleQuizzes.forEach((q) => {
        if (q && q.id) accessibleQuizMap.set(String(q.id), q);
      });

      // Fetch questions from instructor's quizzes (including co-instructors)
      let quizQuestions = [];
      if (quizIds.length > 0) {
        // Direct relationship: questions.quiz_id IN (quizIds)
        const { data: quizQs, error: quizQError } = await supabase
          .from("questions")
          .select("*")
          .in("quiz_id", quizIds)
          .order("created_at", { ascending: false });

        if (!quizQError && quizQs) {
          const mappedQuizQs = quizQs.map((q) => {
            const quizMeta = q.quiz_id ? accessibleQuizMap.get(String(q.quiz_id)) || null : null;
            const isQuizArchived = quizMeta?.is_archived === true;
            const isQuestionArchived = q.is_archived === true;
            return {
              ...q,
              quizzes: quizMeta,
              is_own: quizMeta?.instructor_id === user.id || q.instructor_id === user.id || q.created_by === user.id,
              is_private: q.is_private === true || quizMeta?.is_private !== false,
              is_archived: isQuestionArchived || isQuizArchived,
            };
          });
          quizQuestions.push(...mappedQuizQs);
        }

        // Also fetch questions linked via quiz_questions junction table
        try {
          const { data: junctionRows } = await supabase
            .from("quiz_questions")
            .select("question_id, quiz_id")
            .in("quiz_id", quizIds);

          if (junctionRows && junctionRows.length > 0) {
            const jqIds = junctionRows.map((j) => j.question_id).filter(Boolean);
            if (jqIds.length > 0) {
              const { data: jqQs } = await supabase
                .from("questions")
                .select("*")
                .in("id", jqIds);

              if (jqQs) {
                junctionRows.forEach((jq) => {
                  const qRow = jqQs.find((item) => item.id === jq.question_id);
                  if (qRow) {
                    const quizMeta = jq.quiz_id ? accessibleQuizMap.get(String(jq.quiz_id)) || null : null;
                    const isQuizArchived = quizMeta?.is_archived === true;
                    const isQuestionArchived = qRow.is_archived === true;
                    quizQuestions.push({
                      ...qRow,
                      quizzes: quizMeta,
                      quiz_id: qRow.quiz_id || jq.quiz_id,
                      is_own: quizMeta?.instructor_id === user.id || qRow.instructor_id === user.id || qRow.created_by === user.id,
                      is_private: qRow.is_private === true || quizMeta?.is_private !== false,
                      is_archived: isQuestionArchived || isQuizArchived,
                    });
                  }
                });
              }
            }
          }
        } catch (juncErr) {
          console.warn("[useQuestionBank] quiz_questions junction fetch skipped:", juncErr);
        }
      }

      // Fetch standalone questions (quiz_id IS NULL)
      let standaloneQuestions = [];
      const { data: standaloneQs, error: standaloneQError } = await supabase
        .from("questions")
        .select("*")
        .is("quiz_id", null)
        .order("created_at", { ascending: false });

      if (!standaloneQError && standaloneQs) {
        standaloneQuestions = standaloneQs.map((sq) => ({
          ...sq,
          is_own: true,
          is_private: true,
          is_archived: Boolean(sq.is_archived),
        }));
      }

      // Combine both types of questions
      const allQuestions = [...quizQuestions, ...standaloneQuestions];

      if (allQuestions.length === 0) {
        setActiveQuestions([]);
        setArchivedQuestions([]);
        setLoading(false);
        return;
      }

      // Fetch creator profiles for all instructor IDs
      const creatorIds = Array.from(
        new Set(
          allQuestions
            .flatMap((q) => [q.quizzes?.instructor_id, q.instructor_id, q.created_by, user?.id])
            .filter(Boolean)
        )
      );

      let profileMap = new Map();
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", creatorIds);

        if (profiles) {
          profiles.forEach((p) => {
            const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
            const nameToUse = fullName || (p.email ? p.email.split("@")[0] : null) || "Instructor";
            profileMap.set(p.id, nameToUse);
          });
        }
      }

      // Fetch subjects for referenced subject_ids in memory
      const subjectIds = Array.from(
        new Set(
          allQuestions
            .flatMap((q) => [q.subject_id, q.quizzes?.subject_id])
            .filter(Boolean)
        )
      );

      let subjectMap = new Map();
      if (subjectIds.length > 0) {
        try {
          const { data: subjectData } = await supabase
            .from("subjects")
            .select("id, name, code, description")
            .in("id", subjectIds);

          if (subjectData) {
            subjectData.forEach((s) => {
              subjectMap.set(s.id, s);
            });
          }
        } catch (sErr) {
          console.warn("Could not fetch subjects:", sErr);
        }
      }

      const questionsWithCreators = allQuestions.map((q) => {
        const creatorId = q.quizzes?.instructor_id || q.instructor_id || q.created_by;
        const creatorName = profileMap.get(creatorId) || profileMap.get(user?.id) || "Instructor";
        const subjectObj = q.subject_id ? subjectMap.get(q.subject_id) : (q.quizzes?.subject_id ? subjectMap.get(q.quizzes.subject_id) : null);
        return {
          ...q,
          subjects: subjectObj || q.subjects,
          creator_name: creatorName,
        };
      });

      // 1. Deduplicate ALL fetched questions by content first.
      const allUniqueQuestions = dedupeQuestions(questionsWithCreators);

      // 2. Separate into active and archived based on the canonical (oldest) instance's status.
      const active = allUniqueQuestions.filter((q) => !q.is_archived);
      const archived = allUniqueQuestions.filter((q) => q.is_archived);

      setActiveQuestions(active);
      setArchivedQuestions(archived);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching questions:", error);
      setLoading(false);
    }
  };

  // Find a question in either list
  const findQuestion = (questionId) =>
    activeQuestions.find((q) => q.id === questionId) ||
    archivedQuestions.find((q) => q.id === questionId);

  // The bank merges identical questions from several quizzes; only the
  // instructor's own copies may be changed.
  const isOwnedByUser = (question) =>
    question?.quiz_id
      ? question.quizzes?.instructor_id === user?.id
      : Boolean(question?.is_own);

  // Archive a question with optional section assignment
  const archiveQuestion = async (questionId, sectionId = null) => {
    try {
      if (!questionId) {
        return { success: false, error: "Question ID is required" };
      }

      const question = findQuestion(questionId);
      if (question && !isOwnedByUser(question)) {
        return {
          success: false,
          error: "This question belongs to another instructor's quiz and can't be archived by you.",
        };
      }

      // Archiving removes the question from its quiz, so never touch a live
      // quiz or one that is in the review pipeline.
      if (question?.quiz_id) {
        const { data: quiz } = await supabase
          .from("quizzes")
          .select("id, title, is_published")
          .eq("id", question.quiz_id)
          .maybeSingle();

        if (quiz?.is_published) {
          return {
            success: false,
            error: `This question is part of the published quiz "${quiz.title}". Archive the quiz instead.`,
          };
        }

        const { data: latestSub } = await supabase
          .from("quiz_analysis_submissions")
          .select("status")
          .eq("quiz_id", question.quiz_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (["pending", "faculty_head_review", "approved", "faculty_head_approved"].includes(latestSub?.status)) {
          return {
            success: false,
            error: `This question is part of "${quiz?.title || "a quiz"}", which is in the review process and can't be changed.`,
          };
        }
      }

      const updateData = {
        is_archived: true,
        updated_at: new Date().toISOString(),
      };

      // Include section_id if provided
      if (sectionId) {
        updateData.section_id = sectionId;
      }

      const { data: updated, error } = await supabase
        .from("questions")
        .update(updateData)
        .eq("id", questionId)
        .select("id");

      if (error) throw error;
      if (!updated || updated.length === 0) {
        return { success: false, error: "You don't have permission to archive this question." };
      }

      // Move from active to archived
      if (question) {
        const updatedQuestion = {
          ...question,
          is_archived: true,
          section_id: sectionId || question.section_id,
        };
        setActiveQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setArchivedQuestions((prev) => [...prev, updatedQuestion]);
      }

      return { success: true };
    } catch (error) {
      console.error("Error archiving question:", error);
      return { success: false, error: error.message };
    }
  };

  // Restore an archived question
  const restoreQuestion = async (questionId) => {
    try {
      const question = findQuestion(questionId);
      if (question && !isOwnedByUser(question)) {
        return {
          success: false,
          error: "This question belongs to another instructor and can't be restored by you.",
        };
      }

      const { data: updated, error } = await supabase
        .from("questions")
        .update({ is_archived: false, updated_at: new Date().toISOString() })
        .eq("id", questionId)
        .select("id");

      if (error) throw error;
      if (!updated || updated.length === 0) {
        return { success: false, error: "You don't have permission to restore this question." };
      }

      // Move from archived to active
      if (question) {
        setArchivedQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setActiveQuestions((prev) => [
          ...prev,
          { ...question, is_archived: false },
        ]);
      }

      return { success: true };
    } catch (error) {
      console.error("Error restoring question:", error);
      return { success: false, error: error.message };
    }
  };

  // Permanently delete an archived question. Only the user's own archived
  // copies are removed, and never a copy that has student responses.
  const deleteQuestion = async (questionId) => {
    try {
      const questionToDelete = findQuestion(questionId);
      if (!questionToDelete) return { success: false, error: "Question not found" };

      if (!isOwnedByUser(questionToDelete)) {
        return {
          success: false,
          error: "You can only remove questions you created.",
        };
      }

      if (!questionToDelete.is_archived) {
        return {
          success: false,
          error: "Archive the question first before removing it permanently.",
        };
      }

      // Identical archived copies of this question in the user's own quizzes
      const ownQuizIds = (questionToDelete.all_quiz_ids || []).filter(Boolean);
      let candidateIds = [questionId];
      if (ownQuizIds.length > 0) {
        const { data: copies } = await supabase
          .from("questions")
          .select("id, quiz_id, is_archived, quizzes(instructor_id)")
          .in("quiz_id", ownQuizIds)
          .eq("text", questionToDelete.text);

        (copies || []).forEach((c) => {
          if (c.is_archived === true && c.quizzes?.instructor_id === user?.id) {
            candidateIds.push(c.id);
          }
        });
      }
      candidateIds = [...new Set(candidateIds)];

      // Keep any copy that students have already answered
      const { data: answered } = await supabase
        .from("quiz_responses")
        .select("question_id")
        .in("question_id", candidateIds);
      const answeredIds = new Set((answered || []).map((r) => r.question_id));

      if (answeredIds.has(questionId)) {
        return {
          success: false,
          error:
            "This question has student responses, so it can't be removed permanently. It stays archived to preserve results.",
        };
      }

      const idsToDelete = candidateIds.filter((id) => !answeredIds.has(id));

      try {
        await supabase.from("quiz_questions").delete().in("question_id", idsToDelete);
      } catch (juncErr) {
        console.warn("quiz_questions cleanup skipped:", juncErr);
      }

      const { error } = await supabase
        .from("questions")
        .delete()
        .in("id", idsToDelete);

      if (error) throw error;

      await fetchQuestions();

      return { success: true };
    } catch (error) {
      console.error("Error deleting question:", error);
      return { success: false, error: error.message };
    }
  };

  // Add a new question to the bank (without assigning to a quiz yet)
  const addToBank = async (questionData, sectionId = null, subjectId = null) => {
    try {
      if (!user) return { success: false, error: "Not authenticated" };

      // Add question as standalone (quiz_id = NULL) with section assignment
      const correctAnswer =
        questionData.type === "mcq"
          ? questionData.options[questionData.correctAnswer] || questionData.correctAnswer
          : questionData.type === "true_false"
            ? questionData.correctAnswer === 0 ? "true" : "false"
            : questionData.correctAnswer;

      const questionPayload = {
        quiz_id: null, // Standalone question in bank
        type: questionData.type || "mcq",
        text: questionData.text,
        options: questionData.type === "mcq" ? questionData.options.filter((opt) => opt.trim()) : null,
        correct_answer: correctAnswer,
        points: questionData.points || 1,
        is_archived: false,
      };

      // Assign to section if provided (metadata only)
      if (sectionId) {
        questionPayload.section_id = sectionId;
      }

      // Assign to subject if provided (primary categorization)
      if (subjectId) {
        questionPayload.subject_id = subjectId;
      } else if (sectionId) {
        // If no subjectId but sectionId provided, derive subject from section
        const { data: section } = await supabase
          .from("sections")
          .select("subject_id")
          .eq("id", sectionId)
          .single();
        
        if (section?.subject_id) {
          questionPayload.subject_id = section.subject_id;
        }
      }

      const { error: questionError } = await supabase.from("questions").insert(questionPayload);

      if (questionError) throw questionError;

      // Log activity audit event
      logAudit({
        action: "QUESTION_ADDED_TO_BANK",
        tableName: "questions",
        itemName: questionData.text ? questionData.text.slice(0, 80) : "Question",
        reason: "Added to Question Bank",
      });

      await fetchQuestions();
      return { success: true };
    } catch (error) {
      console.error("Error adding to bank:", error);
      return { success: false, error: error.message };
    }
  };

  // Add multiple questions to the bank as standalone questions (no quiz container)
  const addBulkToBank = async (questionsArray, sectionId = null, subjectId = null) => {
    try {
      if (!user) return { success: false, error: "Not authenticated" };
      if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
        return { success: false, error: "No questions to import" };
      }

      // Derive subject_id from section if not provided
      let derivedSubjectId = subjectId;
      if (!derivedSubjectId && sectionId) {
        const { data: section } = await supabase
          .from("sections")
          .select("subject_id")
          .eq("id", sectionId)
          .single();
        derivedSubjectId = section?.subject_id;
      }

      const baseBulkTime = Date.now();
      const questionRows = questionsArray.map((q, idx) => {
        let correctAnswer = q.correct_answer ?? q.correctAnswer;
        if (
          q.type === "mcq" &&
          typeof correctAnswer === "number" &&
          Array.isArray(q.options) &&
          q.options[correctAnswer] !== undefined
        ) {
          correctAnswer = q.options[correctAnswer];
        }

        const questionRow = {
          quiz_id: null, // Standalone question in bank
          type: q.type || "mcq",
          text: q.text,
          options:
            (q.type || "mcq") === "mcq" && Array.isArray(q.options)
              ? q.options.filter((opt) => opt !== null && opt !== undefined && String(opt).trim() !== "")
              : null,
          correct_answer: String(correctAnswer ?? ""),
          points: q.points || 1,
          is_archived: false,
          created_at: new Date(baseBulkTime + idx * 100).toISOString(),
        };

        // Assign to section if provided (metadata only)
        if (sectionId) {
          questionRow.section_id = sectionId;
        }

        // Assign to subject (primary categorization)
        if (derivedSubjectId) {
          questionRow.subject_id = derivedSubjectId;
        }

        return questionRow;
      });

      const { error: questionError } = await supabase
        .from("questions")
        .insert(questionRows);

      if (questionError) throw questionError;

      await fetchQuestions();
      return { success: true, count: questionRows.length };
    } catch (error) {
      console.error("Error bulk adding to bank:", error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchQuestions();
    window.addEventListener("question-bank-updated", fetchQuestions);
    window.addEventListener("questions-updated", fetchQuestions);
    return () => {
      window.removeEventListener("question-bank-updated", fetchQuestions);
      window.removeEventListener("questions-updated", fetchQuestions);
    };
  }, [user?.id]);

  return {
    fetchQuestions,
    activeQuestions,
    archivedQuestions,
    loading,
    archiveQuestion,
    restoreQuestion,
    deleteQuestion,
    addToBank,
    addBulkToBank,
  };
};
