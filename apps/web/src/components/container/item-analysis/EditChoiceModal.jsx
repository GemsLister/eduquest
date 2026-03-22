import React, { useState, useEffect } from 'react';
import { useGeminiSuggest } from '../../../hooks/analysisHook/useGeminiSuggest';

export const EditChoiceModal = ({ isOpen, onClose, questionData, questionId }) => {
  const { generateSuggestion, updateQuestion, saveRevision, loading, suggestion, error } = useGeminiSuggest();
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [formData, setFormData] = useState({
    text: '',
    options: ['', ''],
    correctAnswer: 0
  });

  // Load either revised content (draft) or original content
  useEffect(() => {
    if (isOpen && questionData) {
      const text = questionData.revised_content?.text || questionData.text || '';
      const options = [...(questionData.revised_options || questionData.options || ['', ''])];
      
      // Determine the correct index
      let correctIdx = 0;
      const rawCorrect = questionData.revised_content?.correct_answer ?? questionData.correct_answer;

      if (typeof rawCorrect === 'number') {
        correctIdx = rawCorrect;
      } else {
        const foundIdx = options.indexOf(rawCorrect);
        correctIdx = foundIdx !== -1 ? foundIdx : 0;
      }

      setFormData({ text, options, correctAnswer: correctIdx });
      setIsManualEdit(false);
    }
  }, [isOpen, questionData]);

  const handleAIGenerate = async () => {
    const result = await generateSuggestion(questionData);
    if (result) {
      // Immediately populate the form with AI result
      setFormData({
        text: result.text,
        options: result.options,
        correctAnswer: typeof result.correct_answer === 'string' 
          ? result.options.indexOf(result.correct_answer) 
          : result.correct_answer
      });
      // Switch to manual edit view so they see the changes in the form
      setIsManualEdit(true);
    }
  };

  const handleSaveDraft = async () => {
    if (!formData.text.trim()) return alert("Question text is required");
    if (formData.options.some(opt => !opt?.trim())) return alert("All options must be filled");

    try {
      // FINAL SAVE (Badge will disappear)
      await updateQuestion(questionId, formData.text, formData.options, formData.correctAnswer);
      alert('Question updated and finalized successfully!');
      onClose();
      window.dispatchEvent(new Event("questions-updated"));
    } catch (err) {
      alert('Error finalizing revision: ' + err.message);
    }
  };

  const handleJustSaveDraft = async () => {
    try {
      // JUST DRAFT (Badge will stay)
      await saveRevision(questionId, formData.text, formData.options, formData.correctAnswer);
      alert('Draft saved successfully!');
      window.dispatchEvent(new Event("questions-updated"));
    } catch (err) {
      alert('Error saving draft: ' + err.message);
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  if (!isOpen) return null;

  const hasDraft = !!(questionData?.revised_content || questionData?.revised_options);
  const isRevised = !!questionData?.previous_text;
  const history = Array.isArray(questionData?.revision_history) 
    ? [...questionData.revision_history].reverse() // Show newest revisions first
    : [];

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Edit Question Q{questionData?.index + 1}</h2>
            <div className="flex flex-wrap gap-2 mt-1">
              {questionData?.autoFlag && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold uppercase">
                  {questionData.autoFlag}
                </span>
              )}
              {isRevised && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold uppercase">
                  ✓ Item Revised
                </span>
              )}
              {hasDraft && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold uppercase">
                  Revision Draft Active
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Comparison View */}
          <div className="px-6 py-5 bg-slate-50 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Previous Version */}
              <div className="flex flex-col">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  {isRevised ? "⏮️ Previous Revision" : "📄 Original Version"}
                </h3>
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex-1">
                  <p className="text-gray-700 text-sm mb-4 font-medium">
                    {questionData?.previous_text || questionData?.original_text || questionData?.text}
                  </p>
                  <div className="space-y-2">
                    {(questionData?.previous_options || questionData?.original_options || questionData?.options)?.map((opt, idx) => {
                      const isCorrect = String(opt) === String(questionData?.previous_correct_answer || questionData?.original_correct_answer || questionData?.correct_answer);
                      return (
                        <div key={idx} className={`text-[11px] p-2 rounded-lg border flex items-center gap-2 ${isCorrect ? "bg-emerald-50 border-emerald-100 text-emerald-700 font-bold" : "bg-slate-50 text-slate-500"}`}>
                          <span className="w-5 h-5 flex items-center justify-center rounded bg-white border text-[10px]">{String.fromCharCode(65 + idx)}</span>
                          <span className="flex-1">{opt}</span>
                          {isCorrect && <span>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="flex flex-col">
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">🆕 New Version (Preview)</h3>
                <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100 flex-1 ring-1 ring-blue-50">
                  <p className="text-blue-900 text-sm font-bold mb-4">{formData.text || "..."}</p>
                  <div className="space-y-2">
                    {formData.options.map((opt, idx) => (
                      <div key={idx} className={`text-[11px] p-2 rounded-lg border flex items-center gap-2 transition-all ${formData.correctAnswer === idx ? "bg-blue-600 border-blue-700 text-white font-bold scale-[1.02]" : "bg-white text-blue-700/70"}`}>
                        <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] ${formData.correctAnswer === idx ? "bg-white text-blue-600" : "bg-blue-50"}`}>{String.fromCharCode(65 + idx)}</span>
                        <span className="flex-1">{opt || `Option ${idx + 1}`}</span>
                        {formData.correctAnswer === idx && <span>★</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Revision History Section (Browser Style) */}
          {history.length > 0 && (
            <div className="px-6 py-4 bg-slate-50 border-b">
              <button 
                onClick={() => setShowFullHistory(!showFullHistory)}
                className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
              >
                <span>📜 View Full Revision History ({history.length})</span>
                <span className={`transition-transform duration-300 ${showFullHistory ? "rotate-180" : ""}`}>▼</span>
              </button>

              {showFullHistory && (
                <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-top-2">
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                    {history.map((rev, hIdx) => (
                      <div key={hIdx} className="group px-4 py-3 hover:bg-slate-50 transition-all">
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-bold text-slate-400 w-16 shrink-0">{formatTime(rev.revised_at)}</span>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-600 truncate font-medium group-hover:text-indigo-600 transition-colors">
                              {rev.text}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                                {formatDate(rev.revised_at)}
                              </span>
                              <span className="text-[9px] text-slate-300 font-medium italic">
                                Version {history.length - hIdx}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 grid grid-cols-4 gap-1">
                            {rev.options.map((opt, oIdx) => {
                              const isCorrect = String(opt) === String(rev.correct_answer);
                              return (
                                <div key={oIdx} className={`w-4 h-4 rounded-sm border flex items-center justify-center text-[8px] font-bold ${isCorrect ? "bg-emerald-500 border-emerald-600 text-white" : "bg-slate-100 border-slate-200 text-slate-400"}`}>
                                  {String.fromCharCode(65 + oIdx)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Suggestions / Form */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {hasDraft ? "📝 Draft Revision" : "🛠️ Active Workspace"}
              </h3>
            </div>
            {!isManualEdit ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manual Edit Card */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <h3 className="font-bold text-xl mb-2 text-blue-800">✏️ Manual Edit</h3>
                  <p className="text-sm text-blue-600 mb-6">Edit the question text and options yourself.</p>
                  <button onClick={() => setIsManualEdit(true)} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg">
                    {hasDraft ? "Continue Editing Draft" : "Edit Manually"}
                  </button>
                </div>

                {/* AI Suggestion Card */}
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                  <h3 className="font-bold text-xl mb-2 text-emerald-800">🤖 AI Suggestion</h3>
                  <p className="text-sm text-emerald-600 mb-6">Let Gemini improve the question quality.</p>
                  <button onClick={handleAIGenerate} disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50">
                    {loading ? 'Generating...' : 'Suggest with AI'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <button onClick={() => setIsManualEdit(false)} className="text-blue-600 font-semibold hover:underline flex items-center gap-1">
                    <span>←</span> Back to Options
                  </button>
                  <button 
                    onClick={handleAIGenerate} 
                    disabled={loading}
                    className="text-emerald-600 font-bold hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <span>{loading ? '⏳' : '🤖'}</span>
                    {loading ? 'Regenerating...' : 'Regenerate with AI'}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Question Text</label>
                  <textarea 
                    value={formData.text}
                    onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    rows="3"
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">Options (Select correct one)</label>
                  {formData.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        checked={formData.correctAnswer === idx} 
                        onChange={() => setFormData(prev => ({ ...prev, correctAnswer: idx }))} 
                        className="w-5 h-5"
                      />
                      <input 
                        type="text" 
                        value={opt} 
                        onChange={(e) => updateOption(idx, e.target.value)}
                        className="flex-1 px-4 py-2 border rounded-xl"
                        placeholder={`Option ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              <div className="pt-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  <button 
                    onClick={handleSaveDraft} 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
                  >
                    🚀 Finalize & Update Live
                  </button>
                  <button 
                    onClick={handleJustSaveDraft}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md transition-all"
                  >
                    💾 Save as Draft
                  </button>
                </div>
                <button 
                  onClick={() => setIsManualEdit(false)} 
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};