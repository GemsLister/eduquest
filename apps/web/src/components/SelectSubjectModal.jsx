import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Skeleton } from "./ui/Skeleton.jsx";
import { useEscapeKey } from "../hooks/useEscapeKey.jsx";
import { useFocusTrap } from "../hooks/useFocusTrap.jsx";

/**
 * Asks which section an archived question should be filed under in the
 * Question Bank. Choosing a section is optional.
 */
export const SelectSubjectModal = ({ isOpen, onClose, onConfirm, questionText }) => {
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEscapeKey(onClose, isOpen);
  const trapRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (isOpen) {
      fetchSections();
    }
  }, [isOpen]);

  const fetchSections = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("sections")
        .select("id, name, description")
        .eq("instructor_id", user.id)
        .eq("is_archived", false)
        .order("name", { ascending: true });

      if (error) throw error;
      setSections(data || []);
    } catch (error) {
      console.error("Error fetching sections:", error);
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedSectionId);
    setSelectedSectionId(null);
  };

  if (!isOpen) return null;

  const optionClass = (selected) =>
    `w-full text-left px-4 py-3 rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
      selected
        ? "border-brand-gold bg-brand-gold/10 font-semibold text-brand-navy"
        : "border-gray-200 bg-white hover:border-brand-gold/60 text-gray-800"
    }`;

  const markerClass = (selected) =>
    `w-4 h-4 rounded-full border-2 mr-3 shrink-0 ${
      selected ? "bg-brand-gold border-brand-gold" : "border-gray-400"
    }`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-section-title"
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4"
      >
        <h2 id="archive-section-title" className="text-xl font-bold text-brand-navy mb-2">
          Archive Question
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Optionally file this question under one of your sections in the Question Bank:{" "}
          <span className="font-semibold">
            {(questionText || "").length > 50 ? `${questionText.substring(0, 50)}...` : questionText}
          </span>
        </p>

        {loading ? (
          <div className="space-y-2" aria-label="Loading sections">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSectionId(section.id)}
                aria-pressed={selectedSectionId === section.id}
                className={optionClass(selectedSectionId === section.id)}
              >
                <div className="flex items-center">
                  <div className={markerClass(selectedSectionId === section.id)} />
                  <span>{section.name}</span>
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedSectionId(null)}
              aria-pressed={selectedSectionId === null}
              className={optionClass(selectedSectionId === null)}
            >
              <div className="flex items-center">
                <div className={markerClass(selectedSectionId === null)} />
                <span>Don't file under a section</span>
              </div>
            </button>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-brand-gold text-brand-navy rounded-lg font-semibold hover:bg-brand-gold-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
};
