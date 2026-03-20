import React, { useState } from 'react';
import ItemAnalysisTable from './ItemAnalysisTable';
import EditChoiceModal from './EditChoiceModal';
import { useGeminiSuggest } from '../../../hooks/analysisHook/useGeminiSuggest';

export const ItemAnalysisWithAI = ({ analysis, expandedQuestion, toggleDetails }) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const { generateSuggestion, updateQuestion, loading, suggestion, error } = useGeminiSuggest();

  const handleFlagClick = (item) => {
    if (item.autoFlag === 'revise') {
      setSelectedQuestion({ ...item, index: analysis.indexOf(item) });
      setEditModalOpen(true);
    }
  };

  const onManualEdit = () => {
    // Redirect to manual edit page or form
    window.location.href = `/instructor-dashboard/edit-question/${selectedQuestion.question_id}`;
    setEditModalOpen(false);
  };

  const onAIApply = async () => {
    try {
      const parsed = JSON.parse(suggestion);
      await updateQuestion(selectedQuestion.question_id, parsed.text, parsed.options, parsed.correct_answer);
      alert('Question updated with AI suggestion!');
      setEditModalOpen(false);
    } catch (err) {
      alert('Error applying suggestion: ' + err.message);
    }
  };

  return (
    <>
      <ItemAnalysisTable 
        analysis={analysis}
        expandedQuestion={expandedQuestion}
        toggleDetails={toggleDetails}
        onFlagClick={handleFlagClick}
      />
      <EditChoiceModal 
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        questionData={selectedQuestion}
        onManualEdit={onManualEdit}
        questionId={selectedQuestion?.question_id}
      />
    </>
  );
};

