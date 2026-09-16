const getCohortFilterLabel = (filter) => {
  const labels = {
    all: "All Students",
    top_performers: "Top 25% Performers",
    bottom_performers: "Bottom 25% Performers",
    middle_performers: "Middle 50% Performers",
    perfect_scores: "Perfect Scores Only",
    failing_scores: "Failing Scores (<60%)",
  };
  return labels[filter] || filter;
};

// SVG icon for info/help
const InfoIcon = ({ className = "h-3.5 w-3.5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// SVG icon for warning/alert
const AlertIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
    />
  </svg>
);

// SVG icon for chart/stats
const ChartIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

// SVG check icon
const CheckIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export const ItemAnalysisResults = ({
  selectedQuiz,
  analysis,
  saveError,
  handleSaveAnalysis,
  savingAnalysis,
  analysisSaved,
  totalAttempts,
  allTakers,
  selectedCohortFilter,
  testStats,
}) => {
  const isSmallSample =
    testStats?.isSmallSample || (totalAttempts > 0 && totalAttempts < 10);
  const sampleSize = testStats?.sampleSize || totalAttempts || 0;

  return (
    <div className="space-y-4">
      {/* Small Sample Size Warning Banner (F1 - Sampling Guard) */}
      {selectedQuiz && isSmallSample && (
        <div className="bg-brand-navy/5 border border-brand-navy/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <AlertIcon className="h-4 w-4 text-brand-navy" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-brand-navy flex items-center gap-2 flex-wrap">
                <span>Small Sample Size Warning (N = {sampleSize})</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-navy text-white uppercase">
                  Statistical Caution
                </span>
              </h4>
              <p className="text-xs text-brand-navy/80 mt-1 leading-relaxed">
                With fewer than 10 test takers, the calculated{" "}
                <strong>Difficulty Index (P)</strong> and{" "}
                <strong>Discrimination Index (D)</strong> are sensitive to
                individual student variations and carry statistical noise. A
                sample of <strong>at least 10 to 30 test takers</strong> is
                recommended for reliable psychometric calibration.
              </p>
              <p className="text-[11px] text-brand-navy/70 font-medium mt-1.5">
                Tip: Combine sections or gather more student attempts before
                permanently rejecting items.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Psychometrics & Test Reliability Overview (F2 - SEM & Internal Consistency) */}
      {selectedQuiz && testStats && sampleSize > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ChartIcon className="h-4 w-4 text-brand-navy" />
              <h4 className="text-sm font-bold text-brand-navy">
                Test Psychometrics &amp; Reliability Overview
              </h4>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Calculated across {sampleSize} examinee attempt
              {sampleSize !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Sample Size (N) */}
            <div
              className="bg-slate-50 rounded-lg p-3 border border-slate-100"
              title="Total number of evaluated test submissions (N)"
            >
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>Sample (N)</span>
                <span
                  className="text-slate-400 cursor-help"
                  title="Number of students whose test attempts are included in this item analysis"
                >
                  <InfoIcon />
                </span>
              </div>
              <p className="text-xl font-extrabold text-brand-navy mt-0.5">
                {testStats.sampleSize}
              </p>
              <span
                className={`text-[10px] font-bold ${
                  testStats.isSmallSample
                    ? "text-brand-navy/60"
                    : "text-brand-navy"
                }`}
              >
                {testStats.isSmallSample ? "Small Sample" : "Adequate Sample"}
              </span>
            </div>

            {/* Mean Score */}
            <div
              className="bg-slate-50 rounded-lg p-3 border border-slate-100"
              title="Average raw score achieved by examinees (Mean)"
            >
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>Mean (x&#772;)</span>
                <span
                  className="text-slate-400 cursor-help"
                  title="Arithmetic mean score of all test takers"
                >
                  <InfoIcon />
                </span>
              </div>
              <p className="text-xl font-extrabold text-brand-navy mt-0.5">
                {testStats.meanScore}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">
                Average Score
              </span>
            </div>

            {/* Standard Deviation */}
            <div
              className="bg-slate-50 rounded-lg p-3 border border-slate-100"
              title="Standard deviation of test scores (spread of ability)"
            >
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>Std Dev (s)</span>
                <span
                  className="text-slate-400 cursor-help"
                  title="Measures the dispersion or spread of test scores around the mean"
                >
                  <InfoIcon />
                </span>
              </div>
              <p className="text-xl font-extrabold text-brand-navy mt-0.5">
                {testStats.stdDev}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">
                Score Spread
              </span>
            </div>

            {/* KR-20 Internal Consistency Reliability (r_xx) */}
            <div
              className="bg-brand-navy/5 rounded-lg p-3 border border-brand-navy/10"
              title="Kuder-Richardson Formula 20 internal consistency reliability coefficient"
            >
              <div className="text-[11px] font-bold text-brand-navy flex items-center gap-1">
                <span>KR-20 (r_xx)</span>
                <span
                  className="text-brand-navy/40 cursor-help"
                  title="KR-20 measures internal consistency reliability of the exam (0.00 to 1.00). >=0.70 is acceptable for classroom tests."
                >
                  <InfoIcon />
                </span>
              </div>
              <p className="text-xl font-extrabold text-brand-navy mt-0.5">
                {testStats.kr20Reliability}
              </p>
              <span className="text-[10px] font-bold text-brand-navy/70">
                {parseFloat(testStats.kr20Reliability) >= 0.8
                  ? "High Reliability"
                  : parseFloat(testStats.kr20Reliability) >= 0.7
                  ? "Acceptable"
                  : "Needs Improvement"}
              </span>
            </div>

            {/* Standard Error of Measurement (SEM) */}
            <div
              className="bg-brand-indigo/5 rounded-lg p-3 border border-brand-indigo/10"
              title="Standard Error of Measurement (SEM = s * sqrt(1 - r_xx))"
            >
              <div className="text-[11px] font-bold text-brand-indigo flex items-center gap-1">
                <span>SEM (S_e)</span>
                <span
                  className="text-brand-indigo/40 cursor-help"
                  title="Standard Error of Measurement (SEM) estimates how much an observed test score may vary due to random error. Lower SEM indicates higher precision."
                >
                  <InfoIcon />
                </span>
              </div>
              <p className="text-xl font-extrabold text-brand-indigo mt-0.5">
                &plusmn;{testStats.sem}
              </p>
              <span className="text-[10px] text-brand-indigo/70 font-medium">
                Measurement Error
              </span>
            </div>

            {/* Standard Error of the Mean */}
            <div
              className="bg-slate-50 rounded-lg p-3 border border-slate-100"
              title="Standard Error of the Mean (SE_M = s / sqrt(N))"
            >
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>SE Mean</span>
                <span
                  className="text-slate-400 cursor-help"
                  title="Standard Error of the Mean reflects sampling precision of the average score"
                >
                  <InfoIcon />
                </span>
              </div>
              <p className="text-xl font-extrabold text-brand-navy mt-0.5">
                &plusmn;{testStats.semMean}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">
                Mean Precision
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Psychometric Reference & Evaluation Criteria (F3 - Anchor Concepts) */}
      {selectedQuiz && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-brand-navy flex items-center gap-1.5">
              <ChartIcon className="h-4 w-4" />
              <span>Psychometric Reference &amp; Evaluation Criteria</span>
            </h4>
            <span className="text-[11px] font-semibold text-brand-navy/60 bg-brand-navy/5 px-2 py-0.5 rounded-full border border-brand-navy/10">
              Kelley's 27% Rule
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-brand-navy">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <p className="font-bold text-brand-navy mb-1">
                Difficulty Index (P-value):
              </p>
              <p className="text-brand-navy/70 leading-relaxed">
                Proportion of students answering correctly (P = Correct /
                Total).{" "}
                <strong className="text-brand-navy">0.30 &ndash; 0.75</strong>{" "}
                = Moderate (Optimal),{" "}
                <strong className="text-brand-navy">&gt; 0.75</strong> = Easy,{" "}
                <strong className="text-brand-navy">&lt; 0.30</strong> =
                Difficult.
              </p>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <p className="font-bold text-brand-navy mb-1">
                Discrimination Index (D):
              </p>
              <p className="text-brand-navy/70 leading-relaxed">
                Differentiates top 27% from bottom 27% scorers (D = Pu &minus;
                Pl). <strong className="text-brand-navy">&ge; 0.40</strong> =
                Excellent,{" "}
                <strong className="text-brand-navy">0.30 &ndash; 0.39</strong>{" "}
                = Good,{" "}
                <strong className="text-brand-navy">0.20 &ndash; 0.29</strong>{" "}
                = Marginal (Revise),{" "}
                <strong className="text-brand-navy">&lt; 0.20</strong> = Poor
                (Reject).
              </p>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <p className="font-bold text-brand-navy mb-1">
                Discrimination Index:
              </p>
              <p className="text-brand-navy/70 leading-relaxed">
                Calculated using upper (top 27%) and lower (bottom 27%) groups
                based on total quiz scores. Cohort filters allow analysis of
                specific performance groups.
              </p>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <p className="font-bold text-brand-navy mb-1">
                Distractor Analysis:
              </p>
              <p className="text-brand-navy/70 leading-relaxed">
                Evaluates the effectiveness of each option by counting student
                selections. A functioning distractor should attract at least one
                student from the lower group.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Results Table & Actions */}
      {selectedQuiz && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
          {/* Action Bar */}
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
                className={`px-6 py-2 rounded-full font-semibold text-white transition-colors ${
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
                  ? "Saved"
                  : "Save Analysis"}
              </button>
            </div>
          </div>

          {/* All Takers Section */}
          {allTakers && allTakers.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
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
                        <td className="p-3 text-gray-800 font-medium">
                          {taker.name}
                        </td>
                        <td className="p-3 text-center font-mono text-brand-navy font-bold">
                          {taker.score}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-1 bg-brand-navy/5 text-brand-navy text-xs rounded-full font-semibold border border-brand-navy/10">
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
