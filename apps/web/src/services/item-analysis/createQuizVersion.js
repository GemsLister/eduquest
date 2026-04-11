import { supabase } from "../../supabaseClient";

/**
 * Create (or update) the single revision copy of a quiz from item-analysis
 * revisions.
 *
 * On the first revision cycle a new quiz row is inserted as version 2 with
 * revisions applied. On subsequent revision cycles the existing revision copy
 * is updated in place — its version_number is bumped, its title is
 * re-suffixed, and the newest revisions are layered onto its existing
 * questions (preserving the accumulated revision_history).
 *
 * @param {string} originalQuizId - Quiz the analysis was run against
 * @param {Array} revisedQuestions - Questions with revisions
 * @returns {Promise<{quizId: string, error: null|string}>}
 */
export const createQuizVersion = async (originalQuizId, revisedQuestions) => {
  try {
    // 1. Fetch the quiz the caller handed us.
    const { data: originalQuiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", originalQuizId)
      .single();

    if (quizError) throw new Error("Failed to fetch original quiz");

    const rootId = originalQuiz.parent_quiz_id || originalQuizId;

    // 2. Fetch the root quiz for title base and instructor id.
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

    // 3. Build a map of the incoming revisions keyed by question id.
    const revisedMap = {};
    revisedQuestions.forEach((q) => {
      revisedMap[q.question_id] = q;
    });

    // 4. Check for an existing revision copy of this chain.
    const { data: existingRevisions } = await supabase
      .from("quizzes")
      .select("*")
      .eq("parent_quiz_id", rootId)
      .eq("is_archived", false)
      .order("version_number", { ascending: false });

    const existingRevision = (existingRevisions || [])[0] || null;

    // ============ Branch B: update the existing revision copy ============
    if (existingRevision) {
      const newVersion = (existingRevision.version_number || 2) + 1;
      const newTitle =
        newVersion === 2
          ? `${baseTitle} (Revised)`
          : `${baseTitle} (Revised ${newVersion - 1})`;

      const { error: updateError } = await supabase
        .from("quizzes")
        .update({
          version_number: newVersion,
          title: newTitle,
          is_published: false,
        })
        .eq("id", existingRevision.id);

      if (updateError) {
        throw new Error(
          `Failed to update existing revision copy: ${updateError.message}`,
        );
      }

      // Layer the new revisions onto the revision copy's existing questions.
      const { data: copyQuestions, error: copyQuestionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", existingRevision.id)
        .order("created_at", { ascending: true });

      if (copyQuestionsError) {
        throw new Error("Failed to fetch revision-copy questions");
      }

      for (const q of copyQuestions || []) {
        const revised = revisedMap[q.id];
        if (!revised) continue;

        const textToUse = revised.revised_content || q.text;
        const optionsToUse = revised.revised_options || q.options;
        const correctAnswerToUse =
          revised.revised_correct_answer || q.correct_answer;

        const newHistoryEntry = {
          version: newVersion,
          original_text: q.text,
          original_options: q.options,
          original_correct_answer: q.correct_answer,
          revised_text: textToUse,
          revised_options: optionsToUse,
          revised_correct_answer: correctAnswerToUse,
          timestamp: new Date().toISOString(),
          reason: "Item Analysis revision",
        };

        const { error: qUpdateError } = await supabase
          .from("questions")
          .update({
            text: textToUse,
            options: optionsToUse,
            correct_answer: correctAnswerToUse,
            revision_history: [
              ...(q.revision_history || []),
              newHistoryEntry,
            ],
          })
          .eq("id", q.id);

        if (qUpdateError) {
          throw new Error(
            `Failed to update revision-copy question: ${qUpdateError.message}`,
          );
        }
      }

      // Record another auto-approved submission against the revision copy.
      await supabase.from("quiz_analysis_submissions").insert({
        quiz_id: existingRevision.id,
        instructor_id: instructorId,
        analysis_results: { auto_generated: true },
        instructor_message:
          "Auto-generated submission from Item Analysis revisions.",
        status: "approved",
        admin_feedback: "Auto-approved revision based on Item Analysis.",
      });

      return { quizId: existingRevision.id, error: null };
    }

    // ============ Branch A: create v2 from the root ============
    const versionNumber = 2;
    const newQuizTitle = `${baseTitle} (Revised)`;

    const { data: newQuiz, error: createError } = await supabase
      .from("quizzes")
      .insert({
        instructor_id: rootQuiz.instructor_id,
        section_id: rootQuiz.section_id,
        title: newQuizTitle,
        description: `${rootQuiz.description || ""} [Auto-generated from Item Analysis revisions]`.trim(),
        is_published: false,
        is_archived: false,
        parent_quiz_id: rootId,
        version_number: versionNumber,
      })
      .select()
      .single();

    if (createError) {
      console.error("Supabase createError:", createError);
      throw new Error(
        `Failed to create new quiz version: ${createError.message || JSON.stringify(createError)}`,
      );
    }

    // Fetch all questions from the root quiz, ordered by creation time.
    const { data: allQuestions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", rootId)
      .order("created_at", { ascending: true });

    if (questionsError) throw new Error("Failed to fetch original questions");

    const now = new Date();

    const newQuestions = (allQuestions || []).map((q, index) => {
      const revised = revisedMap[q.id];

      let textToUse = q.text;
      let optionsToUse = q.options;
      let correctAnswerToUse = q.correct_answer;
      let originalText = q.text;
      let originalOptions = q.options;
      let originalCorrect = q.correct_answer;

      if (revised?.revised_content) {
        textToUse = revised.revised_content;
        correctAnswerToUse = revised.revised_correct_answer || q.correct_answer;
      }

      if (revised?.revised_options) {
        optionsToUse = revised.revised_options;
      }

      if (revised?.revision_history && revised.revision_history.length > 0) {
        const lastRevision =
          revised.revision_history[revised.revision_history.length - 1];
        originalText = lastRevision.text || q.text;
        originalOptions = lastRevision.options || q.options;
        originalCorrect = lastRevision.correct_answer || q.correct_answer;
      }

      return {
        quiz_id: newQuiz.id,
        text: textToUse,
        type: q.type,
        options: optionsToUse,
        correct_answer: correctAnswerToUse,
        points: q.points,
        blooms_level: q.blooms_level,
        created_at: new Date(now.getTime() + index * 1000).toISOString(),
        revision_history: [
          ...(q.revision_history || []),
          {
            version: versionNumber,
            original_text: originalText,
            original_options: originalOptions,
            original_correct_answer: originalCorrect,
            revised_text: revised?.revised_content || textToUse,
            revised_options: revised?.revised_options || optionsToUse,
            revised_correct_answer:
              revised?.revised_correct_answer || correctAnswerToUse,
            timestamp: new Date().toISOString(),
            reason: "Item Analysis revision",
          },
        ],
      };
    });

    const { error: insertError } = await supabase
      .from("questions")
      .insert(newQuestions);

    if (insertError) throw new Error("Failed to copy questions to new version");

    await supabase.from("quiz_analysis_submissions").insert({
      quiz_id: newQuiz.id,
      instructor_id: instructorId,
      analysis_results: { auto_generated: true },
      instructor_message:
        "Auto-generated submission from Item Analysis revisions.",
      status: "approved",
      admin_feedback: "Auto-approved revision based on Item Analysis.",
    });

    return { quizId: newQuiz.id, error: null };
  } catch (err) {
    console.error("Error creating quiz version:", err);
    return { quizId: null, error: err.message };
  }
};
