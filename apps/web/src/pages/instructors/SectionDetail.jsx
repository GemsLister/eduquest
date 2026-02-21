import { useState, useEffect, startTransition } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";
import { useFetchQuizzes } from "../../hooks/useFetchQuizzes.jsx";
import { useDeleteQuiz } from "../../hooks/useDeleteQuiz.jsx";
import { useCreateQuiz } from "../../hooks/useCreateQuiz.jsx";
// import * as Container from "../../components/container/containers.js";
import * as Quiz from "./quizzes/quizIndex.js";

export const SectionDetail = () => {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const {
    fetchQuizzes,
    section,
    quizzes = [],
    loading,
    user,
  } = useFetchQuizzes();
  const { handleDeleteQuiz, deletingQuizId } = useDeleteQuiz(fetchQuizzes);
  const {
    handleCreateQuiz,
    quizFormData,
    showQuizForm,
    setShowQuizForm,
    setQuizFormData,
  } = useCreateQuiz(sectionId, user);
  // const [section, setSection] = useState(null);
  // const [quizzes, setQuizzes] = useState([]);
  // const [loading, setLoading] = useState(true);
  // const [user, setUser] = useState(null);
  // const [showQuizForm, setShowQuizForm] = useState(false);
  // const [deletingQuizId, setDeletingQuizId] = useState(null);
  // const [quizFormData, setQuizFormData] = useState({
  //   title: "",
  //   description: "",
  // });

  // const fetchQuizzes = async () => {
  //   try {
  //     // Fetch quizzes for this section
  //     const { data: quizzesData, error: quizzesError } = await supabase
  //       .from("quizzes")
  //       .select("*, quiz_attempts(count)")
  //       .eq("section_id", sectionId)
  //       .order("created_at", { ascending: false });

  //     if (quizzesError) throw quizzesError;

  //     // Fetch question counts for each quiz
  //     const quizzesWithCounts = await Promise.all(
  //       (quizzesData || []).map(async (quiz) => {
  //         const { count, error: countError } = await supabase
  //           .from("questions")
  //           .select("*", { count: "exact", head: true })
  //           .eq("quiz_id", quiz.id);

  //         return {
  //           ...quiz,
  //           attempts: quiz.quiz_attempts?.[0]?.count || 0,
  //           questions_count: !countError ? count : 0,
  //         };
  //       }),
  //     );

  //     setQuizzes(quizzesWithCounts);
  //   } catch (error) {
  //     console.error("Error fetching quizzes:", error);
  //   }
  // };

  // useEffect(() => {
  //   const fetchData = async () => {
  //     try {
  //       // Get current user
  //       const {
  //         data: { user: authUser },
  //         error: authError,
  //       } = await supabase.auth.getUser();
  //       if (authError) throw authError;
  //       setUser(authUser);

  //       // Fetch section
  //       const { data: sectionData, error: sectionError } = await supabase
  //         .from("sections")
  //         .select("*")
  //         .eq("id", sectionId)
  //         .single();

  //       if (sectionError) throw sectionError;
  //       setSection(sectionData);

  //       // Fetch quizzes
  //       await fetchQuizzes();
  //     } catch (error) {
  //       console.error("Error fetching section data:", error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchData();
  // }, [sectionId]);

  // const handleDeleteQuiz = async (quizId, quizTitle) => {
  //   if (
  //     !window.confirm(
  //       `Are you sure you want to delete "${quizTitle}"? This action cannot be undone.`,
  //     )
  //   ) {
  //     return;
  //   }

  //   setDeletingQuizId(quizId);
  //   console.log("Starting delete for quiz:", quizId, quizTitle);

  //   try {
  //     // Delete all questions associated with the quiz first
  //     console.log("Deleting questions for quiz:", quizId);
  //     const { error: questionsError } = await supabase
  //       .from("questions")
  //       .delete()
  //       .eq("quiz_id", quizId);

  //     console.log("Questions delete response - error:", questionsError);

  //     if (questionsError) {
  //       console.error("Questions delete error:", questionsError);
  //       throw new Error(
  //         `Failed to delete questions: ${questionsError.message}`,
  //       );
  //     }

  //     // Delete the quiz
  //     console.log("Deleting quiz:", quizId);
  //     const { error: quizError } = await supabase
  //       .from("quizzes")
  //       .delete()
  //       .eq("id", quizId);

  //     console.log("Quiz delete response - error:", quizError);

  //     if (quizError) {
  //       console.error("Quiz delete error:", quizError);
  //       throw new Error(`Failed to delete quiz: ${quizError.message}`);
  //     }

  //     // Wait a moment for the database to sync, then refresh
  //     console.log("Waiting for DB sync...");
  //     await new Promise((resolve) => setTimeout(resolve, 1500));

  //     // Refresh the quizzes list
  //     console.log("Refreshing quizzes list...");
  //     await fetchQuizzes();

  //     console.log("Quiz deleted successfully!");
  //     alert("✓ Quiz deleted successfully!");
  //   } catch (error) {
  //     console.error("Full error object:", error);
  //     alert("❌ Error deleting quiz:\n" + error.message);
  //   } finally {
  //     setDeletingQuizId(null);
  //   }
  // };

  // const handleCreateQuiz = async (e) => {
  //   e.preventDefault();
  //   try {
  //     if (!quizFormData.title.trim()) {
  //       alert("Quiz title is required");
  //       return;
  //     }

  //     const { data, error } = await supabase
  //       .from("quizzes")
  //       .insert([
  //         {
  //           instructor_id: user.id,
  //           section_id: sectionId,
  //           title: quizFormData.title.trim(),
  //           description: quizFormData.description.trim() || null,
  //           is_published: false,
  //         },
  //       ])
  //       .select();

  //     if (error) throw error;

  //     // Reset form
  //     setQuizFormData({ title: "", description: "" });
  //     setShowQuizForm(false);

  //     // Navigate to quiz editor to add questions
  //     navigate(`/instructor-dashboard/instructor-quiz/${data[0].id}`);
  //   } catch (error) {
  //     alert("Error creating quiz: " + error.message);
  //     console.error("Error creating quiz:", error);
  //   }
  // };

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

  if (!section) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Section not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-8">
        <button
          onClick={() => navigate("/instructor-dashboard")}
          className="text-casual-green font-semibold mb-4 hover:underline"
        >
          ← Back to Sections
        </button>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          {section.name}
        </h1>
        <p className="text-gray-600">
          Subject: {section.description || "No description provided"}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Exam Code: <span className="font-semibold">{section.exam_code}</span>
        </p>
      </div>

      {/* Main Content */}
      <div>
        {/* Create Quiz Button */}
        {!showQuizForm ? (
          <div className="mb-8">
            <button
              onClick={() => setShowQuizForm((prev) => !prev)}
              className="flex items-center gap-2 bg-casual-green text-white px-4 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors shadow-md"
            >
              <span className="text-lg">+</span>
              Create Quiz
            </button>
          </div>
        ) : (
          <div className="absolute bg-white rounded-lg p-6 shadow-md border border-casual-green mb-8">
            <h3 className="text-xl font-bold text-hornblende-green mb-4">
              Create New Quiz
            </h3>
            <form onSubmit={handleCreateQuiz} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quiz Title *
                </label>
                <input
                  type="text"
                  value={quizFormData.title}
                  onChange={(e) =>
                    setQuizFormData({ ...quizFormData, title: e.target.value })
                  }
                  placeholder="e.g., Chapter 5 Quiz"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-casual-green"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={quizFormData.description}
                  onChange={(e) =>
                    setQuizFormData({
                      ...quizFormData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Optional quiz description"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-casual-green"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuizForm(false);
                    setQuizFormData({ title: "", description: "" });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-casual-green text-white rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
                >
                  Create Quiz
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Quizzes List */}
        <Quiz.QuizzesList
          quizzes={quizzes}
          handleDelete={handleDeleteQuiz}
          setQuizFormData={setQuizFormData}
        />
        {/* <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Quizzes</h2>

          {quizzes.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No Quizzes Yet
              </h3>
              <p className="text-gray-500">
                Create your first quiz for this class!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden cursor-pointer group"
                >
                  <div
                    className={`h-32 bg-gradient-to-r group-hover:opacity-90 transition-opacity flex items-center justify-center relative ${
                      quiz.is_published
                        ? "from-casual-green to-hornblende-green"
                        : "from-yellow-400 to-yellow-500"
                    }`}
                  >
                    <div
                      className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold text-white ${
                        quiz.is_published ? "bg-green-600" : "bg-yellow-600"
                      }`}
                    >
                      {quiz.is_published ? "Published" : "Draft"}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-gray-800 mb-2 truncate">
                      {quiz.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {quiz.description || "No description"}
                    </p>
                    <div className="flex justify-between text-sm text-gray-500 mb-4">
                      <span>{quiz.questions_count || 0} Questions</span>
                      <span>{quiz.attempts || 0} Attempts</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          navigate(
                            `/instructor-dashboard/instructor-quiz/${quiz.id}`,
                          )
                        }
                        className="flex-1 bg-casual-green text-white py-2 rounded text-sm font-semibold hover:bg-hornblende-green transition-colors"
                      >
                        {quiz.is_published ? "Edit" : "Continue"}
                      </button>
                      {quiz.is_published && (
                        <button
                          onClick={() =>
                            navigate(
                              `/instructor-dashboard/quiz-results/${quiz.id}`,
                            )
                          }
                          className="flex-1 bg-gray-200 text-gray-700 py-2 rounded text-sm font-semibold hover:bg-gray-300 transition-colors"
                        >
                          Results
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          await handleDeleteQuiz(quiz.id, quiz.title);
                        }}
                        disabled={deletingQuizId === quiz.id}
                        className={`${
                          deletingQuizId === quiz.id
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-red-100 text-red-600 hover:bg-red-200"
                        } px-3 py-2 rounded text-sm font-semibold transition-colors`}
                        title="Delete quiz"
                      >
                        {deletingQuizId === quiz.id ? "..." : "🗑️"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div> */}
      </div>
    </div>
  );
};
