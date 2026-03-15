import { useState } from "react";
import { toast } from "react-toastify";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { supabase } from "../../supabaseClient";

export const useArchiveQuiz = (fetchQuizzes) => {
  const [archivingQuizId, setArchivingQuizId] = useState(null);
  const confirm = useConfirm();

  const handleArchiveQuiz = async (quizId, quizTitle) => {
    const confirmed = await confirm({
      title: "Archive Quiz",
      message: `Are you sure you want to archive "${quizTitle}"? You can find it later in the Archived Quizzes section.`,
      confirmText: "Archive",
      cancelText: "Cancel",
      variant: "warning",
    });

    if (!confirmed) return;

    setArchivingQuizId(quizId);

    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_archived: true })
        .eq("id", quizId);

      if (error) {
        throw new Error(`Failed to archive quiz: ${error.message}`);
      }

      await fetchQuizzes();
      toast.success("Quiz archived successfully!");
    } catch (error) {
      console.error("Error archiving quiz:", error);
      toast.error("Error archiving quiz: " + error.message);
    } finally {
      setArchivingQuizId(null);
    }
  };

  return { handleArchiveQuiz, archivingQuizId };
};
