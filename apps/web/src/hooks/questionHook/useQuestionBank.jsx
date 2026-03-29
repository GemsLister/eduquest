import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";

export const useQuestionBank = () => {
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
        byKey.set(key, question);
        continue;
      }

      // Keep the oldest version as the canonical bank entry.
      const existingTime = new Date(existing.created_at || 0).getTime();
      const currentTime = new Date(question.created_at || 0).getTime();
      if (currentTime < existingTime) {
        byKey.set(key, question);
      }
    }

    return Array.from(byKey.values());
  };

  const fetchQuestions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get instructor's quiz IDs
      const { data: quizzesData } = await supabase
        .from("quizzes")
        .select("id")
        .eq("instructor_id", user.id);

      const quizIds = quizzesData?.map((q) => q.id) || [];

      if (quizIds.length === 0) {
        setActiveQuestions([]);
        setArchivedQuestions([]);
        setLoading(false);
        return;
      }

      // Fetch all questions from instructor's quizzes
      const { data, error } = await supabase
        .from("questions")
        .select("*, revision_history, revised_options, updated_at, created_at, quizzes(title)")
        .in("quiz_id", quizIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Separate active and archived questions, then remove content duplicates.
      const active = dedupeQuestions(data?.filter((q) => !q.is_archived) || []);
      const archived = dedupeQuestions(
        data?.filter((q) => q.is_archived) || [],
      );

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

  // Delete a question permanently
  const deleteQuestion = async (questionId) => {
    try {
      // First delete responses
      await supabase
        .from("quiz_responses")
        .delete()
        .eq("question_id", questionId);

      // Then delete the question
      const { error } = await supabase
        .from("questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;

      // Remove from both lists
      setActiveQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setArchivedQuestions((prev) => prev.filter((q) => q.id !== questionId));

      return { success: true };
    } catch (error) {
      console.error("Error deleting question:", error);
      return { success: false, error: error.message };
    }
  };

  // Add a new question to the bank (without assigning to a quiz yet)
  const addToBank = async (questionData) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
