import { useState } from "react";
import { supabase } from "../supabaseClient";
import { notify } from "../utils/notify.jsx";

export const SubjectRequestForm = ({ isOpen, onClose, onRequestSubmitted }) => {
  const [formData, setFormData] = useState({
    subject_name: "",
    subject_code: "",
    grade_level: "1st",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const gradeLevels = ["1st", "2nd", "3rd", "4th"];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!formData.subject_name.trim()) {
        setError("Subject name is required");
        return;
      }

      if (!formData.grade_level) {
        setError("Grade level is required");
        return;
      }

      // Call the RPC function with duplicate prevention
      const { data, error: rpcError } = await supabase.rpc("submit_subject_request", {
        p_subject_name: formData.subject_name.trim(),
        p_subject_code: formData.subject_code.trim() || null,
        p_grade_level: formData.grade_level,
        p_description: formData.description.trim() || null,
      });

      if (rpcError) {
        // If the function doesn't exist yet (migration not run), show helpful message
        if (rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
          setError("Subject request feature requires database migration. Please contact administrator.");
          return;
        }
        throw rpcError;
      }

      if (!data.success) {
        if (data.error) {
          setError(data.error);
          if (data.existing_subject_id) {
            notify.info("This subject already exists. Please select it from the dropdown instead.");
          } else if (data.existing_request_id) {
            notify.info("You already have a pending request for this subject.");
          }
        }
        return;
      }

      notify.success("Subject request submitted successfully!");
      
      // Reset form
      setFormData({
        subject_name: "",
        subject_code: "",
        grade_level: "1st",
        description: "",
      });

      onClose();
      
      if (onRequestSubmitted) {
        onRequestSubmitted(data);
      }
    } catch (err) {
      console.error("Error submitting subject request:", err);
      setError(err.message || "Failed to submit subject request");
      notify.error("Failed to submit subject request");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-5 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-white">
                Request New Subject
              </h3>
              <p className="text-white/70 text-sm mt-1">
                Submit a request for a new subject to be added to the centralized list.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close subject request form"
              className="text-white/80 hover:text-white text-2xl leading-none font-semibold transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Subject Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="subject_name"
              value={formData.subject_name}
              onChange={handleInputChange}
              placeholder="e.g., Database Management"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Subject Code
            </label>
            <input
              type="text"
              name="subject_code"
              value={formData.subject_code}
              onChange={handleInputChange}
              placeholder="e.g., CS301"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Grade Level <span className="text-red-500">*</span>
            </label>
            <select
              name="grade_level"
              value={formData.grade_level}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm"
              disabled={loading}
            >
              {gradeLevels.map((level) => (
                <option key={level} value={level}>
                  {level} Year
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of the subject..."
              rows="3"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold text-sm resize-none"
              disabled={loading}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> Your request will be reviewed by the Department Head. 
              Once approved, the subject will be added to the centralized list and you'll be automatically assigned to it.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};