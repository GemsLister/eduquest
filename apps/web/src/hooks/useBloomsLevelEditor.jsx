import { useCallback, useState } from "react";
import { notify } from "../utils/notify.jsx";
import { BloomsLevelEditModal } from "../components/quiz/BloomsLevelControls.jsx";

/**
 * Opens the Bloom's level editor for a question and saves through `onSave`.
 *
 *   const levelEditor = useBloomsLevelEditor({ reasonRequired: true, onSave });
 *   <BloomsLevelBadge onEdit={() => levelEditor.open(item, idx + 1)} ... />
 *   {levelEditor.modal}
 *
 * `onSave(item, questionNumber, level, reason)` may be async; when it throws,
 * the error is shown and the editor stays open.
 */
export const useBloomsLevelEditor = ({ reasonRequired = false, onSave }) => {
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const open = useCallback((item, questionNumber) => setEditing({ item, questionNumber }), []);

  const handleSave = async (level, reason) => {
    setSaving(true);
    try {
      await onSave(editing.item, editing.questionNumber, level, reason);
      setEditing(null);
    } catch (err) {
      console.error("Bloom's level change failed:", err);
      notify.error(err?.message || "The level couldn't be changed.");
    } finally {
      setSaving(false);
    }
  };

  const modal = editing ? (
    <BloomsLevelEditModal
      key={editing.item.questionId}
      item={editing.item}
      questionNumber={editing.questionNumber}
      reasonRequired={reasonRequired}
      saving={saving}
      onCancel={() => {
        if (!saving) setEditing(null);
      }}
      onSave={handleSave}
    />
  ) : null;

  return { open, modal };
};
