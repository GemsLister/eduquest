import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap.jsx";
import { useEscapeKey } from "../../hooks/useEscapeKey.jsx";
import {
  EXAM_FILE_ACCEPT,
  ExamImportError,
  MAX_EXAM_FILE_MB,
  choiceLetter,
  readExamFile,
} from "../../utils/examFileImport.js";

const TEMPLATE_URL = "/templates/exam-import-template.docx";
const NO_ANSWER_WARNING = "No correct answer marked";

/**
 * Lets the instructor pick (or drop) a Word/PDF exam file and previews the
 * questions found in it. Questions can be unticked and missing correct
 * answers picked before they are added to the editor.
 *
 * Rendered into document.body so it stays centered in the viewport whatever
 * the page's scroll containers are doing.
 */
export const ImportExamFileModal = ({ onClose, onImport }) => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("pick");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [answers, setAnswers] = useState([]);
  const [dragging, setDragging] = useState(false);
  // display:none input opened from buttons; a focusable hidden input would make
  // the browser scroll the app shell when it receives focus
  const inputRef = useRef(null);

  const trapRef = useFocusTrap(true);
  useEscapeKey(onClose, true);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    readExamFile(file)
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setSelected(new Set(res.questions.map((_, i) => i)));
        setAnswers(res.questions.map((q) => q.correctAnswer));
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ExamImportError ? err.message : "This file couldn't be read.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const chooseFile = (next) => {
    if (!next) return;
    setResult(null);
    setError("");
    setStatus("reading");
    setFile(next);
  };

  const openPicker = () => inputRef.current?.click();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    chooseFile(e.dataTransfer.files?.[0]);
  };

  const questions = result?.questions || [];
  const selectedCount = selected.size;
  const missingAnswers = questions.filter((_, i) => selected.has(i) && answers[i] === null).length;
  const allSelected = questions.length > 0 && selectedCount === questions.length;

  const toggle = (index) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const setAnswer = (index, choice) =>
    setAnswers((prev) => prev.map((a, i) => (i === index ? choice : a)));

  const handleAdd = () => {
    onImport(
      questions
        .map((q, i) => ({ text: q.text, options: q.options, correctAnswer: answers[i] }))
        .filter((_, i) => selected.has(i)),
      file.name,
    );
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <input
        ref={inputRef}
        type="file"
        accept={EXAM_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const next = e.target.files?.[0];
          e.target.value = "";
          chooseFile(next);
        }}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-exam-file-title"
        className={`bg-white rounded-xl shadow-2xl w-full flex flex-col max-h-[90vh] ${status === "ready" ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 id="import-exam-file-title" className="text-lg font-bold text-brand-navy">
              Import questions from Word or PDF
            </h3>
            {file && (
              <p className="text-sm text-gray-500 truncate" title={file.name}>
                {file.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {status === "pick" && (
            <div className="space-y-5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl px-6 py-10 flex flex-col items-center gap-3 text-center transition-colors ${dragging ? "border-brand-gold bg-brand-gold/10" : "border-gray-300 bg-gray-50"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
                <p className="text-sm font-medium text-gray-700">Drag a Word (.docx) or PDF file here</p>
                <p className="text-xs text-gray-500">or</p>
                <button
                  type="button"
                  onClick={openPicker}
                  className="bg-brand-gold text-brand-navy px-5 py-2 rounded-lg font-semibold text-sm hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                >
                  Choose File
                </button>
              </div>
              <FormatTips />
            </div>
          )}

          {status === "reading" && (
            <div className="py-12 flex flex-col items-center gap-3 text-gray-500" role="status">
              <div className="w-8 h-8 border-4 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin" />
              <p className="text-sm font-medium">Reading questions…</p>
            </div>
          )}

          {status === "error" && (
            <div className="py-4 space-y-4">
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3" role="alert">
                {error}
              </p>
              <FormatTips />
            </div>
          )}

          {status === "ready" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-700">
                  Found <span className="font-semibold">{questions.length}</span> question
                  {questions.length === 1 ? "" : "s"}.
                  {missingAnswers > 0 && (
                    <span className="text-amber-700">
                      {" "}
                      {missingAnswers} selected question{missingAnswers === 1 ? " has" : "s have"} no correct answer.
                    </span>
                  )}
                </p>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(questions.map((_, i) => i)))
                    }
                    className="w-4 h-4 accent-brand-navy"
                  />
                  Select all
                </label>
              </div>

              {missingAnswers > 0 && (
                <p className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Click a choice to mark it as the correct answer, or set the answers later in the editor.
                  The exam can be saved as a draft without them, but every question needs a correct answer
                  before it can be submitted for review.
                </p>
              )}

              {result.warnings.length > 0 && (
                <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}

              <ol className="space-y-3">
                {questions.map((q, i) => {
                  const included = selected.has(i);
                  const warnings = q.warnings.filter((w) => w !== NO_ANSWER_WARNING || answers[i] === null);
                  return (
                    <li
                      key={i}
                      className={`border rounded-lg p-4 transition-opacity ${included ? "border-gray-200" : "border-gray-100 opacity-50"}`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => toggle(i)}
                          aria-label={`Include question ${i + 1}`}
                          className="w-4 h-4 mt-0.5 accent-brand-navy flex-shrink-0"
                        />
                        <span className="text-sm font-semibold text-brand-navy whitespace-pre-wrap break-words">
                          {i + 1}. {q.text}
                        </span>
                      </label>

                      <fieldset className="mt-2 ml-7 space-y-1" disabled={!included}>
                        <legend className="sr-only">Correct answer for question {i + 1}</legend>
                        {q.options.map((option, optIdx) => {
                          const isCorrect = answers[i] === optIdx;
                          return (
                            <label
                              key={optIdx}
                              className={`flex items-start gap-2 text-sm rounded-md px-2 py-1 cursor-pointer ${isCorrect ? "bg-green-50 text-green-800 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                            >
                              <input
                                type="radio"
                                name={`import-answer-${i}`}
                                checked={isCorrect}
                                onChange={() => setAnswer(i, optIdx)}
                                className="mt-1 accent-green-600 flex-shrink-0"
                              />
                              <span className="w-5 flex-shrink-0 text-gray-500">{choiceLetter(optIdx)}.</span>
                              <span className="break-words">{option}</span>
                            </label>
                          );
                        })}
                      </fieldset>

                      {warnings.length > 0 && (
                        <div className="mt-2 ml-7 flex flex-wrap gap-1.5">
                          {warnings.map((w) => (
                            <span key={w} className="text-xs font-medium text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
                              {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
          {status === "ready" || status === "error" ? (
            <button
              type="button"
              onClick={openPicker}
              className="text-sm font-semibold text-brand-navy hover:text-brand-indigo rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              Choose another file
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              Cancel
            </button>
            {status === "ready" && (
              <button
                type="button"
                onClick={handleAdd}
                disabled={selectedCount === 0}
                className="bg-brand-gold text-brand-navy px-4 py-2 rounded-lg font-semibold text-sm hover:bg-brand-gold-dark hover:brightness-95 hover:shadow-lg active:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Add {selectedCount} Question{selectedCount === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const FormatTips = () => (
  <div className="text-sm text-gray-600 space-y-2">
    <p className="font-semibold text-gray-700">What files work</p>
    <ul className="list-disc ml-5 space-y-1">
      <li>Word (.docx) or PDF saved from Word, up to {MAX_EXAM_FILE_MB} MB. Scanned PDFs can't be read.</li>
      <li>Questions numbered 1., 2., 3.… with choices lettered a., b., c.… (Word's automatic numbering works).</li>
      <li>
        Correct answers are picked up when the answer is bold or underlined, marked with *, written as
        "Answer: B", or listed in an answer key at the end.
      </li>
    </ul>
    <a
      href={TEMPLATE_URL}
      download
      className="inline-block font-semibold text-brand-navy underline hover:text-brand-indigo"
    >
      Download a sample Word file
    </a>
  </div>
);
