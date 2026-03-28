const getCohortFilterLabel = (filter) => {
  const labels = {
    "all": "All Students",
    "top_performers": "Top 25% Performers",
    "bottom_performers": "Bottom 25% Performers",
    "middle_performers": "Middle 50% Performers",
    "perfect_scores": "Perfect Scores Only",
    "failing_scores": "Failing Scores (<60%)"
  };
  return labels[filter] || filter;
};

export const ItemAnalysisResults = ({ 
  selectedQuiz, 
  analysis, 
  saveError, 
  handleSaveAnalysis, 
  savingAnalysis, 
  analysisSaved,
  totalAttempts,
  allTakers,
  selectedCohortFilter
}) => {
  return (
    <div>
      {/* Analysis Results */}
      {selectedQuiz && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
          {/* Action Buttons */}
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
            <h3 className="text-lg font-semibold text-gray-700">
              Analysis Results
              {analysis?.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({analysis.length} questions)
                </span>
              )}
            </h3>
            {selectedCohortFilter !== "all" && (
              <div className="mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Filter: {getCohortFilterLabel(selectedCohortFilter)}
                </span>
              </div>
            )}
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
              💡 <strong>Auto-Versioning:</strong> When you save with revisions, a new quiz version is automatically created with your changes applied.
            </div>
          </div>
            
            <div className="flex gap-2">
              {saveError && (
                <span className="text-red-500 text-sm self-center">
                  {saveError}
                </span>
              )}
              <button
                onClick={handleSaveAnalysis}
                disabled={savingAnalysis || !analysis || analysis.length === 0}
                className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors ${
                  savingAnalysis || !analysis || analysis.length === 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : analysisSaved
                      ? "bg-brand-gold hover:bg-brand-gold-dark text-brand-navy"
                      : "bg-brand-navy hover:bg-brand-indigo"
                }`}
              >
                {savingAnalysis 
                  ? "Saving..." 
                  : analysisSaved 
                    ? "Saved ✓" 
                    : "Save Analysis"}
              </button>
            </div>
          </div>

          {/* All Takers Section - Show all students who took the exam */}
          {allTakers && allTakers.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <h4 className="text-md font-semibold text-gray-700 mb-3">
                All Students Who Took This Exam ({totalAttempts})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="p-3 text-left">Student Name</th>
                      <th className="p-3 text-center">Score</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allTakers.map((taker) => (
                      <tr key={taker.id} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-800 font-medium">{taker.name}</td>
                        <td className="p-3 text-center font-mono text-indigo-600">{taker.score}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
                            Completed
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
