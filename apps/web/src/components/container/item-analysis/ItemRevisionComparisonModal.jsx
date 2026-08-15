import React, { useState, useMemo } from "react";
import { exportItemRevisionPdf } from "../../../utils/exportItemRevisionPdf";

/**
 * ItemRevisionComparisonModal
 * Provides a side-by-side comparison between any historical revision (LEFT)
 * and the current active version of a question (RIGHT) for Item Analysis.
 */
export const ItemRevisionComparisonModal = ({
  isOpen,
  onClose,
  item,
  itemIndex,
}) => {
  const [selectedRevisionIndex, setSelectedRevisionIndex] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState("selected"); // "selected" | "all"
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = () => {
    setShowExportModal(true);
  };

  const triggerPdfGeneration = () => {
    setExporting(true);
    try {
      exportItemRevisionPdf({
        item,
        itemIndex,
        activeOldRevision,
        currentVersion,
        revisionsList,
        exportMode: exportScope,
      });
      setShowExportModal(false);
    } catch (err) {
      console.error("PDF Export error:", err);
      alert("Failed to export PDF report: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Formatter helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const getOptionLetter = (idx) => String.fromCharCode(65 + idx);

  // Normalize options array
  const normalizeOptions = (opts) => {
    if (!opts) return [];
    if (Array.isArray(opts)) return opts.map(String);
    if (typeof opts === "string") {
      try {
        const parsed = JSON.parse(opts);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        return [opts];
      }
    }
    return [];
  };

  // Extract / Reconstruct complete chronological revision timeline
  const revisionsList = useMemo(() => {
    if (!item) return [];

    const rawHistory = Array.isArray(item.revision_history)
      ? item.revision_history
      : [];

    const parsedRevisions = [];

    // Step 1: Parse raw revision_history array if present
    rawHistory.forEach((rev, idx) => {
      parsedRevisions.push({
        versionNumber: idx + 1,
        title: `Revision ${idx + 1}`,
        text: rev.text || rev.question_text || item.original_text || item.text,
        type: rev.type || item.type || "mcq",
        options: normalizeOptions(rev.options || item.original_options),
        correct_answer: rev.correct_answer || rev.correctAnswer || item.original_correct_answer || item.correct_answer,
        points: rev.points !== undefined ? rev.points : (item.points || 1),
        explanation: rev.explanation || "",
        cognitive_level: rev.cognitive_level || item.cognitive_level || "Remembering",
        timestamp: rev.timestamp || rev.revised_at || rev.created_at || item.created_at,
        modified_by: rev.modified_by || rev.created_by || rev.author || "Instructor",
        reason: rev.reason || rev.rejection_reason || (item.autoFlag === "reject" ? "Item flagged for replacement during Item Analysis" : "Item flagged for revision during Item Analysis"),
        status: rev.status || (idx === 0 ? "Original Creation" : item.autoFlag || "Revised"),
      });
    });

    // Step 2: Fallback reconstruction if revision_history array is empty or partial
    if (parsedRevisions.length === 0) {
      // Create Revision 1 from original data
      const origText = item.original_text || item.previous_text || item.text;
      const origOptions = normalizeOptions(item.original_options || item.options);
      const origAnswer = item.original_correct_answer || item.correct_answer;

      parsedRevisions.push({
        versionNumber: 1,
        title: "Revision 1 (Original)",
        text: origText,
        type: item.type || "mcq",
        options: origOptions,
        correct_answer: origAnswer,
        points: item.points || 1,
        explanation: item.explanation || "",
        cognitive_level: item.cognitive_level || "Remembering",
        timestamp: item.created_at || new Date().toISOString(),
        modified_by: "Instructor",
        reason: "Initial question creation",
        status: "Original",
      });

      // If pending revision draft exists, add Revision 2 (Pending Revision)
      if (item.revised_content || item.revised_options) {
        parsedRevisions.push({
          versionNumber: 2,
          title: "Revision 2 (Draft)",
          text: item.revised_content || item.text,
          type: item.type || "mcq",
          options: normalizeOptions(item.revised_options || item.options),
          correct_answer: item.correct_answer,
          points: item.points || 1,
          explanation: item.explanation || "",
          cognitive_level: item.cognitive_level || "Remembering",
          timestamp: item.updated_at || new Date().toISOString(),
          modified_by: "Instructor",
          reason: "Item Analysis Revision Draft",
          status: "Pending Draft",
        });
      }
    }

    return parsedRevisions;
  }, [item]);

  // Current active version (RIGHT side)
  const currentVersion = useMemo(() => {
    if (!item) return null;
    return {
      title: "Current Version (Active)",
      text: item.text || "",
      type: item.type || "mcq",
      options: normalizeOptions(item.options),
      correct_answer: item.correct_answer || "",
      points: item.points !== undefined ? item.points : 1,
      explanation: item.explanation || "",
      cognitive_level: item.cognitive_level || "Remembering",
      timestamp: item.updated_at || item.created_at || new Date().toISOString(),
      modified_by: "Instructor",
      status: item.autoFlag || item.status || "Current",
    };
  }, [item]);

  // Ensure valid selection index
  const activeOldRevision = useMemo(() => {
    if (revisionsList.length === 0) return null;
    const idx = Math.min(selectedRevisionIndex, revisionsList.length - 1);
    return revisionsList[idx];
  }, [revisionsList, selectedRevisionIndex]);

  // Diff comparison engine
  const diffs = useMemo(() => {
    if (!activeOldRevision || !currentVersion) return {};

    const textChanged =
      activeOldRevision.text.trim() !== currentVersion.text.trim();
    const typeChanged = activeOldRevision.type !== currentVersion.type;
    const optionsChanged =
      JSON.stringify(activeOldRevision.options) !==
      JSON.stringify(currentVersion.options);
    const answerChanged =
      String(activeOldRevision.correct_answer).trim() !==
      String(currentVersion.correct_answer).trim();
    const pointsChanged =
      Number(activeOldRevision.points) !== Number(currentVersion.points);
    const explanationChanged =
      (activeOldRevision.explanation || "").trim() !==
      (currentVersion.explanation || "").trim();

    return {
      hasChanges:
        textChanged ||
        typeChanged ||
        optionsChanged ||
        answerChanged ||
        pointsChanged ||
        explanationChanged,
      textChanged,
      typeChanged,
      optionsChanged,
      answerChanged,
      pointsChanged,
      explanationChanged,
    };
  }, [activeOldRevision, currentVersion]);

  if (!isOpen || !item) return null;

  const itemNumberDisplay =
    itemIndex !== undefined ? `Q${itemIndex + 1}` : item.question_id || "Item";

  const statusLabel =
    item.autoFlag === "reject"
      ? "REJECT"
      : item.autoFlag === "revise"
      ? "REVISE"
      : (item.autoFlag || item.status || "REVISE").toUpperCase();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-brand-navy via-brand-indigo to-indigo-900 px-6 py-5 text-white shrink-0 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-brand-gold text-brand-navy uppercase tracking-wider shadow-xs">
                {itemNumberDisplay}
              </span>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                  statusLabel === "REJECT"
                    ? "bg-red-500 text-white"
                    : statusLabel === "REVISE"
                    ? "bg-orange-500 text-white"
                    : "bg-emerald-500 text-white"
                }`}
              >
                STATUS: {statusLabel}
              </span>
              <span className="text-white/60 text-xs font-semibold">
                ID: {item.question_id || item.id || "N/A"}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              <span>📜</span> Full Revision History & Side-by-Side Comparison
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPdf}
              className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Export complete revision history and side-by-side comparison report as PDF"
            >
              <span>📄 Export as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-3xl font-bold p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Revision Selector Timeline Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 shrink-0 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-2 flex items-center gap-1">
            <span>⏱️</span> Select Old Revision to Compare:
          </span>
          {revisionsList.map((rev, idx) => {
            const isSelected = selectedRevisionIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedRevisionIndex(idx)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isSelected
                    ? "bg-brand-navy text-white border-brand-navy shadow-md scale-105"
                    : "bg-white text-slate-700 border-slate-300 hover:border-brand-indigo hover:bg-slate-50"
                }`}
              >
                <span>{rev.title}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected
                      ? "bg-brand-gold text-brand-navy"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {formatDate(rev.timestamp).split(",")[0]}
                </span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            {diffs.hasChanges ? (
              <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-300 flex items-center gap-1 animate-pulse">
                ⚡ Differences Detected
              </span>
            ) : (
              <span className="text-xs font-bold px-3 py-1 bg-slate-200 text-slate-600 rounded-full">
                ✓ Identical Content
              </span>
            )}
          </div>
        </div>

        {/* Modal Body - 2-Column Side-by-Side Grid */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN - OLD REVISION */}
            <div className="bg-white border-2 border-slate-300 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              {/* Header */}
              <div className="bg-slate-700 text-white p-4 border-b border-slate-600 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-400 text-slate-900 rounded text-[10px] font-black uppercase">
                      LEFT SIDE
                    </span>
                    <h3 className="font-bold text-base text-white">
                      {activeOldRevision?.title || "Old Revision"}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Created/Modified: {formatDate(activeOldRevision?.timestamp)}
                  </p>
                </div>
                <span className="text-xs font-mono bg-slate-800 px-2.5 py-1 rounded text-amber-300 font-bold border border-slate-600">
                  Historical Snapshot
                </span>
              </div>

              {/* Revision Metadata Card */}
              <div className="bg-slate-50 p-4 border-b border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Author:</span>
                  <span className="text-slate-800 font-semibold">
                    {activeOldRevision?.modified_by || "Instructor"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Status:</span>
                  <span className="text-slate-800 font-semibold">
                    {activeOldRevision?.status || "Historical"}
                  </span>
                </div>
                {activeOldRevision?.reason && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-500 font-bold block mb-0.5">
                      Revision/Flag Reason:
                    </span>
                    <p className="text-slate-700 italic bg-amber-50/80 p-2 rounded border border-amber-200">
                      "{activeOldRevision.reason}"
                    </p>
                  </div>
                )}
              </div>

              {/* Fields View */}
              <div className="p-5 space-y-5 flex-1">
                {/* Question Text */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Question Text
                    </label>
                    {diffs.textChanged && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-300">
                        OLD TEXT
                      </span>
                    )}
                  </div>
                  <div
                    className={`p-4 rounded-xl border text-sm font-medium leading-relaxed ${
                      diffs.textChanged
                        ? "bg-amber-50/70 border-amber-300 text-slate-900"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    {activeOldRevision?.text || "No question text available"}
                  </div>
                </div>

                {/* Question Type & Points */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Question Type
                    </label>
                    <div
                      className={`p-2.5 rounded-lg border text-xs font-bold uppercase ${
                        diffs.typeChanged
                          ? "bg-amber-50 border-amber-300 text-amber-900"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      {activeOldRevision?.type || "mcq"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Points Value
                    </label>
                    <div
                      className={`p-2.5 rounded-lg border text-xs font-bold ${
                        diffs.pointsChanged
                          ? "bg-amber-50 border-amber-300 text-amber-900"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      {activeOldRevision?.points || 1} pt(s)
                    </div>
                  </div>
                </div>

                {/* Answer Options / Choices */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Answer Choices / Options
                    </label>
                    {diffs.optionsChanged && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-300">
                        OLD CHOICES
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {activeOldRevision?.options &&
                    activeOldRevision.options.length > 0 ? (
                      activeOldRevision.options.map((opt, idx) => {
                        const letter = getOptionLetter(idx);
                        const isCorrectKey =
                          String(opt).trim() ===
                            String(activeOldRevision.correct_answer).trim() ||
                          String(letter).toLowerCase() ===
                            String(activeOldRevision.correct_answer).toLowerCase() ||
                          String(idx) === String(activeOldRevision.correct_answer);

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex items-start gap-3 text-xs ${
                              isCorrectKey
                                ? "bg-emerald-50 border-emerald-300"
                                : diffs.optionsChanged
                                ? "bg-amber-50/40 border-amber-200"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0 ${
                                isCorrectKey
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {letter}
                            </span>
                            <span
                              className={`flex-1 pt-0.5 font-medium ${
                                isCorrectKey
                                  ? "text-emerald-950 font-bold"
                                  : "text-slate-800"
                              }`}
                            >
                              {opt}
                            </span>
                            {isCorrectKey && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                ✓ Correct
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 italic">
                        No choices recorded for this revision
                      </div>
                    )}
                  </div>
                </div>

                {/* Correct Answer Summary */}
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Correct Answer Key
                  </label>
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                      diffs.answerChanged
                        ? "bg-amber-100 border-amber-400 text-amber-950"
                        : "bg-emerald-50 border-emerald-200 text-emerald-900"
                    }`}
                  >
                    <span>Key: {activeOldRevision?.correct_answer}</span>
                    {diffs.answerChanged && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-200 text-amber-900 rounded">
                        Key Changed
                      </span>
                    )}
                  </div>
                </div>

                {/* Explanation */}
                {activeOldRevision?.explanation && (
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Explanation
                    </label>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 italic">
                      {activeOldRevision.explanation}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN - CURRENT ACTIVE VERSION */}
            <div className="bg-white border-2 border-brand-navy rounded-2xl overflow-hidden shadow-md flex flex-col">
              {/* Header */}
              <div className="bg-brand-navy text-white p-4 border-b border-brand-indigo flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-brand-gold text-brand-navy rounded text-[10px] font-black uppercase">
                      RIGHT SIDE
                    </span>
                    <h3 className="font-bold text-base text-white">
                      {currentVersion?.title || "Current Version"}
                    </h3>
                  </div>
                  <p className="text-xs text-white/70 mt-1">
                    Last Modified: {formatDate(currentVersion?.timestamp)}
                  </p>
                </div>
                <span className="text-xs font-mono bg-emerald-500 text-white px-2.5 py-1 rounded font-bold shadow-xs">
                  Active Live Version
                </span>
              </div>

              {/* Current Metadata Card */}
              <div className="bg-indigo-50/50 p-4 border-b border-indigo-100 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Last Modified By:</span>
                  <span className="text-slate-800 font-semibold">
                    {currentVersion?.modified_by || "Instructor"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Item Flag Status:</span>
                  <span className="text-brand-navy font-bold uppercase">
                    {statusLabel}
                  </span>
                </div>
              </div>

              {/* Fields View */}
              <div className="p-5 space-y-5 flex-1">
                {/* Question Text */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Question Text
                    </label>
                    {diffs.textChanged && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                        UPDATED TEXT
                      </span>
                    )}
                  </div>
                  <div
                    className={`p-4 rounded-xl border text-sm font-medium leading-relaxed ${
                      diffs.textChanged
                        ? "bg-emerald-50/80 border-emerald-300 text-slate-900 ring-2 ring-emerald-200"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    {currentVersion?.text || "No question text available"}
                  </div>
                </div>

                {/* Question Type & Points */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Question Type
                    </label>
                    <div
                      className={`p-2.5 rounded-lg border text-xs font-bold uppercase ${
                        diffs.typeChanged
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      {currentVersion?.type || "mcq"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Points Value
                    </label>
                    <div
                      className={`p-2.5 rounded-lg border text-xs font-bold ${
                        diffs.pointsChanged
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      {currentVersion?.points || 1} pt(s)
                    </div>
                  </div>
                </div>

                {/* Answer Options / Choices */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Answer Choices / Options
                    </label>
                    {diffs.optionsChanged && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                        UPDATED CHOICES
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {currentVersion?.options &&
                    currentVersion.options.length > 0 ? (
                      currentVersion.options.map((opt, idx) => {
                        const letter = getOptionLetter(idx);
                        const isCorrectKey =
                          String(opt).trim() ===
                            String(currentVersion.correct_answer).trim() ||
                          String(letter).toLowerCase() ===
                            String(currentVersion.correct_answer).toLowerCase() ||
                          String(idx) === String(currentVersion.correct_answer);

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex items-start gap-3 text-xs ${
                              isCorrectKey
                                ? "bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300 shadow-xs"
                                : diffs.optionsChanged
                                ? "bg-emerald-50/30 border-emerald-200"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0 ${
                                isCorrectKey
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {letter}
                            </span>
                            <span
                              className={`flex-1 pt-0.5 font-medium ${
                                isCorrectKey
                                  ? "text-emerald-950 font-bold"
                                  : "text-slate-800"
                              }`}
                            >
                              {opt}
                            </span>
                            {isCorrectKey && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                ✓ Correct Key
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 italic">
                        No options recorded
                      </div>
                    )}
                  </div>
                </div>

                {/* Correct Answer Summary */}
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Correct Answer Key
                  </label>
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                      diffs.answerChanged
                        ? "bg-emerald-100 border-emerald-400 text-emerald-950 ring-2 ring-emerald-200"
                        : "bg-emerald-50 border-emerald-200 text-emerald-900"
                    }`}
                  >
                    <span>Key: {currentVersion?.correct_answer}</span>
                    {diffs.answerChanged && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-600 text-white rounded shadow-xs">
                        Updated Key
                      </span>
                    )}
                  </div>
                </div>

                {/* Explanation */}
                {currentVersion?.explanation && (
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Explanation
                    </label>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 italic">
                      {currentVersion.explanation}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">
            Read-only revision comparison for <strong>{itemNumberDisplay}</strong>. Viewing history does not mutate active question records.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPdf}
              className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>📄 Export as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-brand-navy hover:bg-brand-indigo text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Close Comparison
            </button>
          </div>
        </div>
      </div>

      {/* Export Options Modal Dialog */}
      {showExportModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-brand-navy flex items-center gap-2">
                  <span>📄</span> Export Revision History PDF
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  What revision information would you like to include?
                </p>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {/* Option 1: Selected Revision vs Current Version */}
              <label
                onClick={() => setExportScope("selected")}
                className={`block p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  exportScope === "selected"
                    ? "bg-indigo-50/60 border-brand-indigo ring-2 ring-indigo-200"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === "selected"}
                    onChange={() => setExportScope("selected")}
                    className="mt-1 w-4 h-4 text-brand-indigo"
                  />
                  <div>
                    <span className="block text-sm font-bold text-slate-900">
                      Selected Revision vs Current Version
                    </span>
                    <span className="block text-xs text-slate-500 mt-1 leading-relaxed">
                      Export only the currently selected old revision (<strong>{activeOldRevision?.title}</strong>) compared side-by-side with the current live version.
                    </span>
                  </div>
                </div>
              </label>

              {/* Option 2: All Revisions & Complete Evolution */}
              <label
                onClick={() => setExportScope("all")}
                className={`block p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  exportScope === "all"
                    ? "bg-amber-50/60 border-amber-500 ring-2 ring-amber-200"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === "all"}
                    onChange={() => setExportScope("all")}
                    className="mt-1 w-4 h-4 text-amber-600"
                  />
                  <div>
                    <span className="block text-sm font-bold text-slate-900">
                      All Revisions & Evolution History
                    </span>
                    <span className="block text-xs text-slate-500 mt-1 leading-relaxed">
                      Export complete historical content for every version ({revisionsList.length} total) plus step-by-step sequential comparisons showing how the item evolved.
                    </span>
                  </div>
                </div>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={triggerPdfGeneration}
                disabled={exporting}
                className="px-5 py-2 bg-brand-navy hover:bg-brand-indigo text-white font-black text-xs rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {exporting ? "Generating PDF..." : "Export PDF Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
