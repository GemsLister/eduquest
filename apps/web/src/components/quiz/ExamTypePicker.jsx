import { EXAM_TYPES } from "../../utils/examType.js";

/**
 * Midterm / Final Exam choice. Used when creating an exam, in the exam
 * editor and when creating an exam from reused questions, so it looks the
 * same everywhere.
 */
export const ExamTypePicker = ({ value, onChange, disabled = false, name = "exam_type", required = true, idPrefix = "exam-type" }) => (
  <fieldset disabled={disabled}>
    <legend className="block text-sm font-semibold text-gray-700 mb-2">
      Type of Examination {required && <span className="text-red-500">*</span>}
    </legend>
    <div className="grid grid-cols-2 gap-3">
      {EXAM_TYPES.map((type) => {
        const selected = value === type.value;
        return (
          <label
            key={type.value}
            htmlFor={`${idPrefix}-${type.value}`}
            className={`flex items-start gap-2.5 p-3 rounded-lg border transition-colors ${
              disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
            } ${selected ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy" : "border-gray-200 hover:bg-gray-50"}`}
          >
            <input
              id={`${idPrefix}-${type.value}`}
              type="radio"
              name={name}
              value={type.value}
              checked={selected}
              onChange={() => onChange(type.value)}
              className="mt-0.5 text-brand-navy focus:ring-brand-navy"
            />
            <span>
              <span className="block text-sm font-bold text-gray-800">{type.label}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{type.hint}</span>
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);
