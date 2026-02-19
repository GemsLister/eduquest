import { useState } from "react";
import { supabase } from "../supabaseClient.js";

export const SectionManager = ({ onSectionCreated, userId }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-casual-green text-white px-4 py-2 md:py-3 rounded-lg font-semibold text-sm md:text-base hover:bg-hornblende-green transition-colors shadow-md"
        >
          <span className="text-lg">+</span>
          Create New Class
        </button>
      ) : (
        <div className="bg-white rounded-lg p-4 md:p-6 shadow-md border border-casual-green">
          <h3 className="text-lg md:text-xl font-bold text-hornblende-green mb-4">
            Create New Class
          </h3>

          <form onSubmit={handleCreateSection} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Class Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Period 1, Block A, Biology 101"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-casual-green text-sm md:text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Optional class description"
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-casual-green text-sm md:text-base"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-3 md:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                  setFormData({ name: "", description: "" });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm md:text-base hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-casual-green text-white rounded-lg font-semibold text-sm md:text-base hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Class"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
