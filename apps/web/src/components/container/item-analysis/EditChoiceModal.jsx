import React, { useState, useEffect } from 'react';
import { useGeminiSuggest } from '../../../hooks/analysisHook/useGeminiSuggest';

export const EditChoiceModal = ({ isOpen, onClose, questionData, questionId }) => {
  const { generateSuggestion, saveRevision, loading, suggestion, error } = useGeminiSuggest();
  const [isManualEdit, setIsManualEdit] = useState(false);
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
    await generateSuggestion(questionData);
  };

  const handleAIApplyAsDraft = async () => {
    try {
      // Clean suggestions in case AI wrapped it in markdown code blocks
      const cleanSuggestion = typeof suggestion === 'string' 
        ? suggestion.replace(/```json|```/g, '').trim() 
        : suggestion;
        
      const parsed = typeof cleanSuggestion === 'string' ? JSON.parse(cleanSuggestion) : cleanSuggestion;
      
      // Map text answer to index if necessary before saving
      const correctVal = typeof parsed.correct_answer === 'string' 
        ? parsed.options.indexOf(parsed.correct_answer) 
        : parsed.correct_answer;

      await saveRevision(questionId, parsed.text, parsed.options, correctVal);
      alert('AI Revision applied and saved!');
      onClose();
      window.dispatchEvent(new Event("questions-updated"));
    } catch (err) {
      console.error(err);
      alert('Error parsing or saving AI revision: ' + err.message);
    }
  };

  const handleSaveDraft = async () => {
    if (!formData.text.trim()) return alert("Question text is required");
    if (formData.options.some(opt => !opt?.trim())) return alert("All options must be filled");

    try {
      await saveRevision(questionId, formData.text, formData.options, formData.correctAnswer);
      alert('Question updated successfully!');
      onClose();
      window.dispatchEvent(new Event("questions-updated"));
    } catch (err) {
      alert('Error saving revision: ' + err.message);
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  if (!isOpen) return null;

  const hasDraft = !!(questionData?.revised_content || questionData?.revised_options);

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
              {hasDraft && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold uppercase">
                  Revision History Active
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
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">⏮️ Previous Version</h3>
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex-1">
                  <p className="text-gray-700 text-sm mb-4 font-medium">{questionData?.original_text || questionData?.text}</p>
                  <div className="space-y-2">
                    {(questionData?.original_options || questionData?.options)?.map((opt, idx) => {
                      const isCorrect = String(opt) === String(questionData?.original_correct_answer || questionData?.correct_answer);
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

          <div className="p-6">
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

                {suggestion && (
                  <div className="col-span-full mt-4 p-5 bg-gray-50 rounded-2xl border border-gray-200">
                    <h4 className="font-bold text-gray-700 mb-3">✨ AI Suggestion Ready</h4>
                    <div className="bg-white p-4 rounded-xl border mb-4 max-h-40 overflow-y-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap">{suggestion}</pre>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleAIApplyAsDraft} className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl">Apply AI Revision</button>
                      <button onClick={handleAIGenerate} className="bg-gray-200 px-6 rounded-xl">Regenerate</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <button onClick={() => setIsManualEdit(false)} className="text-blue-600 font-semibold hover:underline">← Back</button>
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
                <div className="pt-4 flex gap-3">
                  <button onClick={handleSaveDraft} className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg">Save & Update</button>
                  <button onClick={() => setIsManualEdit(false)} className="bg-gray-200 px-8 rounded-xl">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};