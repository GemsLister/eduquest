import React from "react";

export const ItemAnalysisHeader = ({
  sections,
  quizzes,
  selectedSection,
  selectedQuiz,
  loadingQuizzes,
  onSectionChange, // Use the prop from the parent
  onQuizChange,    // Use the prop from the parent
  onSearchChange,
  onStudentSearchChange,
  onCohortFilterChange,
  selectedCohortFilter,
  cohortOptions,
  searchedStudent,
}) => {
  return (
    <div>
      <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
        {/* Header Title Section */}
        <div className="p-6 bg-brand-navy text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider">
              Item Analysis Report
            </h1>
            <p className="opacity-80 text-sm">
              Analyze question difficulty and discrimination based on student
              responses
            </p>
          </div>
          
          {/* Display Searched Student Overall Score(s) */}
          {searchedStudent && searchedStudent.length > 0 && (
            <div className="bg-white/20 backdrop-blur-md p-3 px-5 rounded-xl border border-white/30 text-right animate-in fade-in slide-in-from-right-4 duration-500 max-h-32 overflow-y-auto scrollbar-hide">
              <div className="text-[10px] uppercase font-black opacity-80 tracking-widest mb-1 sticky top-0">
                Student Performance Found
              </div>
              <div className="space-y-2">
                {searchedStudent.map((student, idx) => (
                  <div key={idx} className="border-b border-white/10 pb-1 last:border-0">
                    <div className="text-sm font-black truncate max-w-[200px]">
                      {student.name}
                    </div>
                    <div className="text-xs font-bold">
                      Score: <span className="text-yellow-300 text-sm">{student.totalScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selection Controls */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Section Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Section *
              </label>
              <select
                value={selectedSection}
                onChange={(e) => onSectionChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
                onChange={(e) => onQuizChange(e.target.value)}
                disabled={!selectedSection || loadingQuizzes}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {loadingQuizzes
                    ? "Loading quizzes..."
                    : !selectedSection
                      ? "Select a section first"
                      : "-- Select a Quiz --"}
                </option>
                {quizzes &&
                  quizzes.map((quiz) => (
                    <option key={quiz.id} value={quiz.id}>
                      {quiz.title}
                    </option>
                  ))}
              </select>
            </div>

            {/* NEW: Question Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Search Questions
              </label>
              <input
                type="text"
                placeholder="Search by question text..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              />
            </div>

            {/* NEW: Student Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Search Student
              </label>
              <input
                type="text"
                placeholder="Search student name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                onChange={(e) => onStudentSearchChange && onStudentSearchChange(e.target.value)}
              />
            </div>

            {/* NEW: Cohort Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Filter by Cohort
              </label>
              <select
                value={selectedCohortFilter}
                onChange={(e) => onCohortFilterChange && onCohortFilterChange(e.target.value)}
                disabled={!selectedSection}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="all">All Students</option>
                {cohortOptions?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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