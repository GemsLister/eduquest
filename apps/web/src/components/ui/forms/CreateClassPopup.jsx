import { toast } from "react-toastify";

export const CreateClassPopup = ({
  onSubmit,
  onClose,
  loading,
  error,
  formDataName,
  formDataDescription,
  onInputChange,
}) => {
  if (error) toast.error(error);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-hornblende-green to-sea-green rounded-t-xl px-6 py-4">
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-hornblende-green focus:ring-2 focus:ring-hornblende-green/20 text-sm"
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-hornblende-green focus:ring-2 focus:ring-hornblende-green/20 text-sm"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              An exam code will be auto-generated for student access.
            </p>
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
              className="px-5 py-2 bg-hornblende-green text-white rounded-lg font-semibold text-sm hover:bg-dark-aquamarine-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Subject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
