import { useState } from "react";
import { toast } from "react-toastify";

export const CreateClassPopup = ({ handleCreateSection, onClose }) => {
  const [showForm, setShowForm] = useState(true);
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

  return (
    <form onSubmit={handleCreateSection} className="space-y-4">
      <h3 className="text-lg md:text-xl font-bold text-hornblende-green mb-4">
        Create New Class
      </h3>

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

      {error && toast.error(error)}

      <div className="flex flex-col md:flex-row gap-3 md:justify-end">
        <button
          type="button"
          onClick={onClose}
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
  );
};
