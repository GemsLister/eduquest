import { supabase } from "../../supabaseClient";

export const useDeleteQuestion = () => {
  const handleDeleteQuestion = async (id) => {
    if (confirm("Are you sure you want to delete this question?")) {
      try {
        const { error } = await supabase
          .from("questions")
          .delete()
          .eq("id", id);

        if (error) {
          console.error("Error deleting question:", error);
          alert("Failed to delete question: " + error.message);
          return false;
        }

        alert("Question deleted successfully!");
        
        // Dispatch event to refresh the list
        window.dispatchEvent(new Event("questions-updated"));
        return true;
      } catch (error) {
        console.error("Error deleting question:", error);
        alert("An error occurred while deleting the question");
        return false;
      }
    }
    return false;
  };

  return { handleDeleteQuestion };
};
