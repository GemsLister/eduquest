import { useState, useEffect } from "react";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { supabase } from "../../supabaseClient";

export const FacultyHeadSettings = () => {
  const [reviewerName, setReviewerName] = useState("");
  const [approverName, setApproverName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    loadSignatories();
  }, []);

  const loadSignatories = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("tos_signatories")
        .select("reviewer_name, approver_name")
        .eq("faculty_head_id", user.id)
        .maybeSingle();

      if (data) {
        setReviewerName(data.reviewer_name || "");
        setApproverName(data.approver_name || "");
      }
    } catch {
      // No existing record — that's fine
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("tos_signatories").upsert(
        {
          faculty_head_id: user.id,
          reviewer_name: reviewerName.trim(),
          approver_name: approverName.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "faculty_head_id" },
      );

      if (error) throw error;
      await confirm({
        title: "Success",
        message: "Signatories saved successfully!",
        confirmText: "OK",
        cancelText: "Close",
        variant: "success",
      });
    } catch (err) {
      console.error("Error saving signatories:", err);
      await confirm({
        title: "Error",
        message: "Failed to save signatories.",
        confirmText: "OK",
        cancelText: "Close",
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Settings</h1>
      <p className="text-gray-500 text-sm mb-8">
        Configure the signatory names that appear on TOS PDF exports.
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          TOS PDF Signatories
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Reviewed by (Senior Faculty)
            </label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="e.g. Joan Marie M. Panes"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Approved by (Department Head)
            </label>
            <input
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              placeholder="e.g. Dr. Sales G. Aribe Jr."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold outline-none transition-all"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold/90 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
