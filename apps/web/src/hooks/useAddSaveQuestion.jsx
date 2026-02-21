export const useAddSaveQuestion = () => {
  const handleAddQuestion = () => {
    setEditingId(null);
    setFormData({
      type: "mcq",
      text: "",
      options: ["", ""],
      correctAnswer: 0,
      points: 1,
    });
    setShowForm(true);
  };

  const handleSaveQuestion = async () => {
    if (!formData.text.trim()) {
      alert("Question text is required");
      return;
    }
    if (formData.type === "mcq" && formData.options.some((o) => !o.trim())) {
      alert("All options must be filled");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      alert(
        editingId
          ? "Question updated (local only)"
          : "Question created (local only)",
      );
      setShowForm(false);
      setFormData({
        type: "mcq",
        text: "",
        options: ["", ""],
        correctAnswer: 0,
        points: 1,
      });
    } catch (error) {
      console.error("Error saving question:", error);
    }
  };
};
