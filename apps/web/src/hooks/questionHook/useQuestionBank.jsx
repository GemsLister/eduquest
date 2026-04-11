import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

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

      if (!existing) {
        // Initialize with the current quiz_id in an array
        byKey.set(key, { 
          ...question, 
          all_quiz_ids: [question.quiz_id] 
        });
        continue;
      }

      // Add the current quiz_id to the existing canonical entry's list
      if (!existing.all_quiz_ids.includes(question.quiz_id)) {
        existing.all_quiz_ids.push(question.quiz_id);
      }

      // Keep the oldest version as the canonical bank entry for metadata purposes,
      // but preserve the accumulated all_quiz_ids.
      const existingTime = new Date(existing.created_at || 0).getTime();
      const currentTime = new Date(question.created_at || 0).getTime();
      if (currentTime < existingTime) {
        const updatedCanonical = { 
          ...question, 
          all_quiz_ids: existing.all_quiz_ids 
        };
        byKey.set(key, updatedCanonical);
      }
    }

    return Array.from(byKey.values());
  };

  const fetchQuestions = async () => {
    if (!user) return;
    try {

      // Get instructor's quizzes, then keep only the latest version of each
      // chain so revised quizzes replace — rather than duplicate — their
      // originals in the question bank.
      const { data: quizzesData } = await supabase
        .from("quizzes")
        .select("id, parent_quiz_id, version_number, is_archived")
        .eq("instructor_id", user.id);

      const nonArchived = (quizzesData || []).filter((q) => !q.is_archived);
      const latestByRoot = new Map();
      for (const quiz of nonArchived) {
        const rootId = quiz.parent_quiz_id || quiz.id;
        const version = quiz.version_number || 1;
        const existing = latestByRoot.get(rootId);
        if (!existing || version > (existing.version_number || 1)) {
          latestByRoot.set(rootId, quiz);
        }
      }
      const quizIds = Array.from(latestByRoot.values()).map((q) => q.id);

      if (quizIds.length === 0) {
        setActiveQuestions([]);
        setArchivedQuestions([]);
        setLoading(false);
        return;
      }

      // Fetch all questions from instructor's quizzes
      const { data, error } = await supabase
        .from("questions")
        .select("*, revision_history, revised_options, updated_at, created_at, quizzes(title, is_published)")
        .in("quiz_id", quizIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 1. Deduplicate ALL fetched questions by content first.
      const allUniqueQuestions = dedupeQuestions(data || []);

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

      // Move from active to archived
      const question = activeQuestions.find((q) => q.id === questionId);
      if (question) {
        const updatedQuestion = { 
          ...question, 
          is_archived: true,
          section_id: sectionId || question.section_id
        };
        setActiveQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setArchivedQuestions((prev) => [
          ...prev,
          updatedQuestion,
        ]);
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
      // 1. Identify all versions of this question (including duplicates across quizzes)
      const questionToDelete =
        activeQuestions.find((q) => q.id === questionId) ||
        archivedQuestions.find((q) => q.id === questionId);

      if (!questionToDelete) return { success: false, error: "Question not found" };

      // Check if the quiz is published or has attempts
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

      // Use the stored all_quiz_ids to find all instances
      const allIds = questionToDelete.all_quiz_ids || [questionToDelete.quiz_id];

      // 2. Delete responses for all identified question instances first
      const { data: dbVersions } = await supabase
        .from("questions")
        .select("id")
        .in("quiz_id", allIds)
        .eq("text", questionToDelete.text);

      const dbIds = dbVersions?.map((v) => v.id) || [questionId];

      // Safe to delete — quiz is unpublished with no attempts
      await supabase
        .from("quiz_responses")
        .delete()
        .in("question_id", dbIds);

      // 3. Delete all identified versions of the question
      const { error } = await supabase
        .from("questions")
        .delete()
        .in("id", dbIds);

      if (error) throw error;

      // 4. Refresh local state
      await fetchQuestions();

      return { success: true };
    } catch (error) {
      console.error("Error deleting question:", error);
      return { success: false, error: error.message };
    }
  };

  // Add a new question to the bank (without assigning to a quiz yet)
  const addToBank = async (questionData) => {
    try {
      if (!user) return { success: false, error: "Not authenticated" };

      // Create a draft quiz for the question
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          instructor_id: user.id,
          title: "Question Bank - Draft",
          is_published: false,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Add question to the draft quiz
      const correctAnswer =
        questionData.type === "mcq"
          ? questionData.options[questionData.correctAnswer] || questionData.correctAnswer
          : questionData.type === "true_false"
            ? questionData.correctAnswer === 0 ? "true" : "false"
            : questionData.correctAnswer;

      const { error: questionError } = await supabase.from("questions").insert({
        quiz_id: quiz.id,
        type: questionData.type || "mcq",
        text: questionData.text,
        options: questionData.type === "mcq" ? questionData.options.filter((opt) => opt.trim()) : null,
        correct_answer: correctAnswer,
        points: questionData.points || 1,
        is_archived: false,
      });

      if (questionError) throw questionError;

      await fetchQuestions();
      return { success: true };
    } catch (error) {
      console.error("Error adding to bank:", error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  return {
    fetchQuestions,
    activeQuestions,
    archivedQuestions,
    loading,
    archiveQuestion,
    restoreQuestion,
    deleteQuestion,
    addToBank,
  };
};
