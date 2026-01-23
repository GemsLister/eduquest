import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { CreateQuizIcon } from "../../assets/svg/CreateQuizIcon.jsx";

export const InstructorDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    totalStudents: 0,
    averageScore: 0,
  });

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

        // Fetch quizzes from database
        const { data: quizzesData, error: quizzesError } = await supabase
          .from("quizzes")
          .select("*, quiz_attempts(count)")
          .eq("instructor_id", authUser.id)
          .order("created_at", { ascending: false });

        if (quizzesError) throw quizzesError;

        // Fetch stats from database
        const { data: statsData, error: statsError } = await supabase
          .from("quizzes")
          .select("id")
          .eq("instructor_id", authUser.id);

        if (statsError) throw statsError;

        // Fetch unique students count
        const { data: studentsData, error: studentsError } = await supabase
          .from("quiz_attempts")
          .select("user_id", { count: "exact" })
          .in("quiz_id", statsData?.map((q) => q.id) || []);

        if (studentsError) throw studentsError;

        // Fetch average score
        const { data: scoresData, error: scoresError } = await supabase
          .from("quiz_attempts")
          .select("score")
          .in("quiz_id", statsData?.map((q) => q.id) || []);

        if (scoresError) throw scoresError;

        // Process quizzes data
        const processedQuizzes = (quizzesData || []).map((quiz) => ({
          ...quiz,
          attempts: quiz.quiz_attempts?.[0]?.count || 0,
        }));

        // Calculate unique students
        const uniqueStudents = new Set(
          scoresData?.map((attempt) => attempt.user_id) || [],
        ).size;

        // Calculate average score
        const averageScore =
          scoresData && scoresData.length > 0
            ? Math.round(
                scoresData.reduce(
                  (sum, attempt) => sum + (attempt.score || 0),
                  0,
                ) / scoresData.length,
              )
            : 0;

        setQuizzes(processedQuizzes);
        setStats({
          totalQuizzes: statsData?.length || 0,
          totalStudents: uniqueStudents,
          averageScore: averageScore,
        });
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
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-casual-green to-hornblende-green text-white p-8 rounded-lg m-6 mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome Back!</h1>
        <p className="text-lg opacity-90">{user?.email || "Instructor"}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 mb-8">
        <div className="bg-white border-l-4 border-casual-green rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600 text-sm font-semibold mb-2">
                Total Quizzes
              </p>
              <p className="text-4xl font-bold text-hornblende-green">
                {stats.totalQuizzes}
              </p>
            </div>
            <div className="text-4xl text-casual-green opacity-20">📝</div>
          </div>
        </div>

        <div className="bg-white border-l-4 border-hornblende-green rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600 text-sm font-semibold mb-2">
                Total Students
              </p>
              <p className="text-4xl font-bold text-hornblende-green">
                {stats.totalStudents}
              </p>
            </div>
            <div className="text-4xl text-hornblende-green opacity-20">👥</div>
          </div>
        </div>

        <div className="bg-white border-l-4 border-casual-green rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-600 text-sm font-semibold mb-2">
                Avg Score
              </p>
              <p className="text-4xl font-bold text-hornblende-green">
                {stats.averageScore}%
              </p>
            </div>
            <div className="text-4xl text-casual-green opacity-20">📊</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 mb-8">
        <button
          onClick={() => navigate("/instructor-quiz")}
          className="flex items-center gap-3 bg-casual-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-hornblende-green transition-colors shadow-md hover:shadow-lg"
        >
          <CreateQuizIcon />
          Create New Quiz
        </button>
      </div>

      {/* Quizzes Section */}
      <div className="px-6 pb-8">
        <h2 className="text-2xl font-bold text-hornblende-green mb-4">
          Your Quizzes
        </h2>

        {quizzes.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-md">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Quizzes Yet
            </h3>
            <p className="text-gray-500 mb-4">
              Create your first quiz to get started!
            </p>
            <button
              onClick={() => navigate("/instructor-quiz")}
              className="bg-casual-green text-white px-6 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
            >
              Create Quiz
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden cursor-pointer group"
              >
                <div className="h-32 bg-gradient-to-r from-casual-green to-hornblende-green group-hover:opacity-90 transition-opacity"></div>
                <div className="p-4">
                  <h3 className="font-bold text-lg text-hornblende-green mb-2 truncate">
                    {quiz.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {quiz.description}
                  </p>
                  <div className="flex justify-between text-sm text-gray-500 mb-4">
                    <span>{quiz.questions_count || 0} Questions</span>
                    <span>{quiz.attempts || 0} Attempts</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 bg-casual-green text-white py-2 rounded text-sm font-semibold hover:bg-hornblende-green transition-colors">
                      Edit
                    </button>
                    <button className="flex-1 bg-gray-200 text-gray-700 py-2 rounded text-sm font-semibold hover:bg-gray-300 transition-colors">
                      Results
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
