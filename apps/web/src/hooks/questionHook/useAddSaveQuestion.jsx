import { useState } from "react";
import { supabase } from "../../supabaseClient.js";

export const useAddSaveQuestion = () => {
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    text: "",
    options: ["", ""],
    correctAnswer: 0,
    points: 1,
    flag: "pending",
    quiz_id: null,
  });

  const handleAddQuestion = () => {
    setEditingId(null);
    setFormData({
      text: "",
      options: ["", ""],
      correctAnswer: 0,
      points: 1,
      flag: "pending",
      quiz_id: null,
    });
    setShowForm(true);
  };

  const handleSaveQuestion = async () => {
    if (!formData.text.trim()) {
      alert("Question text is required");
      return;
    }
    if (formData.type === "mcq" && formData.options.some((o) => !o.trim())) {
      alert("All options must be filled");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (editingId) {
        // Update existing question
        const { error } = await supabase
          .from("questions")
          .update({
            text: formData.text,
            options: formData.options,
            correct_answer: formData.correctAnswer,
            points: formData.points,
            flag: formData.flag,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) {
          console.error("Error updating question:", error);
          alert("Failed to update question: " + error.message);
          return;
        }
        alert("Question updated successfully!");
      } else {
        // Create new question - need quiz_id
        if (!formData.quiz_id) {
          alert("Please select a quiz first");
          return;
        }

        const { error } = await supabase
          .from("questions")
          .insert({
            quiz_id: formData.quiz_id,
            type: "mcq", // Default type
            text: formData.text,
            options: formData.options,
            correct_answer: formData.correctAnswer,
            points: formData.points,
            flag: formData.flag,
          });

        if (error) {
          console.error("Error creating question:", error);
          alert("Failed to create question: " + error.message);
          return;
        }
        alert("Question created successfully!");
      }

      setShowForm(false);
      setFormData({
        text: "",
        options: ["", ""],
        correctAnswer: 0,
        points: 1,
        flag: "pending",
        quiz_id: null,
      });

      // Refresh questions list
      window.dispatchEvent(new Event("questions-updated"));
    } catch (error) {
      console.error("Error saving question:", error);
      alert("An error occurred while saving the question");
    }
  };

  // Function to update question flag
  const updateQuestionFlag = async (questionId, newFlag) => {
    try {
      const { error } = await supabase
        .from("questions")
        .update({
          flag: newFlag,
          updated_at: new Date().toISOString(),
        })
        .eq("id", questionId);

      if (error) {
        console.error("Error updating flag:", error);
        return false;
      }

      // Update local state
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, flag: newFlag } : q
        )
      );

      return true;
    } catch (error) {
      console.error("Error updating flag:", error);
      return false;
    }
  };

  // Need access to setQuestions from parent
  const setQuestions = (callback) => {
    // This will be overridden by the component using this hook
    window.dispatchEvent(new Event("questions-updated"));
  };

  return {
    handleAddQuestion,
    handleSaveQuestion,
    setEditingId,
    formData,
    setFormData,
    setShowForm,
    showForm,
    updateQuestionFlag,
  };
};
