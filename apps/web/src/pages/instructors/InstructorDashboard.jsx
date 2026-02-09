import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { QuizIcon } from "../../assets/svg/QuizIcon.jsx";
import { SectionManager } from "../../components/SectionManager.jsx";

export const InstructorDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [sections, setSections] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionQuizzes, setSectionQuizzes] = useState({});

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

        if (!authUser) {
          navigate("/");
          return;
        }

        // Fetch sections from database
        const { data: sectionsData, error: sectionsError } = await supabase
          .from("sections")
          .select("*")
          .eq("instructor_id", authUser.id)
          .eq("is_archived", false)
          .order("created_at", { ascending: false });

        if (sectionsError) throw sectionsError;
        setSections(sectionsData || []);

        // Fetch all quizzes for this instructor
        const { data: quizzesData, error: quizzesError } = await supabase
          .from("quizzes")
          .select("*, quiz_attempts(count)")
          .eq("instructor_id", authUser.id)
          .order("created_at", { ascending: false });

        if (quizzesError) throw quizzesError;

        // Process quizzes data
        const processedQuizzes = (quizzesData || []).map((quiz) => ({
          ...quiz,
          attempts: quiz.quiz_attempts?.[0]?.count || 0,
        }));

        setQuizzes(processedQuizzes);

        // Group quizzes by section
        const grouped = {};
        processedQuizzes.forEach((quiz) => {
          if (quiz.section_id) {
            if (!grouped[quiz.section_id]) {
              grouped[quiz.section_id] = [];
            }
            grouped[quiz.section_id].push(quiz);
          }
        });
        setSectionQuizzes(grouped);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-6 md:py-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
          Your Classes
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Manage your classes and create quizzes
        </p>
      </div>

      {/* Main Content */}
      <div className="px-4 md:px-6 py-6 md:py-8">
        {/* Create Section */}
        <div className="mb-8">
          <SectionManager
            onSectionCreated={(newSection) => {
              setSections([newSection, ...sections]);
            }}
            userId={user?.id}
          />
        </div>

        {/* Classes Grid */}
        {sections.length === 0 ? (
          <div className="bg-white rounded-lg p-8 md:p-12 text-center shadow-sm border border-gray-200">
            <div className="text-4xl md:text-6xl mb-4">📚</div>
            <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-2">
              No Classes Yet
            </h3>
            <p className="text-sm md:text-base text-gray-500">
              Create your first class to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
            {sections.map((section) => (
              <div
                key={section.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              >
                {/* Class Header */}
                <div className="h-20 md:h-24 bg-gradient-to-r from-casual-green to-hornblende-green group-hover:opacity-90 transition-opacity flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="text-2xl md:text-3xl font-bold">
                      {section.name[0]}
                    </div>
                  </div>
                </div>

                {/* Class Info */}
                <div className="p-4">
                  <h3 className="text-base md:text-lg font-bold text-gray-800 mb-1">
                    {section.name}
                  </h3>
                  <p className="text-xs md:text-sm text-gray-600 mb-3">
                    Code:{" "}
                    <span className="font-semibold">
                      {section.enrollment_code}
                    </span>
                  </p>
                  {section.description && (
                    <p className="text-xs md:text-sm text-gray-600 mb-3 line-clamp-2">
                      {section.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex gap-4 text-sm text-gray-600 mb-4 py-3 border-t border-gray-200 pt-3">
                    <div>
                      <div className="font-semibold text-gray-800">
                        {sectionQuizzes[section.id]?.length || 0}
                      </div>
                      <div className="text-xs text-gray-500">Quizzes</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() =>
                      navigate(`/instructor-dashboard/section/${section.id}`)
                    }
                    className="w-full bg-casual-green text-white py-2 rounded font-semibold text-sm md:text-base hover:bg-hornblende-green transition-colors"
                  >
                    View Class
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
