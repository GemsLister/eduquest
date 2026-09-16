import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";
import { notify } from "../utils/notify.jsx";

export const SubjectRequestForm = ({ isOpen, onClose, onRequestSubmitted }) => {
  const { user } = useAuth();
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
      const subjectNameTrimmed = formData.subject_name.trim();
      if (!subjectNameTrimmed) {
        setError("Subject name is required");
        return;
      }

      if (!formData.grade_level) {
        setError("Grade level is required");
        return;
      }

      const requesterName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email?.split("@")[0] ||
        "Faculty Member";

      const requestId = `req_${crypto.randomUUID()}`;

      const requestPayload = {
        id: requestId,
        subject_name: subjectNameTrimmed,
        subject_code: formData.subject_code?.trim() || null,
        grade_level: formData.grade_level || "1st",
        description: formData.description?.trim() || "",
        requested_by: user?.id,
        requester_name: requesterName,
        requester_email: user?.email || null,
        request_status: "pending",
        created_at: new Date().toISOString(),
      };

      // 1. Fetch all Department Heads (is_faculty_head = true)
      const { data: deptHeads } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_faculty_head", true);

      const targetHeadIds = (deptHeads || []).map((dh) => dh.id);

      // If no department head flagged, fallback to all admins or current user
      if (targetHeadIds.length === 0) {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .eq("is_admin", true);
        if (admins) {
          admins.forEach((a) => targetHeadIds.push(a.id));
        }
      }

      const notificationsToInsert = [];

      // Add notification for each Department Head
      targetHeadIds.forEach((headId) => {
        notificationsToInsert.push({
          user_id: headId,
          title: `Subject Request: ${subjectNameTrimmed}`,
          message: JSON.stringify(requestPayload),
          type: "info",
          link: "/faculty-head-dashboard/subject-requests",
          is_read: false,
        });
      });

      // Add a self-tracking notification for the requester
      if (user?.id) {
        notificationsToInsert.push({
          user_id: user.id,
          title: `My Subject Request: ${subjectNameTrimmed}`,
          message: JSON.stringify(requestPayload),
          type: "info",
          link: "/faculty-head-dashboard/subject-requests",
          is_read: false,
        });
      }

      // Insert all notifications in one call
      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notificationsToInsert);

      if (notifError) {
        console.error("Notification insert error:", notifError);
        throw notifError;
      }

      notify.success("Subject request submitted to Department Head successfully!");
      window.dispatchEvent(new CustomEvent("subject-requests-changed"));
      window.dispatchEvent(new CustomEvent("pending-subject-requests-changed"));

      // Reset form
      setFormData({
        subject_name: "",
        subject_code: "",
        grade_level: "1st",
        description: "",
      });

      onClose();

      if (onRequestSubmitted) {
        onRequestSubmitted({ success: true, id: requestId });
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-5 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-white">
                Request New Subject
              </h3>
              <p className="text-white/70 text-xs mt-1">
                Submit a curriculum subject proposal for Department Head approval.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close subject request form"
              className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto"
        >
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Subject Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="subject_name"
              value={formData.subject_name}
              onChange={handleInputChange}
              placeholder="e.g., Database Management"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold/50 text-sm transition-all"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Subject Code <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              name="subject_code"
              value={formData.subject_code}
              onChange={handleInputChange}
              placeholder="e.g., IT204, CS301"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold/50 text-sm transition-all"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Grade / Year Level <span className="text-rose-500">*</span>
            </label>
            <select
              name="grade_level"
              value={formData.grade_level}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold/50 text-sm font-medium text-slate-800 transition-all cursor-pointer"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Description / Coverage <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief overview of the subject coverage..."
              rows="3"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold/50 text-sm resize-none transition-all"
              disabled={loading}
            />
          </div>

          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex items-start gap-2.5 text-blue-900">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-blue-600 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-xs leading-relaxed text-blue-800">
              Your request will be submitted to the <strong>Department Head</strong> for review. Once approved, the subject will become available in the centralized curriculum list.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-xl font-bold text-xs hover:bg-brand-gold-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Request</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};