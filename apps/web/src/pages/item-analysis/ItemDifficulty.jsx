import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export const ItemDifficulty = () => {
  const navigate = useNavigate();
  
  // State for section and quiz selection
  const [sections, setSections] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState("");
  
  // State for analysis data
  const [analysis, setAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch user and sections on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();
        
        if (authError) throw authError;
        setUser(authUser);
        
        if (authUser) {
          console.log("Fetching sections for user:", authUser.id);
          
          // Fetch instructor's sections - use correct column names
          const { data: sectionsData, error: sectionsError } = await supabase
            .from("sections")
            .select("id, name, description")
            .eq("instructor_id", authUser.id)
            .order("created_at", { ascending: false });
          
          if (sectionsError) {
            console.error("Error fetching sections:", sectionsError);
          } else {
            console.log("Sections fetched:", sectionsData);
            setSections(sectionsData || []);
          }
        }
      } catch (err) {
        console.error("Error fetching sections:", err);
      } finally {
        setLoadingSections(false);
      }
    };
    
    fetchData();
  }, []);

  // Fetch quizzes when section is selected
  useEffect(() => {
    const fetchQuizzes = async () => {
      if (!selectedSection) {
        setQuizzes([]);
        return;
      }
      
      setLoadingQuizzes(true);
      try {
        const { data: quizzesData, error: quizzesError } = await supabase
          .from("quizzes")
          .select("id, title, is_published")
          .eq("section_id", selectedSection)
          .order("created_at", { ascending: false });
        
        if (quizzesError) throw quizzesError;
        setQuizzes(quizzesData || []);
      } catch (err) {
        console.error("Error fetching quizzes:", err);
      } finally {
        setLoadingQuizzes(false);
      }
    };
    
    fetchQuizzes();
  }, [selectedSection]);

  // Fetch analysis when quiz is selected
  useEffect(() => {
    if (selectedQuiz) {
      fetchAndAnalyze(selectedQuiz);
    } else {
      setAnalysis([]);
    }
  }, [selectedQuiz]);

  const fetchAndAnalyze = async (quizId) => {
    try {
      setLoading(true);
      console.log("Fetching for Quiz ID:", quizId);

      // 1. Get Questions
      const { data: questions, error: qError } = await supabase
        .from("questions")
        .select("id, text")
        .eq("quiz_id", quizId);

      if (qError) console.error("Question Error:", qError);
      console.log("Questions found:", questions);

      if (!questions || questions.length === 0) {
        setAnalysis([]);
        return;
      }

      // 2. Get Responses
      const { data: responses, error: rError } = await supabase
        .from("quiz_responses")
        .select("question_id, is_correct")
        .in(
          "question_id",
          questions.map((q) => q.id),
        );

      if (rError) console.error("Response Error:", rError);
      console.log("Responses found:", responses);

      // 3. Calculate (CTT)
      const results = questions.map((q) => {
        const qResponses = responses
          ? responses.filter((r) => r.question_id === q.id)
          : [];
        const total = qResponses.length;
        const correct = qResponses.filter((r) => r.is_correct).length;
        const fi = total > 0 ? correct / total : 0;

        let level = "Difficult";
        if (fi >= 0.75) level = "Easy";
        else if (fi >= 0.3) level = "Moderate";

        return {
          question_id: q.id,
          text: q.text,
          difficulty: fi.toFixed(2),
          status: level,
          total: total,
        };
      });

      setAnalysis(results);
    } catch (err) {
      console.error("System Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while fetching sections
  if (loadingSections) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">Loading sections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
          <div className="p-6 bg-indigo-600 text-white">
            <h1 className="text-2xl font-bold uppercase tracking-wider">
              Item Analysis Report
            </h1>
            <p className="opacity-80 text-sm">
              Analyze question difficulty based on student responses
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
                    setSelectedSection(e.target.value);
                    setSelectedQuiz("");
                    setAnalysis([]);
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
                  onChange={(e) => setSelectedQuiz(e.target.value)}
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
                  {quizzes.map((quiz) => (
                    <option key={quiz.id} value={quiz.id}>
                      {quiz.title}
                    </option>
                  ))}
                </select>
                {selectedSection && !loadingQuizzes && quizzes.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    No published quizzes in this section.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Results */}
        {selectedQuiz && (
          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            {!loading && analysis.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-lg">
                  No analysis data available for this quiz.
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Students need to take the quiz first to generate analysis data.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="p-4 text-left">Question</th>
                    <th className="p-4 text-center">Takers</th>
                    <th className="p-4 text-center">Difficulty (FI)</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4 text-sm text-gray-700">{item.text}</td>
                      <td className="p-4 text-center font-mono">{item.total}</td>
                      <td className="p-4 text-center font-bold text-indigo-600">
                        {item.difficulty}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${
                            item.status === "Easy"
                              ? "bg-green-100 text-green-700"
                              : item.status === "Moderate"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Empty State - No Selection */}
        {!selectedQuiz && (
          <div className="bg-white shadow-lg rounded-xl overflow-hidden p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">
              Select a Section and Quiz
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Choose a section from the dropdown, then select a quiz to view its 
              item difficulty analysis based on student performance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
