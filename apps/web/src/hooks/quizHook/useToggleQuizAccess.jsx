import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { notify } from "../../utils/notify.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { useAuth } from "../../context/AuthContext";

export const useToggleQuizAccess = (fetchQuizzes) => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [togglingQuizId, setTogglingQuizId] = useState(null);

  const handleToggleAccess = async (quizId, currentIsOpen) => {
    if (currentIsOpen) {
      const confirmed = await confirm({
        title: "Close Quiz",
        message:
          "Close this quiz to students? Anyone currently taking it may be unable to submit.",
        confirmText: "Close Quiz",
        cancelText: "Cancel",
        variant: "warning",
      });
      if (!confirmed) return;
    }

    setTogglingQuizId(quizId);
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .update({ is_open: !currentIsOpen })
        .eq("id", quizId)
        .eq("instructor_id", user?.id)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You can only open or close quizzes you own.");
      }
      await fetchQuizzes();
      notify.success(currentIsOpen ? "Quiz closed to students." : "Quiz opened to students.");
    } catch (err) {
      console.error("Error toggling quiz access:", err);
      notify.error(err.message || "Could not change student access.");
    } finally {
      setTogglingQuizId(null);
    }
  };

  return { handleToggleAccess, togglingQuizId };
};
