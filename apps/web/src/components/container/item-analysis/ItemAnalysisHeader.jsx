export const ItemAnalysisHeader = ({ 
  sections, 
  quizzes, 
  selectedSection, 
  selectedQuiz, 
  loadingQuizzes,
  onSectionChange,
  onQuizChange 
}) => {
  return (
    <div>
      {/* Header */}
      <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
        <div className="p-6 bg-casual-green text-white">
          <h1 className="text-2xl font-bold uppercase tracking-wider">
            Item Analysis Report
          </h1>
          <p className="opacity-80 text-sm">
            Analyze question difficulty and discrimination based on student
            responses
          </p>
        </div>

        {/* Selection Controls */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Section Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Section *
              </label>
              <select
                value={selectedSection}
                onChange={(e) => {
                  onSectionChange(e.target.value);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                <option value="">-- Select a Section --</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                    {section.description ? ` - ${section.description}` : ""}
                  </option>
                ))}
              </select>
              {sections.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No sections found. Create a section first.
                </p>
              )}
            </div>

            {/* Quiz/Subject Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Quiz/Subject *
              </label>
              <select
                value={selectedQuiz}
                onChange={(e) => {
                  onQuizChange(e.target.value);
                }}
                disabled={!selectedSection || loadingQuizzes}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {loadingQuizzes
                    ? "Loading quizzes..."
                    : !selectedSection
                      ? "Select a section first"
                      : "-- Select a Quiz --"}
                </option>
                {quizzes && quizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
