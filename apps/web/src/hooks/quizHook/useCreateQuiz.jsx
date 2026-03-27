import { useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../../supabaseClient.js";
import { useNavigate } from "react-router-dom";

export const useCreateQuiz = ({ user, sectionId = null } = {}) => {
  const navigate = useNavigate();
  const [quizFormData, setQuizFormData] = useState({
    title: "",
    description: "",
    duration: "",
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

      if (!user?.id) {
        alert("You must be logged in to create a quiz");
        return;
      }

      setIsSubmitting(true);

      const quizDataToInsert = {
        instructor_id: user.id,
        title: quizFormData.title.trim(),
        description: quizFormData.description.trim() || null,
        duration: quizFormData.duration ? parseInt(quizFormData.duration) : null,
        is_published: false,
      };

      if (sectionId) {
        quizDataToInsert.section_id = sectionId;
      }

      const { data, error } = await supabase
        .from("quizzes")
        .insert([quizDataToInsert])
        .select()
        .single();

      if (error) {
        console.error("Supabase error details:", error);
        throw error;
      }

      setQuizFormData({ title: "", description: "", duration: "" });
      setShowQuizForm(false);

      toast.success(`Quiz "${data.title}" created successfully!`);
      navigate(`/instructor-dashboard/instructor-quiz/${data.id}`);
    } catch (error) {
      console.error("Full error object:", error);

      if (error.code === "42501") {
        toast.error(
          "Permission denied: You don't have rights to create quizzes in this section. Please contact your administrator.",
        );
      } else if (error.message?.includes("row-level security")) {
        toast.error(
          "Permission denied: Your account doesn't have instructor privileges. Please ensure you're logged in as an instructor.",
        );
      } else {
        toast.error("Error creating quiz: " + error.message);
      }
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
