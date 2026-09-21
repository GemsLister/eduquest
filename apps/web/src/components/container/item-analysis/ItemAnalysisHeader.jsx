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
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8 -mx-6 -mt-6 mb-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-brand-gold text-xs font-bold tracking-widest uppercase mb-1">
              Instructor Dashboard
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              Item Analysis Report
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Analyze question difficulty and discrimination based on student responses
            </p>
          </div>
          
          {/* Display Searched Student Overall Score(s) */}
          {searchedStudent && searchedStudent.length > 0 && (
            <div className="bg-white/10 backdrop-blur-md p-3.5 px-5 rounded-2xl border border-white/20 text-right animate-in fade-in slide-in-from-right-4 duration-500 max-h-32 overflow-y-auto shadow-2xs">
              <div className="text-[10px] uppercase font-bold text-brand-gold tracking-widest mb-1 sticky top-0">
                Student Performance Found
              </div>
              <div className="space-y-1.5">
                {searchedStudent.map((student, idx) => (
                  <div key={idx} className="border-b border-white/10 pb-1 last:border-0">
                    <div className="text-sm font-bold text-white truncate max-w-[200px]">
                      {student.name}
                    </div>
                    <div className="text-xs text-white/80 font-medium">
                      Score: <span className="text-brand-gold font-bold text-sm">{student.totalScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selection Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Section Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Select Subject
            </label>
            <select
              value={selectedSection}
              onChange={(e) => onSectionChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 shadow-2xs bg-white text-slate-800"
            >
              <option value="">Select Subject</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                  {section.description ? ` - ${section.description}` : ""}
                </option>
              ))}
            </select>
            {sections.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">
                No sections found. Create a section first.
              </p>
            )}
          </div>

          {/* Quiz/Subject Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Select Quiz
            </label>
            <select
              value={selectedQuiz}
              onChange={(e) => onQuizChange(e.target.value)}
              disabled={!selectedSection || loadingQuizzes}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 shadow-2xs bg-white text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingQuizzes
                  ? "Loading quizzes..."
                  : !selectedSection
                    ? "Select a subject first"
                    : "Select a Quiz"}
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
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Search Questions
            </label>
            <input
              type="text"
              placeholder="Search by question text..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 shadow-2xs bg-white text-slate-800"
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            />
          </div>

          {/* NEW: Student Search */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Search Student
            </label>
            <input
              type="text"
              placeholder="Search student name..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 shadow-2xs bg-white text-slate-800"
              onChange={(e) => onStudentSearchChange && onStudentSearchChange(e.target.value)}
            />
          </div>

          {/* NEW: Cohort Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Filter by Cohort
            </label>
            <select
              value={selectedCohortFilter}
              onChange={(e) => onCohortFilterChange && onCohortFilterChange(e.target.value)}
              disabled={!selectedSection}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 shadow-2xs bg-white text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
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
  );
};