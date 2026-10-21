import { useState } from "react";
import { notify } from "../../utils/notify.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

export const useArchiveQuiz = (fetchQuizzes) => {
  const { user } = useAuth();
  const [archivingQuizId, setArchivingQuizId] = useState(null);
  const confirm = useConfirm();

  const handleArchiveQuiz = async (quizId) => {
    const confirmed = await confirm({
      title: "Archive this quiz?",
      confirmText: "Archive",
      cancelText: "Cancel",
      variant: "warning",
    });

    if (!confirmed) return;

    setArchivingQuizId(quizId);

    try {
      const { data, error } = await supabase
        .from("quizzes")
        .update({ is_archived: true, is_open: false })
        .eq("id", quizId)
        .eq("instructor_id", user?.id)
        .select("id");

      if (error) {
        throw new Error(`Failed to archive quiz: ${error.message}`);
      }
      if (!data || data.length === 0) {
        throw new Error("You can only archive quizzes you own.");
      }

      await supabase.rpc("log_quiz_status_change", {
        p_quiz_id: quizId,
        p_new_status: "archived",
        p_reason: "Quiz archived by instructor",
      });

      await fetchQuizzes();
      notify.success("Quiz archived successfully!");
    } catch (error) {
      console.error("Error archiving quiz:", error);
      notify.error(error.message);
    } finally {
      setArchivingQuizId(null);
    }
  };

  return { handleArchiveQuiz, archivingQuizId };
};
