import { useState } from "react";
import { supabase } from "../../supabaseClient";

export const useToggleQuizAccess = (fetchQuizzes) => {
  const [togglingQuizId, setTogglingQuizId] = useState(null);

  const handleToggleAccess = async (quizId, currentIsOpen) => {
    setTogglingQuizId(quizId);
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_open: !currentIsOpen })
        .eq("id", quizId);

      if (error) throw error;
      await fetchQuizzes();
    } catch (err) {
      console.error("Error toggling quiz access:", err);
    } finally {
      setTogglingQuizId(null);
    }
  };

  return { handleToggleAccess, togglingQuizId };
};
