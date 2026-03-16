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

      // Check if user is authenticated
      if (!user?.id) {
        alert("You must be logged in to create a quiz");
        return;
      }

      setIsSubmitting(true);

      console.log("Creating quiz with user:", user);
      console.log("Section ID:", sectionId);

      const { data, error } = await supabase
        .from("quizzes")
        .insert([
          {
            instructor_id: user.id, // Ensure this matches auth.uid()
            section_id: sectionId,
            title: quizFormData.title.trim(),
            description: quizFormData.description.trim() || null,
            is_published: false,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase error details:", error);
        throw error;
      }

      setQuizFormData({ title: "", description: "" });
      setShowQuizForm(false);

      navigate(`/instructor-dashboard/instructor-quiz/${data.id}`);
    } catch (error) {
      console.error("Full error object:", error);

      // More specific error handling
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
