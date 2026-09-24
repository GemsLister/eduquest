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

    const subjId = question.subject_id || question.quizzes?.subject_id || question.sections?.subject_id || "no_subject";
    const quizIdStr = question.quiz_id ? String(question.quiz_id) : (question.id ? `id_${question.id}` : "standalone");

    return [
      quizIdStr,
      subjId,
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
      const isOwn = question.is_own !== undefined ? question.is_own : (question.instructor_id ? question.instructor_id === user?.id : (question.quizzes ? question.quizzes.instructor_id === user?.id : true));
      
      const isPrivate = question.is_private === false || question.blooms_level === "public"
        ? false
        : (question.is_private === true || question.blooms_level === "private" ? true : (question.quizzes ? question.quizzes.is_private !== false : false));

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
      
      // Preserve explicit Public status (is_private === false or blooms_level === "public") if any instance or standalone entry is public
      if (question.is_private === false || question.blooms_level === "public" || isPrivate === false) {
        existing.is_private = false;
      }

      if (!existing.quizzes && question.quizzes) {
        existing.quizzes = question.quizzes;
      }
      if (!existing.subject_id && question.subject_id) {
        existing.subject_id = question.subject_id;
        existing.subject_name = question.subject_name;
        existing.subjects = question.subjects;
      }

      const existingTime = new Date(existing.created_at || 0).getTime();
      const currentTime = new Date(question.created_at || 0).getTime();
      if (currentTime > existingTime || (question.quiz_id === null && existing.quiz_id !== null)) {
        const accumulatedQuizIds = existing.all_quiz_ids;
        const accumulatedParentIds = existing.all_parent_quiz_ids;
        const accumulatedIsOwn = existing.is_own || isOwn;
        const accumulatedIsPrivate = (question.is_private === false || question.blooms_level === "public" || isPrivate === false) ? false : true;
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
        .select("id, parent_quiz_id, version_number, is_archived, instructor_id, is_private, is_published, subject_id, section_id")
        .eq("instructor_id", user.id);

      const ownQuizzes = ownQuizzesData || [];

      // 2. Fetch ALL PUBLIC published quizzes from other instructors across all subjects/classes
      const { data: publicQuizzes } = await supabase
        .from("quizzes")
        .select("id, parent_quiz_id, version_number, is_archived, instructor_id, is_private, is_published, subject_id, section_id")
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

      // Get instructor's sections and referenced sections for standalone and quiz questions
      const { data: sectionsData } = await supabase
        .from("sections")
        .select("id, name, subject_id, subjects(id, name, code)")
        .or("is_archived.is.null,is_archived.eq.false");

      const sectionMap = new Map();
      (sectionsData || []).forEach((s) => sectionMap.set(s.id, s));
      const sectionIds = (sectionsData || []).map((s) => s.id);

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
              is_own: quizMeta?.instructor_id === user.id,
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
                      is_own: quizMeta?.instructor_id === user.id,
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
        standaloneQuestions = standaloneQs.map((sq) => {
          const isOwn = sq.instructor_id ? sq.instructor_id === user?.id : true;
          const isPrivate = sq.is_private === false || sq.blooms_level === "public"
            ? false
            : (sq.is_private === true || sq.blooms_level === "private" ? true : false);
          return {
            ...sq,
            is_own: isOwn,
            is_private: isPrivate,
            is_archived: Boolean(sq.is_archived),
          };
        });
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
            .flatMap((q) => [q.quizzes?.instructor_id, q.instructor_id, user?.id])
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

      // Fetch subjects for referenced subject_ids and section subject_ids in memory
      const subjectIds = Array.from(
        new Set(
          allQuestions
            .flatMap((q) => {
              const secMeta = q.section_id ? sectionMap.get(q.section_id) : (q.quizzes?.section_id ? sectionMap.get(q.quizzes.section_id) : null);
              return [q.subject_id, q.quizzes?.subject_id, secMeta?.subject_id];
            })
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
        const creatorId = q.quizzes?.instructor_id || q.instructor_id;
        const creatorName = profileMap.get(creatorId) || profileMap.get(user?.id) || "Instructor";
        const secMeta = q.section_id ? sectionMap.get(q.section_id) : (q.quizzes?.section_id ? sectionMap.get(q.quizzes.section_id) : null);
        const secSubjectId = secMeta?.subject_id || null;
        const secSubjectObj = secMeta?.subjects || (secSubjectId ? subjectMap.get(secSubjectId) : null);

        const subjectObj = q.subject_id
          ? subjectMap.get(q.subject_id)
          : (q.quizzes?.subject_id ? subjectMap.get(q.quizzes.subject_id) : secSubjectObj);

        const resolvedSubjectId = q.subject_id || q.quizzes?.subject_id || secSubjectId || subjectObj?.id || null;
        const resolvedSubjectName = subjectObj?.name || q.subjects?.name || q.quizzes?.subjects?.name || secSubjectObj?.name || secMeta?.name || null;

        return {
          ...q,
          sections: secMeta || q.sections,
          section_id: q.section_id || q.quizzes?.section_id || null,
          subject_id: resolvedSubjectId,
          subject_name: resolvedSubjectName,
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

  // Archive a question with optional section assignment
  const archiveQuestion = async (questionId, sectionId = null) => {
    try {
      if (!questionId) {
        return { success: false, error: "Question ID is required" };
      }

      const question = activeQuestions.find((q) => q.id === questionId);

      // Check if this question is linked to sibling quizzes via quiz_questions junction table
      try {
        const { data: siblingJunctions } = await supabase
          .from("quiz_questions")
          .select("quiz_id, order_index")
          .eq("question_id", questionId);

        if (siblingJunctions && siblingJunctions.length > 0 && question) {
          for (const junc of siblingJunctions) {
            const siblingQuizId = junc.quiz_id;
            // If sibling quiz is different from target question's primary quiz_id
            if (siblingQuizId && String(siblingQuizId) !== String(question.quiz_id)) {
              const isPriv = question.is_private === false || question.blooms_level === "public" ? false : true;
              const clonePayload = {
                quiz_id: siblingQuizId,
                instructor_id: question.instructor_id || user?.id || null,
                type: question.type || "mcq",
                text: question.text,
                options: question.options || null,
                correct_answer: question.correct_answer,
                points: question.points || 1,
                is_archived: false,
                blooms_level: isPriv ? "private" : "public",
                is_private: isPriv,
                subject_id: question.subject_id || null,
              };

              let { data: newCloneData } = await supabase.from("questions").insert(clonePayload).select();
              if (!newCloneData) {
                delete clonePayload.is_private;
                delete clonePayload.instructor_id;
                const retry = await supabase.from("questions").insert(clonePayload).select();
                newCloneData = retry.data;
              }

              if (newCloneData?.[0]?.id) {
                // Re-point sibling junction to the new active cloned question so sibling quiz keeps its question active
                await supabase
                  .from("quiz_questions")
                  .update({ question_id: newCloneData[0].id })
                  .eq("quiz_id", siblingQuizId)
                  .eq("question_id", questionId);
              }
            }
          }
        }
      } catch (siblingErr) {
        console.warn("[archiveQuestion] Sibling quiz clone check skipped:", siblingErr);
      }

      const updateData = { 
        is_archived: true, 
        updated_at: new Date().toISOString() 
      };

      // Include section_id if provided
      if (sectionId) {
        updateData.section_id = sectionId;
      }

      const { error } = await supabase
        .from("questions")
        .update(updateData)
        .eq("id", questionId);

      if (error) throw error;

      await fetchQuestions();

      return { success: true };
    } catch (error) {
      console.error("Error archiving question:", error);
      return { success: false, error: error.message };
    }
  };

  // Restore an archived question
  const restoreQuestion = async (questionId) => {
    try {
      const { error } = await supabase
        .from("questions")
        .update({ is_archived: false, updated_at: new Date().toISOString() })
        .eq("id", questionId);

      if (error) throw error;

      // Move from archived to active
      const question = archivedQuestions.find((q) => q.id === questionId);
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

  // Delete a question permanently (only if its quiz is unpublished and has no attempts)
  const deleteQuestion = async (questionId) => {
    try {
      const questionToDelete =
        activeQuestions.find((q) => q.id === questionId) ||
        archivedQuestions.find((q) => q.id === questionId);

      if (!questionToDelete) return { success: false, error: "Question not found" };

      if (questionToDelete.quiz_id) {
        const { data: quiz } = await supabase
          .from("quizzes")
          .select("id, is_published")
          .eq("id", questionToDelete.quiz_id)
          .single();

        if (quiz?.is_published) {
          return {
            success: false,
            error:
              "Cannot permanently delete this question because it belongs to a published quiz. You can archive it instead.",
          };
        }

        const { count: attemptCount } = await supabase
          .from("quiz_attempts")
          .select("*", { count: "exact", head: true })
          .eq("quiz_id", questionToDelete.quiz_id);

        if (attemptCount > 0) {
          return {
            success: false,
            error:
              "Cannot permanently delete this question because its quiz already has student attempts. You can archive it instead.",
          };
        }
      }

      await supabase
        .from("quiz_responses")
        .delete()
        .eq("question_id", questionId);

      await supabase
        .from("quiz_questions")
        .delete()
        .eq("question_id", questionId);

      const { error } = await supabase
        .from("questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;

      await fetchQuestions();

      return { success: true };
    } catch (error) {
      console.error("Error deleting question:", error);
      return { success: false, error: error.message };
    }
  };

  // Add a new question to the bank (with optional target quiz container)
  const addToBank = async (questionData, sectionId = null, subjectId = null, quizId = null) => {
    try {
      if (!user) return { success: false, error: "Not authenticated" };

      const targetQuizId = quizId || questionData.quizId || questionData.quiz_id || null;

      const correctAnswer =
        questionData.type === "mcq"
          ? questionData.options[questionData.correctAnswer] || questionData.correctAnswer
          : questionData.type === "true_false"
            ? questionData.correctAnswer === 0 ? "true" : "false"
            : questionData.correctAnswer;

      const isPriv = questionData.isPrivate === false || questionData.is_private === false ? false : true;
      const questionPayload = {
        quiz_id: targetQuizId,
        instructor_id: user?.id || null,
        type: questionData.type || "mcq",
        text: questionData.text,
        options: questionData.type === "mcq" ? questionData.options.filter((opt) => opt.trim()) : null,
        correct_answer: correctAnswer,
        points: questionData.points || 1,
        is_archived: false,
        blooms_level: isPriv ? "private" : "public",
        is_private: isPriv,
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

      let { data: insertedData, error: questionError } = await supabase
        .from("questions")
        .insert(questionPayload)
        .select();

      if (questionError) {
        const msg = (questionError.message || "").toLowerCase();
        const code = questionError.code || "";
        const isUnknownColumnErr =
          code === "42703" ||
          code === "PGRST204" ||
          msg.includes("could not find") ||
          msg.includes("schema cache") ||
          msg.includes("is_private") ||
          msg.includes("instructor_id");

        if (isUnknownColumnErr) {
          const fallbackPayload = { ...questionPayload };
          delete fallbackPayload.is_private;
          delete fallbackPayload.instructor_id;
          const retry = await supabase.from("questions").insert(fallbackPayload).select();
          questionError = retry.error;
          insertedData = retry.data;
        }
      }

      if (questionError) throw questionError;

      // Link to quiz_questions junction table if targetQuizId specified
      const insertedQuestionId = insertedData?.[0]?.id;
      if (targetQuizId && insertedQuestionId) {
        try {
          const { data: existingJunc } = await supabase
            .from("quiz_questions")
            .select("order_index")
            .eq("quiz_id", targetQuizId);

          const maxOrder = existingJunc?.length ? Math.max(...existingJunc.map(j => j.order_index || 0)) + 1 : 0;

          await supabase.from("quiz_questions").insert({
            quiz_id: targetQuizId,
            question_id: insertedQuestionId,
            order_index: maxOrder
          });
        } catch (juncErr) {
          console.warn("[addToBank] quiz_questions junction linking skipped:", juncErr);
        }
      }

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

  // Add multiple questions to the bank (with optional target quiz container)
  const addBulkToBank = async (questionsArray, containerTitle = "Question Bank - Draft", sectionId = null, subjectId = null, isPrivate = true, targetQuizId = null) => {
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

        const isPriv = isPrivate !== undefined ? Boolean(isPrivate) : (q.is_private !== undefined ? Boolean(q.is_private) : true);
        const questionRow = {
          quiz_id: targetQuizId || q.quiz_id || q.quizId || null,
          instructor_id: user?.id || null,
          type: q.type || "mcq",
          text: q.text,
          options:
            (q.type || "mcq") === "mcq" && Array.isArray(q.options)
              ? q.options.filter((opt) => opt !== null && opt !== undefined && String(opt).trim() !== "")
              : null,
          correct_answer: String(correctAnswer ?? ""),
          points: q.points || 1,
          is_archived: false,
          blooms_level: isPriv ? "private" : "public",
          is_private: isPriv,
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

      let { data: insertedRows, error: questionError } = await supabase
        .from("questions")
        .insert(questionRows)
        .select();

      if (questionError) {
        const msg = (questionError.message || "").toLowerCase();
        const code = questionError.code || "";
        const isUnknownColumnErr =
          code === "42703" ||
          code === "PGRST204" ||
          msg.includes("could not find") ||
          msg.includes("schema cache") ||
          msg.includes("is_private") ||
          msg.includes("instructor_id");

        if (isUnknownColumnErr) {
          const cleanRows = questionRows.map((r) => {
            const copy = { ...r };
            delete copy.is_private;
            delete copy.instructor_id;
            return copy;
          });
          const retry = await supabase.from("questions").insert(cleanRows).select();
          questionError = retry.error;
          insertedRows = retry.data;
        }
      }

      if (questionError) throw questionError;

      // Link inserted questions to quiz_questions junction table if targetQuizId is set
      if (targetQuizId && insertedRows && insertedRows.length > 0) {
        try {
          const { data: existingJunc } = await supabase
            .from("quiz_questions")
            .select("order_index")
            .eq("quiz_id", targetQuizId);

          let nextOrder = existingJunc?.length ? Math.max(...existingJunc.map(j => j.order_index || 0)) + 1 : 0;

          const juncRows = insertedRows.map(q => ({
            quiz_id: targetQuizId,
            question_id: q.id,
            order_index: nextOrder++
          }));

          await supabase.from("quiz_questions").insert(juncRows);
        } catch (juncErr) {
          console.warn("[addBulkToBank] quiz_questions junction linking skipped:", juncErr);
        }
      }

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
