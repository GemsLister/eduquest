import { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { useParams } from "react-router-dom";
export const useCreateQuiz = ({ user }) => {
  const { sectionId } = useParams();
  const [quizFormData, setQuizFormData] = useState({
    title: "",
    description: "",
  });
  const [showQuizForm, setShowQuizForm] = useState(false);
  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    try {
      if (!quizFormData.title.trim()) {
        alert("Quiz title is required");
        return;
      }

      const { data, error } = await supabase
        .from("quizzes")
        .insert([
          {
            instructor_id: user?.id,
            section_id: sectionId,
            title: quizFormData.title.trim(),
            description: quizFormData.description.trim() || null,
            is_published: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Reset form
      setQuizFormData({ title: "", description: "" });
      setShowQuizForm(false);

      // Navigate to quiz editor to add questions
      navigate(`/instructor-dashboard/instructor-quiz/${data[0].id}`);
    } catch (error) {
      alert("Error creating quiz: " + error.message);
      console.error("Error creating quiz:", error);
    }
  };
  return {
    handleCreateQuiz,
    quizFormData,
    showQuizForm,
    setShowQuizForm,
    setQuizFormData,
  };
};
