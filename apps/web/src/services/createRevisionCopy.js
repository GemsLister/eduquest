import { supabase } from "../supabaseClient";

/**
 * Create (or update) the single revision copy of a quiz.
 *
 * On the first revision cycle a new quiz row is inserted as version 2 so the
 * original (v1) stays untouched as the historical record. On every subsequent
 * revision cycle the existing revision copy is updated in place — its
 * version_number is bumped (2 → 3 → 4 ...) and its title is re-suffixed, but
 * no new quiz row is created and the instructor's prior edits are preserved.
 *
 * @param {string} originalQuizId - The quiz the instructor clicked "Edit & Resubmit" on
 * @returns {Promise<object>} The revision-copy quiz record (new or updated)
 */
export const createRevisionCopy = async (originalQuizId) => {
  // 1. Fetch the quiz the caller handed us.
  const { data: originalQuiz, error: quizError } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", originalQuizId)
    .single();

  if (quizError || !originalQuiz) {
    throw new Error("Failed to fetch original quiz");
  }

  const rootId = originalQuiz.parent_quiz_id || originalQuizId;

  // 2. Fetch the root (v1) quiz — we base titles off of it, not off of the
  //    revision copy, to avoid double-suffixing "(Revised) (Revised 2)".
  const { data: rootQuiz, error: rootError } =
    rootId === originalQuizId
      ? { data: originalQuiz, error: null }
      : await supabase
          .from("quizzes")
          .select("*")
          .eq("id", rootId)
          .single();

  if (rootError || !rootQuiz) {
    throw new Error("Failed to fetch root quiz");
  }

  const baseTitle = rootQuiz.title.replace(
    /\s*\(Revised(?:\s+\d+)?\)\s*$/,
    "",
  );

  // 3. Look for an existing revision copy of this chain.
  const { data: existingRevisions } = await supabase
    .from("quizzes")
    .select("*")
    .eq("parent_quiz_id", rootId)
    .eq("is_archived", false)
    .order("version_number", { ascending: false });

  const existingRevision = (existingRevisions || [])[0] || null;

  // Branch B: a revision copy already exists — update it in place.
  if (existingRevision) {
    const newVersion = (existingRevision.version_number || 2) + 1;
    const newTitle =
      newVersion === 2 ? `${baseTitle} (Revised)` : `${baseTitle} (Revised ${newVersion - 1})`;

    const updatePayload = {
      version_number: newVersion,
      title: newTitle,
      is_published: false,
    };

    const { error: updateError } = await supabase
      .from("quizzes")
      .update(updatePayload)
      .eq("id", existingRevision.id);

    if (updateError) {
      console.error("Revision update error:", updateError);
      throw new Error(
        `Failed to update existing revision copy: ${updateError.message || JSON.stringify(updateError)}`,
      );
    }

    return { ...existingRevision, ...updatePayload };
  }

  // Branch A: no revision copy yet — create v2 from the root.
  const versionNumber = 2;
  const newTitle = `${baseTitle} (Revised)`;

  const { data: newQuiz, error: createError } = await supabase
    .from("quizzes")
    .insert({
      instructor_id: rootQuiz.instructor_id,
      section_id: rootQuiz.section_id,
      title: newTitle,
      description: rootQuiz.description,
      duration: rootQuiz.duration,
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

  // Copy questions from the root quiz.
  const { data: originalQuestions, error: questionsError } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_id", rootId)
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

  // Copy section assignments from the root.
  const { data: sectionData } = await supabase
    .from("quiz_sections")
    .select("section_id")
    .eq("quiz_id", rootId);

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
