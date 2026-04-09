import React, { useState, useEffect } from 'react';
import { useGeminiSuggest } from '../../../hooks/analysisHook/useGeminiSuggest';
import { RevisionHistoryModal } from './RevisionHistoryModal';

export const EditChoiceModal = ({ isOpen, onClose, questionData, questionId }) => {
  const { generateSuggestion, updateQuestion, saveRevision, loading, suggestion, error } = useGeminiSuggest();
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState(null);
  const [selectedRevisionIndex, setSelectedRevisionIndex] = useState(null);
  const [comparisonVersion, setComparisonVersion] = useState(null);
  const [formData, setFormData] = useState({
    text: '',
    options: ['', ''],
    correctAnswer: 0
  });

  // Load either revised content (draft) or original content
  useEffect(() => {
    if (isOpen && questionData) {
      // For REJECTED items, start with blank fields to encourage new question creation
      if (questionData.autoFlag === 'reject') {
        setFormData({ 
          text: '', 
          options: ['', '', '', ''], // Start with 4 empty options
          correctAnswer: 0 
        });
      } else {
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
      }
      
      setIsManualEdit(false);
      
      // Default comparison to the original/previous state (only for non-rejected items)
      if (questionData.autoFlag !== 'reject') {
        setComparisonVersion({
          text: questionData?.previous_text || questionData?.original_text || questionData?.text,
          options: questionData?.previous_options || questionData?.original_options || questionData?.options,
          correct_answer: questionData?.previous_correct_answer || questionData?.original_correct_answer || questionData?.correct_answer,
          label: questionData?.previous_text ? "Previous Revision" : "Original Version",
          isOriginal: true
        });
      }
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
        {/* Revision History Modal */}
        {selectedRevision && (
          <RevisionHistoryModal
            isOpen={!!selectedRevision}
            onClose={() => { setSelectedRevision(null); setSelectedRevisionIndex(null); }}
            revision={selectedRevision}
            revisionIndex={selectedRevisionIndex}
            totalRevisions={history.length}
          />
        )}
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {questionData?.autoFlag === 'reject' ? 'Replace Question Q' : 'Edit Question Q'}{questionData?.index + 1}
            </h2>
            <div className="flex flex-wrap gap-2 mt-1">
              {questionData?.autoFlag && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  questionData.autoFlag === 'reject' 
                    ? 'bg-gray-100 text-gray-700' 
                    : 'bg-red-100 text-red-600'
                }`}>
                  {questionData.autoFlag === 'reject' ? 'REJECTED - Replace with New Question' : questionData.autoFlag}
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
            {questionData?.autoFlag === 'reject' && (
              <p className="text-sm text-gray-600 mt-2">
                This item has been rejected due to poor quality. Create a completely new question to replace it.
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Comparison View - Only show for REVISE items, not REJECT */}
          {questionData?.autoFlag === 'reject' ? (
            <div className="px-6 py-5 bg-slate-50 border-b">
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                  <span className="text-2xl">&#128680;</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Create a Completely New Question</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  The previous question was rejected due to poor quality. 
                  Create a new question that tests the same topic/concept but with completely different content.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-amber-600">&#128161;</span>
                  <span className="text-sm text-amber-700 font-medium">Focus on the topic, not the previous question</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5 bg-slate-50 border-b">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Previous Version */}
                <div className="flex flex-col">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>&#128466;</span> {comparisonVersion?.label || (isRevised ? "Previous Revision" : "Original Version")}
                  </h3>
                  <div className="space-y-4 flex-1">
                    {/* Question Text Block */}
                    <div>
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span>&#128221;</span> Question Text
                      </h4>
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <p className="text-gray-700 text-sm font-medium leading-relaxed">
                          {comparisonVersion?.text}
                        </p>
                      </div>
                    </div>

                    {/* Options Block */}
                    <div>
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span>&#9678;</span> Answer Options
                      </h4>
                      <div className="space-y-2">
                        {comparisonVersion?.options?.map((opt, idx) => {
                          const isCorrect = String(opt) === String(comparisonVersion?.correct_answer);
                          return (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-lg border-2 transition-all ${
                                isCorrect
                                  ? "bg-emerald-50 border-emerald-300 shadow-sm shadow-emerald-100"
                                  : "bg-white border-slate-100"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={`w-6 h-6 flex items-center justify-center rounded font-bold text-[10px] shrink-0 ${
                                    isCorrect
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <div className="flex-1 pt-0.5">
                                  <p className={`text-xs ${isCorrect ? "font-bold text-emerald-900" : "text-gray-600"}`}>
                                    {opt}
                                  </p>
                                </div>
                                {isCorrect && (
                                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    &#10003; <span className="hidden sm:inline">Correct</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Preview */}
                <div className="flex flex-col">
                  <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>&#127475;</span> New Version (Preview)
                  </h3>
                  <div className="space-y-4 flex-1">
                    {/* New Question Text Block */}
                    <div>
                      <h4 className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span>&#128221;</span> Revised Text
                      </h4>
                      <div className="bg-indigo-50/30 border border-indigo-100 rounded-xl p-4 shadow-sm ring-1 ring-indigo-50/50">
                        <p className="text-indigo-900 text-sm font-bold leading-relaxed">
                          {formData.text || "..."}
                        </p>
                      </div>
                    </div>

                    {/* New Options Block */}
                    <div>
                      <h4 className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span>&#9678;</span> Revised Options
                      </h4>
                      <div className="space-y-2">
                        {formData.options.map((opt, idx) => {
                          const isCorrect = formData.correctAnswer === idx;
                          return (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-lg border-2 transition-all ${
                                isCorrect
                                  ? "bg-indigo-600 border-indigo-700 shadow-md shadow-indigo-100 scale-[1.02]"
                                  : "bg-white border-indigo-50"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={`w-6 h-6 flex items-center justify-center rounded font-bold text-[10px] shrink-0 ${
                                    isCorrect
                                      ? "bg-white text-indigo-600"
                                      : "bg-indigo-50 text-indigo-300"
                                  }`}
                                >
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <div className="flex-1 pt-0.5">
                                  <p className={`text-xs ${isCorrect ? "font-bold text-white" : "text-indigo-700/70"}`}>
                                    {opt || `Option ${idx + 1}`}
                                  </p>
                                </div>
                                {isCorrect && (
                                  <span className="text-[9px] font-bold text-indigo-600 bg-white px-1.5 py-0.5 rounded flex items-center gap-1">
                                    &#9733; <span className="hidden sm:inline">Correct</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                      <button
                        key={hIdx}
                        onClick={() => {
                          setComparisonVersion({
                            ...rev,
                            label: `Version ${history.length - hIdx}`,
                            isOriginal: false
                          });
                        }}
                        className={`w-full text-left group px-4 py-3 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-inset ${
                          comparisonVersion?.label === `Version ${history.length - hIdx}` ? "bg-indigo-50 border-l-4 border-indigo-600" : "hover:bg-indigo-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-bold text-slate-400 w-16 shrink-0">{formatTime(rev.revised_at || rev.timestamp)}</span>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-600 truncate font-medium group-hover:text-indigo-600 transition-colors">
                              {rev.text}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                                {formatDate(rev.revised_at || rev.timestamp)}
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

                          <span className="text-indigo-600 group-hover:text-indigo-700 transition-colors ml-2 shrink-0">
                            →
                          </span>
                        </div>
                      </button>
                    ))}
                    {/* Original Version item at the bottom of the history */}
                    <button
                      onClick={() => {
                        setComparisonVersion({
                          text: questionData?.previous_text || questionData?.original_text || questionData?.text,
                          options: questionData?.previous_options || questionData?.original_options || questionData?.options,
                          correct_answer: questionData?.previous_correct_answer || questionData?.original_correct_answer || questionData?.correct_answer,
                          label: questionData?.previous_text ? "Previous Revision" : "Original Version",
                          isOriginal: true
                        });
                      }}
                      className={`w-full text-left group px-4 py-3 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-inset ${
                        comparisonVersion?.isOriginal ? "bg-indigo-50 border-l-4 border-indigo-600" : "hover:bg-indigo-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-4 opacity-70">
                        <span className="text-[10px] font-bold text-slate-400 w-16 shrink-0">Original</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-600 truncate font-medium group-hover:text-indigo-600 transition-colors">
                            {questionData?.original_text || questionData?.text}
                          </p>
                          <div className="mt-1">
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                              Initial Version
                            </span>
                          </div>
                        </div>
                        <span className="text-indigo-600 group-hover:text-indigo-700 transition-colors ml-2 shrink-0">
                          ↺
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Suggestions / Form */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {questionData?.autoFlag === 'reject' 
                  ? "Create New Question" 
                  : hasDraft 
                    ? "Draft Revision" 
                    : "Active Workspace"
                }
              </h3>
            </div>
            {!isManualEdit ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manual Edit Card */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <h3 className="font-bold text-xl mb-2 text-blue-800">
                    {questionData?.autoFlag === 'reject' ? '✏️ Create New Question' : '✏️ Manual Edit'}
                  </h3>
                  <p className="text-sm text-blue-600 mb-6">
                    {questionData?.autoFlag === 'reject' 
                      ? "Create a completely new question to replace the rejected one." 
                      : "Edit the question text and options yourself."
                    }
                  </p>
                  <button onClick={() => setIsManualEdit(true)} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg">
                    {hasDraft ? "Continue Editing Draft" : questionData?.autoFlag === 'reject' ? "Create New Question" : "Edit Manually"}
                  </button>
                </div>

                {/* AI Suggestion Card */}
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                  <h3 className="font-bold text-xl mb-2 text-emerald-800">🤖 AI Suggestion</h3>
                  <p className="text-sm text-emerald-600 mb-6">
                    {questionData?.autoFlag === 'reject' 
                      ? "Let Gemini generate a completely new question for you." 
                      : "Let Gemini improve the question quality."
                    }
                  </p>
                  <button onClick={handleAIGenerate} disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50">
                    {loading ? 'Generating...' : questionData?.autoFlag === 'reject' ? 'Generate New Question' : 'Suggest with AI'}
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
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {questionData?.autoFlag === 'reject' ? 'New Question Text' : 'Question Text'}
                  </label>
                  <textarea 
                    value={formData.text}
                    onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    rows="3"
                    placeholder={questionData?.autoFlag === 'reject' ? 'Enter your new question here...' : ''}
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-700">
                    {questionData?.autoFlag === 'reject' ? 'New Answer Options (Select correct one)' : 'Options (Select correct one)'}
                  </label>
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
                        placeholder={questionData?.autoFlag === 'reject' ? `New Option ${idx + 1}` : `Option ${idx + 1}`}
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
                    {questionData?.autoFlag === 'reject' ? 'Finalize & Replace Question' : 'Finalize & Update Live'}
                  </button>
                  <button 
                    onClick={handleJustSaveDraft}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md transition-all"
                  >
                    Save as Draft
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