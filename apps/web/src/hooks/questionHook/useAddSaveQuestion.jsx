import { useState } from "react";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext";

export const useAddSaveQuestion = () => {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    text: "",
    options: ["", ""],
    correctAnswer: 0,
    points: 1,
    flag: "pending",
    quiz_id: null,
    section_id: null,
    subject_id: null,
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
      section_id: null,
      subject_id: null,
    });
    setShowForm(true);
  };

  const handleSaveQuestion = async () => {
    if (!formData.text.trim()) {
      notify.warning("Question text is required");
      return;
    }
    if (formData.type === "mcq" && formData.options.some((o) => !o.trim())) {
      notify.warning("All options must be filled");
      return;
    }

    try {
      if (!user) return;

      if (editingId) {
        // Update existing question
        const { data: currentQuestion } = await supabase
          .from("questions")
          .select("text, options, revision_history")
          .eq("id", editingId)
          .single();

        const now = new Date().toISOString();
        const oldVersion = {
          text: currentQuestion.text,
          options: currentQuestion.options || [],
          timestamp: now
        };
        const newHistory = [...(currentQuestion.revision_history || []), oldVersion];

        const { error } = await supabase
          .from("questions")
          .update({
            text: formData.text,
            options: formData.options,
            correct_answer: formData.correctAnswer,
            points: formData.points,
            flag: formData.flag,
            revision_history: newHistory,
            updated_at: now,
          })
          .eq("id", editingId);

        if (error) {
          console.error("Error updating question:", error);
          notify.error("Failed to update question: " + error.message);
          return;
        }
        notify.success("Question updated successfully! Revision history saved.");
      } else {
        // Create new question (can be linked to a quiz or saved as a standalone Question Bank entry)
        const opts = (formData.options || []).filter((o) => o && o.trim());
        const correctAnswerStr =
          typeof formData.correctAnswer === "number"
            ? opts[formData.correctAnswer] || opts[0] || "N/A"
            : String(formData.correctAnswer || opts[0] || "N/A");

        const payload = {
          quiz_id: formData.quiz_id || null,
          section_id: formData.section_id || null,
          subject_id: formData.subject_id || null,
          type: formData.type || "mcq",
          text: formData.text,
          options: opts,
          correct_answer: correctAnswerStr,
          points: formData.points || 1,
          is_archived: false,
        };

        // If section_id is provided but no subject_id, derive subject from section
        if (formData.section_id && !formData.subject_id) {
          const { data: section } = await supabase
            .from("sections")
            .select("subject_id")
            .eq("id", formData.section_id)
            .single();
          
          if (section?.subject_id) {
            payload.subject_id = section.subject_id;
          }
        }

        let { error } = await supabase.from("questions").insert(payload);

        if (error) {
          console.error("Error creating question:", error);
          notify.error("Failed to create question: " + error.message);
          return;
        }
        notify.success("Question saved to Question Bank successfully!");
      }

      setShowForm(false);
      setFormData({
        text: "",
        options: ["", ""],
        correctAnswer: 0,
        points: 1,
        flag: "pending",
        quiz_id: null,
        section_id: null,
        subject_id: null,
      });

      // Refresh questions list
      window.dispatchEvent(new Event("questions-updated"));
    } catch (error) {
      console.error("Error saving question:", error);
      notify.error("An error occurred while saving the question");
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
        prev.map((q) => (q.id === questionId ? { ...q, flag: newFlag } : q)),
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
