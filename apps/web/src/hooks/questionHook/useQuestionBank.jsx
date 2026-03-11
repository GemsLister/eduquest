import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";

export const useQuestionBank = () => {
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [archivedQuestions, setArchivedQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

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
        .select("*, quizzes(title)")
        .in("quiz_id", quizIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Separate active and archived questions
      const active = data?.filter((q) => !q.is_archived) || [];
      const archived = data?.filter((q) => q.is_archived) || [];

      setActiveQuestions(active);
      setArchivedQuestions(archived);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching questions:", error);
      setLoading(false);
    }
  };

  // Archive a question
  const archiveQuestion = async (questionId) => {
    try {
      const { error } = await supabase
        .from("questions")
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq("id", questionId);

      if (error) throw error;

      // Move from active to archived
      const question = activeQuestions.find((q) => q.id === questionId);
      if (question) {
        setActiveQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setArchivedQuestions((prev) => [...prev, { ...question, is_archived: true }]);
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
        setActiveQuestions((prev) => [...prev, { ...question, is_archived: false }]);
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
      const { error: questionError } = await supabase
        .from("questions")
        .insert({
          quiz_id: quiz.id,
          type: questionData.type || "mcq",
          text: questionData.text,
          options: questionData.options,
          correct_answer: questionData.correctAnswer,
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

