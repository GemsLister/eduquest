export const useDeleteQuestion = () => {
  const handleDeleteQuestion = (id) => {
    if (confirm("Are you sure you want to delete this question?")) {
      // TODO: Delete from Supabase
      setQuestions(questions.filter((q) => q.id !== id));
      alert("Question deleted (local only)");
    }
  };

  return { handleDeleteQuestion };
};
