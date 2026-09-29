import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Skeleton } from "./ui/Skeleton.jsx";

export const SelectSubjectModal = ({ isOpen, onClose, onConfirm, questionText }) => {
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchSections();
    }
  }, [isOpen]);

  const fetchSections = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .eq("instructor_id", user.id)
        .eq("is_archived", false)
        .order("section_name", { ascending: true });

      if (error) throw error;
      setSections(data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sections:", error);
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedSectionId);
    setSelectedSectionId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-brand-navy mb-2">Choose Subject</h2>
        <p className="text-gray-600 text-sm mb-4">
          Assign a subject to this archived question: <span className="font-semibold">{questionText?.substring(0, 50)}...</span>
        </p>

        {loading ? (
          <div className="space-y-2" aria-label="Loading subjects">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : sections.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-600">No subjects available. Create one first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <option value="" selected={!selectedSectionId} disabled>
              -- Skip (no subject) --
            </option>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setSelectedSectionId(section.id)}
                aria-pressed={selectedSectionId === section.id}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                  selectedSectionId === section.id
                    ? "border-casual-green bg-green-50 font-semibold text-hornblende-green"
                    : "border-gray-200 bg-white hover:border-casual-green text-gray-800"
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-4 h-4 rounded border-2 mr-3 ${
                      selectedSectionId === section.id
                        ? "bg-casual-green border-casual-green"
                        : "border-gray-400"
                    }`}
                  />
                  <span>{section.section_name}</span>
                </div>
              </button>
            ))}
            <button
              onClick={() => setSelectedSectionId(null)}
              aria-pressed={selectedSectionId === null}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                selectedSectionId === null
                  ? "border-casual-green bg-green-50 font-semibold text-hornblende-green"
                  : "border-gray-200 bg-white hover:border-casual-green text-gray-800"
              }`}
            >
              <div className="flex items-center">
                <div
                  className={`w-4 h-4 rounded border-2 mr-3 ${
                    selectedSectionId === null
                      ? "bg-casual-green border-casual-green"
                      : "border-gray-400"
                  }`}
                />
                <span>No Subject</span>
              </div>
            </button>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || sections.length === 0}
            className="flex-1 px-4 py-2 bg-hornblende-green text-white rounded-lg font-semibold hover:brightness-125 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
};
