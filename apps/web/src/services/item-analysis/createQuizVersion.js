import { supabase } from "../../supabaseClient";

/**
 * Create a new version of a quiz with revisions applied
 * @param {string} originalQuizId - Original quiz ID
 * @param {Array} revisedQuestions - Questions with revisions
 * @returns {Promise<{quizId: string, error: null|string}>}
 */
export const createQuizVersion = async (originalQuizId, revisedQuestions) => {
  try {
    // 1. Fetch the original quiz
    const { data: originalQuiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", originalQuizId)
      .single();

    if (quizError) throw new Error("Failed to fetch original quiz");

    // 2. Get all sections to find instructor ID
    const instructorId = originalQuiz.instructor_id;

    // 3. Find next version number
    const { data: existingVersions } = await supabase
      .from("quizzes")
      .select("title")
      .eq("instructor_id", instructorId)
      .like("title", `${originalQuiz.title}%v%`);

    let versionNumber = 2;
    if (existingVersions && existingVersions.length > 0) {
      const versions = existingVersions.map((q) => {
        const match = q.title.match(/v(\d+)/);
        return match ? parseInt(match[1]) : 1;
      });
      versionNumber = Math.max(...versions) + 1;
    }

    // 4. Create new quiz with version in title
    const newQuizTitle = `${originalQuiz.title} - v${versionNumber} (Revised)`;
    const { data: newQuiz, error: createError } = await supabase
      .from("quizzes")
      .insert({
        instructor_id: originalQuiz.instructor_id,
        section_id: originalQuiz.section_id,
        title: newQuizTitle,
        description: `${originalQuiz.description || ""} [Auto-generated from Item Analysis revisions]`.trim(),
        status: "draft",
        is_archived: false,
        parent_quiz_id: originalQuizId,
        version_number: versionNumber,
      })
      .select()
      .single();

    if (createError) throw new Error("Failed to create new quiz version");

    // 5. Fetch all questions from original quiz
    const { data: allQuestions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", originalQuizId);

    if (questionsError) throw new Error("Failed to fetch original questions");

    // 6. Create a map of revised questions by ID
    const revisedMap = {};
    revisedQuestions.forEach((q) => {
      revisedMap[q.question_id] = q;
    });

    // 7. Copy questions to new quiz with revisions applied
    const newQuestions = allQuestions.map((q) => {
      const revised = revisedMap[q.id];
      
      // Determine what text/options/correct_answer to use
      let textToUse = q.text;
      let optionsToUse = q.options;
      let correctAnswerToUse = q.correct_answer;
      let originalText = q.text;
      let originalOptions = q.options;
      let originalCorrect = q.correct_answer;
      
      // If there are pending revisions, use those
      if (revised?.revised_content) {
        textToUse = revised.revised_content;
        correctAnswerToUse = revised.revised_correct_answer || q.correct_answer;
      }
      
      if (revised?.revised_options) {
        optionsToUse = revised.revised_options;
      }
      
      // If there's revision history (finalized revisions), extract the original from it
      if (revised?.revision_history && revised.revision_history.length > 0) {
        const lastRevision = revised.revision_history[revised.revision_history.length - 1];
        // Use the last history entry's values as "original" for this version
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
        revision_history: [
          ...(q.revision_history || []),
          {
            version: versionNumber,
            original_text: originalText,
            original_options: originalOptions,
            original_correct_answer: originalCorrect,
            revised_text: revised?.revised_content || textToUse,
            revised_options: revised?.revised_options || optionsToUse,
            revised_correct_answer: revised?.revised_correct_answer || correctAnswerToUse,
            timestamp: new Date().toISOString(),
            reason: "Item Analysis revision",
          },
        ],
      };
    });

    const { data: insertedQuestions, error: insertError } = await supabase
      .from("questions")
      .insert(newQuestions)
      .select();

    if (insertError) throw new Error("Failed to copy questions to new version");

    // 8. Mark original quiz as having a revision
    await supabase
      .from("quizzes")
      .update({ has_revision: true, latest_version_id: newQuiz.id })
      .eq("id", originalQuizId);

    return { quizId: newQuiz.id, error: null };
  } catch (err) {
    console.error("Error creating quiz version:", err);
    return { quizId: null, error: err.message };
  }
};
