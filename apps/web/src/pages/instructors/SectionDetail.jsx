import { useNavigate } from "react-router-dom";
import { useFetchQuizzes } from "../../hooks/useFetchQuizzes.jsx";
import { useDeleteQuiz } from "../../hooks/useDeleteQuiz.jsx";
import { useCreateQuiz } from "../../hooks/useCreateQuiz.jsx";
// import * as Container from "../../components/container/containers.js";
import * as Quiz from "./quizzes/quizIndex.js";
import { CreateQuizFormButton } from "../../components/ui/buttons/CreateQuizFormButton.jsx";

export const SectionDetail = () => {
  const navigate = useNavigate();
  // const { sectionId } = useParams();
  const {
    fetchQuizzes,
    section,
    quizzes = [],
    loading,
    user,
  } = useFetchQuizzes();
  const { handleDeleteQuiz, deletingQuizId } = useDeleteQuiz(fetchQuizzes);
  const {
    quizFormData,
    showQuizForm,
    handleCreateQuiz,
    setQuizFormData,
    isSubmitting,
  } = useCreateQuiz({
    user: user || {},
  });

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
        <CreateQuizFormButton
          onCreateQuiz={handleCreateQuiz}
          setShowQuizForm={setQuizFormData}
          showQuizForm={showQuizForm}
          quizFormData={quizFormData}
          setQuizFormData={setQuizFormData}
          isSubmitting={isSubmitting}
        />
        {/* Quizzes List */}
        <Quiz.QuizzesList
          quizzes={quizzes}
          handleDelete={handleDeleteQuiz}
          deletingQuizId={deletingQuizId} // <--- Add this line
          setQuizFormData={setQuizFormData}
        />
      </div>
    </div>
  );
};
