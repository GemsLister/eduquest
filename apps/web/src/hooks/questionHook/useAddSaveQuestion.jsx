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
  });

  const handleAddQuestion = () => {
    setEditingId(null);
    setFormData({
      text: "",
      options: ["", ""],
      correctAnswer: 0,
      points: 1,
      flag: "pending",
    });
    setShowForm(true);
  };

  const handleSaveQuestion = async () => {
    if (!formData.text.trim()) {
      alert("Question text is required");
      return;
    }
    if (formData.options && formData.options.some((o) => !o.trim())) {
      alert("All options must be filled");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to save questions");
        return;
      }

      // Get the quiz_id - if editing, we need to find it from the existing question
      let quizId = formData.quiz_id;
      
      if (!quizId && editingId) {
        // Get quiz_id from the existing question
        const { data: existingQuestion, error: fetchError } = await supabase
          .from("questions")
          .select("quiz_id")
          .eq("id", editingId)
          .single();
        
        if (fetchError) {
          console.error("Error fetching existing question:", fetchError);
          alert("Failed to find the quiz for this question");
          return;
        }
        quizId = existingQuestion.quiz_id;
      }

      if (!quizId) {
        alert("No quiz selected. Please select a quiz first.");
        return;
      }

      const questionData = {
        quiz_id: quizId,
        text: formData.text,
        type: "mcq",
        options: formData.options,
        correct_answer: String(formData.correctAnswer),
        points: formData.points || 1,
        flag: formData.flag || "pending",
      };

      let error;
      
      if (editingId) {
        // Update existing question
        const { error: updateError } = await supabase
          .from("questions")
          .update({
            ...questionData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);
        
        error = updateError;
      } else {
        // Insert new question
        const { error: insertError } = await supabase
          .from("questions")
          .insert(questionData);
        
        error = insertError;
      }

      if (error) {
        console.error("Error saving question:", error);
        alert("Failed to save question: " + error.message);
        return;
      }

      alert(editingId ? "Question updated successfully!" : "Question created successfully!");
      
      // Dispatch event to notify other components
      window.dispatchEvent(new Event('questions-updated'));
      
      setShowForm(false);
      setFormData({
        text: "",
        options: ["", ""],
        correctAnswer: 0,
        points: 1,
        flag: "pending",
      });
    } catch (error) {
      console.error("Error saving question:", error);
      alert("An error occurred while saving the question");
    }
  };

  return {
    handleAddQuestion,
    handleSaveQuestion,
    setEditingId,
    setFormData,
    setShowForm,
    showForm,
    formData,
    editingId,
  };
};
