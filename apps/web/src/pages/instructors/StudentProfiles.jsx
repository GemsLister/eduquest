import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";
import { StudentPerformanceAnalysisDebug } from "../../components/StudentPerformanceAnalysisDebug.jsx";

export const StudentProfiles = () => {
  const [sections, setSections] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState(null);

  // Fetch sections on mount
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("User not authenticated");
          setLoadingSections(false);
          return;
        }
        setUserId(user.id);

        const { data: sectionsData, error: sectionsError } = await supabase
          .from("sections")
          .select("*")
          .eq("instructor_id", user.id)
          .eq("is_archived", false)
          .order("name", { ascending: true });

        if (sectionsError) throw sectionsError;
        setSections(sectionsData || []);
      } catch (err) {
        setError(err.message || "Failed to load sections");
      } finally {
        setLoadingSections(false);
      }
    };
    fetchSections();
  }, []);

  // Fetch quizzes when section changes
  useEffect(() => {
    const fetchQuizzes = async () => {
      if (!selectedSection) {
        setQuizzes([]);
        setSelectedQuiz("");
        setStudentsData([]);
        return;
      }

      setLoadingQuizzes(true);
      try {
        const { data: quizzesData } = await supabase
          .from("quizzes")
          .select("id, title")
          .eq("section_id", selectedSection)
          .eq("is_archived", false)
          .order("title", { ascending: true });

        setQuizzes(quizzesData || []);
      } catch (err) {
        setError(err.message || "Failed to load quizzes");
      } finally {
        setLoadingQuizzes(false);
      }
    };
    fetchQuizzes();
  }, [selectedSection]);

  // Load student profiles when quiz is selected - now handled by StudentPerformanceAnalysis component

  return (
    <div className="flex-1 overflow-auto bg-authentic-white">
      {/* Header Section */}
      <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
        {/* Title Section */}
        <div className="p-6 bg-brand-navy text-white">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider">
              Student Profiles
            </h1>
            <p className="opacity-80 text-sm">
              View student strengths and weaknesses based on cognitive domain analysis
            </p>
          </div>
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
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Select a Section --</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name || section.section_name}
                  </option>
                ))}
              </select>
              {loadingSections && (
                <p className="text-sm text-gray-500 mt-1">Loading sections...</p>
              )}
            </div>

            {/* Quiz Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Quiz *
              </label>
              <select
                value={selectedQuiz}
                onChange={(e) => setSelectedQuiz(e.target.value)}
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
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Results Section */}
      <div className="px-6 pb-6">
        <StudentPerformanceAnalysisDebug 
          sectionId={selectedSection}
          quizId={selectedQuiz}
          instructorId={userId}
        />
      </div>
    </div>
  );
};
