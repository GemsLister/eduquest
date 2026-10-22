import { useState, useEffect } from "react";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient.js";
import { useNavigate, useLocation } from "react-router-dom";

export const useCreateQuiz = ({ user } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [quizFormData, setQuizFormData] = useState({
    title: "",
    description: "",
    duration: "",
    section_ids: [],
    is_private: true,
  });
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSections, setAvailableSections] = useState([]);

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("sections")
        .select("id, name, description, subject_code")
        .eq("instructor_id", user.id)
        .eq("is_archived", false)
        .order("name")
        .then(({ data }) => {
          setAvailableSections(data || []);
        });
    }
  }, [user?.id]);

  const handleCreateQuiz = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    try {
      if (!quizFormData.title.trim()) {
        notify.warning("Exam title is required");
        return false;
      }

      const sectionIds = quizFormData.section_ids || [];
      if (sectionIds.length === 0) {
        notify.warning("Please select at least one section for this exam");
        return false;
      }

      const duration = quizFormData.duration ? parseInt(quizFormData.duration) : null;
      if (duration !== null && (isNaN(duration) || duration < 1)) {
        notify.warning("Duration must be at least 1 minute, or left blank for no time limit");
        return false;
      }

      if (!user?.id) {
        notify.error("You must be logged in to create an exam");
        return false;
      }

      setIsSubmitting(true);

      const { data, error } = await supabase
        .from("quizzes")
        .insert([
          {
            instructor_id: user.id,
            title: quizFormData.title.trim(),
            description: quizFormData.description.trim() || null,
            duration,
            is_published: false,
            is_private: quizFormData.is_private !== false,
            section_id: sectionIds[0],
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase error details:", error);
        throw error;
      }

      // Insert all selected sections into quiz_sections junction table
      const rows = sectionIds.map((sectionId) => ({
        quiz_id: data.id,
        section_id: sectionId,
      }));

      const { error: qsError } = await supabase.from("quiz_sections").insert(rows);
      if (qsError) {
        console.error("Error inserting quiz_sections:", qsError);
      }

      // Auto-share quiz with all sections in the same subject
      try {
        const { error: autoShareError } = await supabase.rpc("auto_share_quiz_with_subject_sections", {
          p_quiz_id: data.id
        });
        
        if (autoShareError) {
          console.error("Error auto-sharing quiz:", autoShareError);
        }
      } catch (autoShareError) {
        console.error("Auto-share failed:", autoShareError);
      }

      setQuizFormData({ title: "", description: "", duration: "", section_ids: [], is_private: true });
      setShowQuizForm(false);

      notify.success(`Exam "${data.title}" created successfully!`);
      const targetPath = location.pathname.startsWith("/admin-dashboard")
        ? `/admin-dashboard/create-quiz/${data.id}`
        : `/instructor-dashboard/instructor-quiz/${data.id}`;
      navigate(targetPath);
      return true;
    } catch (error) {
      console.error("Full error object:", error);

      if (error.code === "42501") {
        notify.error(
          "Permission denied: You don't have rights to create exams in this section. Please contact your administrator.",
        );
      } else if (error.message?.includes("row-level security")) {
        notify.error(
          "Permission denied: Your account doesn't have instructor privileges. Please ensure you're logged in as an instructor.",
        );
      } else {
        notify.error("Error creating exam: " + error.message);
      }
      return false;
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
    availableSections,
  };
};
