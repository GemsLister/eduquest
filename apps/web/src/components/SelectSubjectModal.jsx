import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

export const SelectSubjectModal = ({ isOpen, onClose, onConfirm, questionText }) => {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchSections();
    }
  }, [isOpen]);

  const fetchSections = async () => {
    if (!user) return;
    try {

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Choose Subject</h2>
        <p className="text-gray-600 text-sm mb-4">
          Assign a subject to this archived question: <span className="font-semibold">{questionText?.substring(0, 50)}...</span>
        </p>

        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-casual-green"></div>
            <p className="text-gray-600 mt-2">Loading subjects...</p>
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
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  selectedSectionId === section.id
                    ? "border-casual-green bg-green-50 font-semibold text-casual-green"
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
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                selectedSectionId === null
                  ? "border-casual-green bg-green-50 font-semibold text-casual-green"
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
            className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || sections.length === 0}
            className="flex-1 px-4 py-2 bg-casual-green text-white rounded-lg font-semibold hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
};
