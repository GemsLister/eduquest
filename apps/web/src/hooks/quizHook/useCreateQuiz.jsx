import { useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../../supabaseClient.js";
import { useNavigate } from "react-router-dom";

export const useCreateQuiz = ({ user } = {}) => {
  const navigate = useNavigate();
  const [quizFormData, setQuizFormData] = useState({
    title: "",
    description: "",
  });
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateQuiz = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    try {
      if (!quizFormData.title.trim()) {
        toast.warning("Quiz title is required");
        return;
      }

      setIsSubmitting(true);

      const { data, error } = await supabase
        .from("quizzes")
        .insert([
          {
            instructor_id: user?.id,
            title: quizFormData.title.trim(),
            description: quizFormData.description.trim() || null,
            is_published: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setQuizFormData({ title: "", description: "" });
      setShowQuizForm(false);

      navigate(`/instructor-dashboard/instructor-quiz/${data.id}`);
    } catch (error) {
      toast.error("Error creating quiz: " + error.message);
      console.error("Error creating quiz:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    quizFormData,
    showQuizForm,
    handleCreateQuiz,
    setQuizFormData,
    isSubmitting,
  };
};
