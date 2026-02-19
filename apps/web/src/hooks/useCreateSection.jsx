import { useState } from "react";
import { supabase } from "../supabaseClient";

export const useCreateSection = (onSectionCreated, userId) => {
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateSection = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!formData.name.trim()) {
        setError("Section name is required");
        return;
      }

      if (!userId) {
        console.log(userId);

        setError("You must be logged in to create a section");
        return;
      }

      const examCode = () =>
        Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data, error: insertError } = await supabase
        .from("sections")
        .insert([
          {
            instructor_id: userId,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            exam_code: examCode(),
          },
        ])
        .select();

      if (insertError) throw insertError;

      setFormData({ name: "", description: "" });
      setShowForm(false);

      if (onSectionCreated) {
        onSectionCreated(data[0]);
      }
    } catch (err) {
      setError(err.message || "Failed to create section");
      console.error("Error creating section:", err);
    } finally {
      setLoading(false);
    }
  };
  return {
    handleCreateSection,
    handleInputChange,
    showForm,
    setShowForm,
    loading,
    error,
    formData,
    setFormData,
  };
};
