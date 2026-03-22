import React, { useState } from 'react';

export const RevisionHistoryModal = ({ isOpen, onClose, revision, revisionIndex, totalRevisions }) => {
  if (!isOpen || !revision) return null;

  const formatFullDate = (dateStr) => {
    if (!dateStr) return "Date not available";
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const revDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now - revDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return formatFullDate(dateStr);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-md">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📜</span>
              <h2 className="text-2xl font-bold text-gray-800">Revision #{totalRevisions - revisionIndex}</h2>
            </div>
            <p className="text-sm text-gray-600">
              {formatRelativeTime(revision.revised_at)} 
              <span className="text-gray-400 ml-2">•</span>
              <span className="text-gray-600 ml-2">{formatFullDate(revision.revised_at)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 custom-scrollbar">
          {/* Question Text */}
          <div className="mb-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>📝</span> Question Text
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-gray-800 font-medium text-sm leading-relaxed">
                {revision.text || "No text available"}
              </p>
            </div>
          </div>

          {/* Options and Correct Answer */}
          <div className="mb-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>🔘</span> Answer Options
            </h3>
            <div className="space-y-2">
              {revision.options && Array.isArray(revision.options) ? (
                revision.options.map((option, idx) => {
                  const isCorrect = String(option) === String(revision.correct_answer);
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        isCorrect
                          ? "bg-emerald-50 border-emerald-300 shadow-sm shadow-emerald-100"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-7 h-7 flex items-center justify-center rounded font-bold text-sm shrink-0 ${
                            isCorrect
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <div className="flex-1 pt-0.5">
                          <p className={`text-sm ${isCorrect ? "font-bold text-emerald-900" : "text-gray-700"}`}>
                            {option || `Option ${idx + 1}`}
                          </p>
                        </div>
                        {isCorrect && (
                          <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                            ✓ Correct
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 text-sm italic">No options recorded for this revision</p>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Timestamp</span>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-800">{formatFullDate(revision.revised_at)}</p>
                <p className="text-xs text-gray-500 mt-1">{formatRelativeTime(revision.revised_at)}</p>
              </div>
            </div>
            {revision.revised_at && (
              <div className="flex justify-between items-start pt-2 border-t border-blue-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">ISO Format</span>
                <p className="text-xs text-gray-600 font-mono text-right">{revision.revised_at}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition-all shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
