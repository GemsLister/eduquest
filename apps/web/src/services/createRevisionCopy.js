import { supabase } from "../supabaseClient";

/**
 * Create a copy of a quiz for revision purposes.
 * The original quiz stays untouched; the instructor edits the copy.
 *
 * @param {string} originalQuizId - The quiz to copy
 * @returns {Promise<object>} The newly created quiz record
 */
export const createRevisionCopy = async (originalQuizId) => {
  // 1. Fetch original quiz
  const { data: originalQuiz, error: quizError } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", originalQuizId)
    .single();

  if (quizError || !originalQuiz) {
    throw new Error("Failed to fetch original quiz");
  }

  const rootId = originalQuiz.parent_quiz_id || originalQuizId;

  // 2. Get the highest version number across the ENTIRE chain
  const { data: allVersions } = await supabase
    .from("quizzes")
    .select("id, version_number")
    .or(`id.eq.${rootId},parent_quiz_id.eq.${rootId}`)
    .order("version_number", { ascending: false });

  const maxVersion = Math.max(
    ...((allVersions || []).map((v) => v.version_number || 1)),
    1,
  );
  const versionNumber = maxVersion + 1;

  // 3. Build the title
  const baseTitle = originalQuiz.title.replace(
    /\s*\(Revised(?:\s+\d+)?\)\s*$/,
    "",
  );
  const newTitle = `${baseTitle} (Revised ${versionNumber - 1})`;

  // 4. Create new quiz
  const { data: newQuiz, error: createError } = await supabase
    .from("quizzes")
    .insert({
      instructor_id: originalQuiz.instructor_id,
      section_id: originalQuiz.section_id,
      title: newTitle,
      description: originalQuiz.description,
      duration: originalQuiz.duration,
      is_published: false,
      is_archived: false,
      parent_quiz_id: rootId,
      version_number: versionNumber,
    })
    .select()
    .single();

  if (createError || !newQuiz) {
    throw new Error("Failed to create quiz revision");
  }

  // 5. Copy questions from the quiz being revised
  const { data: originalQuestions, error: questionsError } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_id", originalQuizId)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (questionsError) {
    throw new Error("Failed to fetch original questions");
  }

  if (originalQuestions?.length > 0) {
    const now = new Date();
    const newQuestions = originalQuestions.map((q, index) => ({
      quiz_id: newQuiz.id,
      text: q.text,
      type: q.type,
      options: q.options,
      correct_answer: q.correct_answer,
      points: q.points,
      blooms_level: q.blooms_level,
      created_at: new Date(now.getTime() + index * 1000).toISOString(),
    }));

    const { error: insertError } = await supabase
      .from("questions")
      .insert(newQuestions);

    if (insertError) {
      throw new Error("Failed to copy questions to revision");
    }
  }

  // 6. Mark original quiz AND all versions in the chain as having a revision
  const allIds = (allVersions || []).map((v) => v.id);
  if (allIds.length > 0) {
    await supabase
      .from("quizzes")
      .update({ has_revision: true, latest_version_id: newQuiz.id })
      .in("id", allIds);
  }

  // 7. Copy section assignments
  const { data: sectionData } = await supabase
    .from("quiz_sections")
    .select("section_id")
    .eq("quiz_id", originalQuizId);

  if (sectionData?.length > 0) {
    await supabase.from("quiz_sections").insert(
      sectionData.map((s) => ({
        quiz_id: newQuiz.id,
        section_id: s.section_id,
      })),
    );
  }

  return newQuiz;
};
