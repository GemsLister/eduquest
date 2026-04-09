import { useEffect } from "react";
import { notify } from "../../../utils/notify.jsx";

export const CreateClassPopup = ({
  onSubmit,
  onClose,
  loading,
  error,
  formDataName,
  formDataDescription,
  formDataSubjectCode,
  onInputChange,
}) => {
  useEffect(() => {
    if (error) notify.error(error);
  }, [error]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo rounded-t-xl px-6 py-4">
          <h3 className="text-lg font-bold text-white">Create New Subject</h3>
          <p className="text-white/70 text-xs mt-0.5">
            Add a new subject to your dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Course Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              name="name"
              value={formDataName}
              onChange={onInputChange}
              placeholder="e.g., Application Development and Emerging Technologies"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Subject Code
            </label>
            <input
              name="subject_code"
              value={formDataSubjectCode}
              onChange={onInputChange}
              placeholder="e.g., IT 312"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Section / Schedule
            </label>
            <input
              name="description"
              value={formDataDescription}
              onChange={onInputChange}
              placeholder="e.g., T301 - 2nd Sem 25-26"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 text-sm"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-brand-gold text-brand-navy rounded-lg font-semibold text-sm hover:bg-brand-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Subject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
