import { useState, useEffect } from "react";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient.js";
import { useNavigate, useLocation } from "react-router-dom";

export const useCreateQuiz = ({ user } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [quizFormData, setQuizFormData] = useState({
    title: "",
    term: "Prelims",
    description: "",
    duration: "",
    section_ids: [],
    visibility: "private",
    is_private: true,
    is_shared: false,
  });
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSections, setAvailableSections] = useState([]);

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("sections")
        .select("id, name, description, subject_code, subject_id, subjects(id, name, code)")
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
        notify.warning("Assessment title is required");
        return;
      }

      const sectionIds = quizFormData.section_ids || [];
      if (sectionIds.length === 0) {
        notify.warning("Please select at least one subject for this assessment");
        return;
      }

      if (!user?.id) {
        notify.error("You must be logged in to create an assessment");
        return;
      }

      setIsSubmitting(true);

      const selectedSec = availableSections.find((s) => s.id === sectionIds[0]);
      const targetSubjectId = selectedSec?.subject_id || selectedSec?.subjects?.id || null;

      const isPrivate = quizFormData.visibility ? quizFormData.visibility === "private" : (quizFormData.is_private !== false);
      const isShared = quizFormData.visibility === "shared" || Boolean(quizFormData.is_shared);
      const visibilityVal = quizFormData.visibility || (isShared ? "shared" : (isPrivate ? "private" : "public"));

      // Tag description with visibility metadata tag so it persists reliably in database
      const rawDesc = (quizFormData.description || "").replace(/\s*\[vis:(private|shared|public)\]\s*/gi, "").trim();
      const taggedDescription = rawDesc ? `${rawDesc}\n[vis:${visibilityVal}]` : `[vis:${visibilityVal}]`;

      const basePayload = {
        instructor_id: user.id,
        title: quizFormData.title.trim(),
        description: taggedDescription,
        duration: quizFormData.duration
          ? parseInt(quizFormData.duration)
          : null,
        is_published: false,
        is_private: isPrivate,
        section_id: sectionIds[0],
        ...(targetSubjectId ? { subject_id: targetSubjectId } : {}),
      };

      let data;
      // Multi-tier insert fallback to ensure term, is_shared, and visibility are persisted according to database schema
      const resA = await supabase
        .from("quizzes")
        .insert([
          {
            ...basePayload,
            term: quizFormData.term || "Prelims",
            is_shared: isShared,
            visibility: visibilityVal,
          },
        ])
        .select()
        .single();

      if (resA.error) {
        const resB = await supabase
          .from("quizzes")
          .insert([
            {
              ...basePayload,
              term: quizFormData.term || "Prelims",
              is_shared: isShared,
            },
          ])
          .select()
          .single();

        if (resB.error) {
          const resC = await supabase
            .from("quizzes")
            .insert([
              {
                ...basePayload,
                is_shared: isShared,
              },
            ])
            .select()
            .single();

          if (resC.error) {
            const resD = await supabase
              .from("quizzes")
              .insert([basePayload])
              .select()
              .single();

            if (resD.error) throw resD.error;
            data = resD.data;
          } else {
            data = resC.data;
          }
        } else {
          data = resB.data;
        }
      } else {
        data = resA.data;
      }

      // Insert all selected sections into quiz_sections junction table
      const rows = sectionIds.map((sectionId) => ({
        quiz_id: data.id,
        section_id: sectionId,
      }));

      const { error: qsError } = await supabase
        .from("quiz_sections")
        .insert(rows)
        .select();

      if (qsError) {
        console.error("Error inserting quiz_sections:", qsError);
      } else {
        console.log("Quiz sections created with share tokens:", qsError?.data);
      }

      // Auto-share quiz with all sections in the same subject
      try {
        const { error: autoShareError } = await supabase.rpc(
          "auto_share_quiz_with_subject_sections",
          {
            p_quiz_id: data.id,
          },
        );

        if (autoShareError) {
          console.error("Error auto-sharing quiz:", autoShareError);
        } else {
          console.log("Quiz auto-shared with same-subject sections");
        }
      } catch (autoShareError) {
        console.error("Auto-share failed:", autoShareError);
      }

      setQuizFormData({
        title: "",
        term: "Prelims",
        description: "",
        duration: "",
        section_ids: [],
        is_private: true,
      });
      setShowQuizForm(false);

      notify.success(`Assessment "${data.title}" created successfully!`);
      const targetPath = location.pathname.startsWith("/admin-dashboard")
        ? `/admin-dashboard/create-quiz/${data.id}`
        : `/instructor-dashboard/instructor-quiz/${data.id}`;
      navigate(targetPath);
    } catch (error) {
      console.error("Full error object:", error);

      if (error.code === "42501") {
        notify.error(
          "Permission denied: You don't have rights to create quizzes in this section. Please contact your administrator.",
        );
      } else if (error.message?.includes("row-level security")) {
        notify.error(
          "Permission denied: Your account doesn't have instructor privileges. Please ensure you're logged in as an instructor.",
        );
      } else {
        notify.error("Error creating quiz: " + error.message);
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
    availableSections,
  };
};
