import { notify } from "../../utils/notify.jsx";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { supabase } from "../../supabaseClient";

export const useDeleteQuestion = () => {
  const confirm = useConfirm();

  const handleDeleteQuestion = async (id) => {
    const confirmed = await confirm({
      title: "Delete Question",
      message: "Are you sure you want to delete this question?",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    });

    if (confirmed) {
      try {
        const { error } = await supabase
          .from("questions")
          .delete()
          .eq("id", id);

        if (error) {
          console.error("Error deleting question:", error);
          notify.error("Failed to delete question: " + error.message);
          return false;
        }

        notify.success("Question deleted successfully!");

        // Dispatch event to refresh the list
        window.dispatchEvent(new Event("questions-updated"));
        return true;
      } catch (error) {
        console.error("Error deleting question:", error);
        notify.error("An error occurred while deleting the question");
        return false;
      }
    }
    return false;
  };

  return { handleDeleteQuestion };
};
