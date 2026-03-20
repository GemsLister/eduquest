import React from 'react';
import { useGeminiSuggest } from '../../../hooks/analysisHook/useGeminiSuggest';

export const EditChoiceModal = ({ isOpen, onClose, questionData, onManualEdit, questionId }) => {
  const { generateSuggestion, loading, suggestion, error } = useGeminiSuggest();

  const handleAIGenerate = async () => {
    await generateSuggestion(questionData);
  };

  const handleAIApply = () => {
    try {
      const parsed = JSON.parse(suggestion);
      // Call update
      // onApplyAI(parsed.text, parsed.options, parsed.correct_answer);
      onClose();
    } catch (err) {
      alert('Invalid AI suggestion');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Edit Question Q{questionData?.index + 1}</h2>
          <p className="text-gray-600 mt-1">Current flag: <span className="font-bold text-red-600">{questionData?.autoFlag?.toUpperCase()}</span></p>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-lg mb-3 text-gray-800 border-b pb-2">Manual Edit</h3>
              <p className="text-sm text-gray-600 mb-4">Edit question text, options manually.</p>
              <button 
                onClick={onManualEdit}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
              >
                ✏️ Edit Manually
              </button>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-3 text-gray-800 border-b pb-2">AI Suggestion (Gemini)</h3>
              <p className="text-sm text-gray-600 mb-4">Generate improved version for moderate difficulty.</p>
              <button 
                onClick={handleAIGenerate}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '🤖 Generating...' : '🤖 Suggest with AI'}
              </button>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              {suggestion && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl max-h-40 overflow-y-auto">
                  <pre className="text-xs text-gray-800 font-mono">{suggestion}</pre>
                  <button 
                    onClick={handleAIApply}
                    className="mt-3 w-full bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-2 px-4 rounded-lg transition-all"
                  >
                    Apply AI Suggestion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-6 border-t bg-gray-50 text-center">
          <button 
            onClick={onClose}
            className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

