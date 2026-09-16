import { supabase } from "../../supabaseClient";
import { logAudit } from "../auditService.js";

/**
 * Create a new quiz version from item-analysis revisions without modifying
 * the original published quiz or its questions.
 *
 * @param {string} originalQuizId - Quiz the analysis was run against
 * @param {Array} revisedQuestions - Questions with revisions
 * @returns {Promise<{quizId: string, error: null|string}>}
 */
export const createQuizVersion = async (originalQuizId, revisedQuestions) => {
  try {
    // 1. Fetch the quiz being analyzed
    const { data: originalQuiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", originalQuizId)
      .single();

    if (quizError || !originalQuiz) throw new Error("Failed to fetch original quiz");

    const rootId = originalQuiz.parent_quiz_id || originalQuizId;

    // 2. Fetch the root quiz for title base and instructor id
    const { data: rootQuiz, error: rootError } =
      rootId === originalQuizId
        ? { data: originalQuiz, error: null }
        : await supabase
            .from("quizzes")
            .select("*")
            .eq("id", rootId)
            .single();

    if (rootError || !rootQuiz) throw new Error("Failed to fetch root quiz");

    const instructorId = rootQuiz.instructor_id;
    const baseTitle = rootQuiz.title.replace(
      /\s*\(Revised(?:\s+\d+)?\)\s*$/,
      "",
    );

    // 3. Find the highest existing version number in this quiz chain
    const { data: allRevs } = await supabase
      .from("quizzes")
      .select("id, version_number, is_published")
      .or(`id.eq.${rootId},parent_quiz_id.eq.${rootId}`)
      .eq("is_archived", false);

    const maxVer = (allRevs || []).reduce(
      (max, q) => Math.max(max, q.version_number || 1),
      1,
    );
    const newVersion = maxVer + 1;
    const newQuizTitle =
      newVersion === 2
        ? `${baseTitle} (Revised)`
        : `${baseTitle} (Revised ${newVersion - 1})`;

    // 4. Build map of revisions
    const revisedMap = {};
    revisedQuestions.forEach((q) => {
      revisedMap[q.question_id || q.id] = q;
    });

    // 5. Always insert a BRAND NEW draft quiz version row (leaving original quiz published & untouched)
    const { data: newQuiz, error: createError } = await supabase
      .from("quizzes")
      .insert({
        instructor_id: rootQuiz.instructor_id,
        section_id: rootQuiz.section_id,
        title: newQuizTitle,
        description: `${rootQuiz.description || ""} [Auto-generated from Item Analysis revisions]`.trim(),
        duration: rootQuiz.duration || null,
        is_published: false,
        is_archived: false,
        is_private: rootQuiz.is_private !== false,
        parent_quiz_id: rootId,
        version_number: newVersion,
      })
      .select()
      .single();

    if (createError || !newQuiz) {
      console.error("Supabase createError:", createError);
      throw new Error(
        `Failed to create new quiz version: ${createError?.message || JSON.stringify(createError)}`,
      );
    }

    // 6. Fetch all questions from the quiz being analyzed
    const { data: sourceQuestions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", originalQuizId)
      .order("created_at", { ascending: true });

    if (questionsError) throw new Error("Failed to fetch questions from source quiz");

    const now = new Date();

    // 7. Create NEW question rows specifically for the new quiz version
    const newQuestions = (sourceQuestions || []).map((q, index) => {
      const revised = revisedMap[q.id];

      let textToUse = q.text;
      let optionsToUse = q.options;
      let correctAnswerToUse = q.correct_answer;
      let isAiRevised = q.ai_revised || false;

      if (revised) {
        if (typeof revised.revised_content === "string" && revised.revised_content.trim()) {
          textToUse = revised.revised_content;
        } else if (revised.revised_content?.text) {
          textToUse = revised.revised_content.text;
        }
        if (revised.revised_options && Array.isArray(revised.revised_options)) {
          optionsToUse = revised.revised_options;
        }
        if (revised.revised_correct_answer !== undefined) {
          correctAnswerToUse = revised.revised_correct_answer;
        } else if (revised.revised_content?.correct_answer !== undefined) {
          correctAnswerToUse = revised.revised_content.correct_answer;
        }
        isAiRevised = true;
      }

      return {
        quiz_id: newQuiz.id,
        text: textToUse,
        type: q.type || "multiple_choice",
        options: optionsToUse,
        correct_answer: correctAnswerToUse,
        points: q.points || 1,
        blooms_level: q.blooms_level || null,
        is_gad: q.is_gad || false,
        ai_revised: isAiRevised,
        created_at: new Date(now.getTime() + index * 1000).toISOString(),
        revision_history: [
          ...(q.revision_history || []),
          ...(revised
            ? [
                {
                  version: newVersion,
                  original_text: q.text,
                  original_options: q.options,
                  original_correct_answer: q.correct_answer,
                  revised_text: textToUse,
                  revised_options: optionsToUse,
                  revised_correct_answer: correctAnswerToUse,
                  timestamp: new Date().toISOString(),
                  reason: "Item Analysis revision",
                },
              ]
            : []),
        ],
      };
    });

    if (newQuestions.length > 0) {
      const { error: insertError } = await supabase
        .from("questions")
        .insert(newQuestions);

      if (insertError) {
        throw new Error(`Failed to copy questions to new version: ${insertError.message}`);
      }
    }

    // 8. Clean up staged pending revision draft fields on source questions
    const sourceQuestionIds = (sourceQuestions || []).map((q) => q.id);
    if (sourceQuestionIds.length > 0) {
      await supabase
        .from("questions")
        .update({
          revised_content: null,
          revised_options: null,
        })
        .in("id", sourceQuestionIds);
    }

    // 9. Log the revision audit event
    await logAudit({
      action: "REVISION_CREATED",
      tableName: "quizzes",
      recordId: newQuiz.id,
      newValues: {
        quizId: newQuiz.id,
        parentQuizId: rootId,
        versionNumber: newVersion,
        revisedQuestionsCount: revisedQuestions.length,
      },
    });

    return { quizId: newQuiz.id, error: null };
  } catch (err) {
    console.error("Error creating quiz version:", err);
    return { quizId: null, error: err.message };
  }
};
