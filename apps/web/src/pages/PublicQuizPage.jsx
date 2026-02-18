import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { StudentFormInput } from "../components/StudentForm.jsx";

export const PublicQuizPage = () => {
  const { shareToken } = useParams();
  const navigate = useNavigate();

  // State for student info
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentSection, setStudentSection] = useState("");
  const [hasStarted, setHasStarted] = useState(false);

  // State for quiz data
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State for quiz progress
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [attemptId, setAttemptId] = useState(null);

  // Load quiz by share token
  useEffect(() => {
    const loadQuiz = async () => {
      try {
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .select("*")
          .eq("share_token", shareToken)
          .eq("is_published", true)
          .single();

        if (quizError || !quizData) {
          setError("Quiz not found. Invalid or expired link.");
          setLoading(false);
          return;
        }

        setQuiz(quizData);

        // Load questions
        const { data: questionsData, error: questionsError } = await supabase
          .from("questions")
          .select("*")
          .eq("quiz_id", quizData.id)
          .order("created_at", { ascending: true });

        if (questionsError) throw questionsError;
        setQuestions(questionsData || []);
      } catch (err) {
        setError(err.message || "Failed to load quiz");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (shareToken) {
      loadQuiz();
    }
  }, [shareToken]);

  const handleStartQuiz = async (e) => {
    e.preventDefault();

    if (!studentName.trim() || !studentEmail.trim()) {
      setError("Please enter your name and email");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      // 1. Use 'let' so we can re-assign the student variable
      let { data: student, error: studentError } = await supabase
        .from("student_profile")
        .select("id")
        .eq("student_email", studentEmail)
        .maybeSingle();

      if (studentError) throw studentError;

      // 2. If student doesn't exist, create them
      if (!student) {
        const { data: newStudent, error: createError } = await supabase
          .from("student_profile")
          .insert([
            {
              student_name: studentName,
              student_email: studentEmail,
              section: studentSection,
            },
          ])
          .select()
          .single();

        if (createError) throw createError;
        student = newStudent; // This works now because of 'let'
      }

      // 3. Create quiz attempt using the valid student.id
      // Step 3: Create quiz attempt
      const { data: attempt, error: attemptError } = await supabase
        .from("quiz_attempts")
        .insert([
          {
            quiz_id: quiz.id,
            student_id: student.id, // This fulfills the 'fk_student_id' link
            student_name: studentName, // This fills the varchar column in your screenshot
            student_email: studentEmail, // This fills the varchar column in your screenshot
            status: "in_progress",
          },
        ])
        .select()
        .single();

      if (attemptError) {
        console.error("Attempt Error:", attemptError); // Log this to see if it's an RLS issue
        throw attemptError;
      }

      setAttemptId(attempt.id);
      setHasStarted(true);
    } catch (err) {
      // If you see "fk_student_name" here, delete that constraint in Supabase
      setError(err.message || "Failed to start quiz");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle answer selection
  const handleAnswerChange = (questionId, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  // Submit answer and move to next question
  const handleNextQuestion = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    const userAnswer = answers[currentQuestion.id] || "";

    try {
      setSubmitting(true);

      // Check if answer is correct
      let isCorrect = false;
      let pointsEarned = 0;

      if (currentQuestion.type === "mcq") {
        isCorrect =
          currentQuestion.options[parseInt(userAnswer)] ===
          currentQuestion.correct_answer;
        pointsEarned = isCorrect ? currentQuestion.points : 0;
      } else if (currentQuestion.type === "true_false") {
        const answerText = userAnswer === "0" ? "true" : "false";
        isCorrect = answerText === currentQuestion.correct_answer;
        pointsEarned = isCorrect ? currentQuestion.points : 0;
      } else if (currentQuestion.type === "short_answer") {
        // For short answers, mark as submitted but teacher will grade
        isCorrect = false; // Will be graded manually
        pointsEarned = 0;
      }

      // Save response
      const { error: responseError } = await supabase
        .from("quiz_responses")
        .insert([
          {
            attempt_id: attemptId,
            question_id: currentQuestion.id,
            answer: userAnswer,
            is_correct: isCorrect,
            points_earned: pointsEarned,
          },
        ]);

      if (responseError) throw responseError;

      // Move to next question or submit quiz
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        handleSubmitQuiz();
      }
    } catch (err) {
      setError(err.message || "Failed to save answer");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit quiz and calculate final score from saved responses
  const handleSubmitQuiz = async () => {
    try {
      setSubmitting(true);
      console.log("Submitting quiz for attempt:", attemptId);

      // Get total score from saved responses
      const { data: responses, error: responsesError } = await supabase
        .from("quiz_responses")
        .select("points_earned")
        .eq("attempt_id", attemptId);

      if (responsesError) {
        console.error("Error fetching responses:", responsesError);
        throw responsesError;
      }

      console.log("Responses retrieved:", responses);
      const totalScore =
        responses?.reduce((sum, r) => sum + (r.points_earned || 0), 0) || 0;

      console.log("Calculated total score:", totalScore);

      // Update attempt with completion info
      const { data: updateData, error: updateError } = await supabase
        .from("quiz_attempts")
        .update({
          score: totalScore,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", attemptId)
        .select();

      console.log("Update response:", { data: updateData, error: updateError });

      if (updateError) {
        console.error("Error updating attempt:", updateError);
        throw updateError;
      }

      setScore(totalScore);
      setCompleted(true);
    } catch (err) {
      console.error("Error in handleSubmitQuiz:", err);
      setError(err.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !hasStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Quiz Not Found
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Completed state
  if (completed) {
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const percentage = Math.round((score / totalPoints) * 100);

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md text-center">
          <div className="text-5xl mb-4">
            {percentage >= 70 ? "🎉" : percentage >= 50 ? "😊" : "📚"}
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Quiz Complete!
          </h1>
          <p className="text-gray-600 mb-6">Thank you for taking the quiz.</p>

          <div className="bg-indigo-50 p-6 rounded-lg mb-6">
            <p className="text-gray-600 text-sm mb-2">Your Score</p>
            <p className="text-4xl font-bold text-indigo-600">
              {score}/{totalPoints}
            </p>
            <p className="text-lg text-gray-700 mt-2">{percentage}%</p>
          </div>

          <p className="text-sm text-gray-500">
            Your responses have been recorded. You can now close this window.
          </p>
        </div>
      </div>
    );
  }

  // Quiz info entry state
  if (!hasStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {quiz?.title}
          </h1>
          <p className="text-gray-600 mb-6">{quiz?.description}</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* start quiz form */}
          <form onSubmit={handleStartQuiz} className="space-y-4">
            {[
              {
                label: "Full Name",
                type: "text",
                value: studentName,
                onChange: setStudentName,
              },
              {
                label: "School Email",
                type: "email",
                value: studentEmail,
                onChange: setStudentEmail,
              },
              {
                label: "Section Code",
                type: "text",
                value: studentSection,
                onChange: setStudentSection,
              },
            ].map((field, index) => (
              <StudentFormInput
                key={index}
                label={field.label}
                value={field.value}
                onChange={field.onChange}
              />
            ))}

            <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700 mb-6">
              <p>📝 This quiz has {questions.length} questions</p>
              {quiz?.duration && <p>⏱️ Time limit: {quiz.duration} minutes</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition"
            >
              {submitting ? "Starting..." : "Start Quiz"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Quiz taking state
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{quiz?.title}</h1>
          <p className="text-gray-600 mt-2">Welcome, {studentName}!</p>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            {currentQuestion?.text}
          </h2>

          {/* Question type: MCQ */}
          {currentQuestion?.type === "mcq" && (
            <div className="space-y-3 mb-6">
              {currentQuestion.options.map((option, index) => (
                <label
                  key={index}
                  className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-indigo-600 hover:bg-indigo-50 transition"
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={index}
                    checked={answers[currentQuestion.id] === String(index)}
                    onChange={() =>
                      handleAnswerChange(currentQuestion.id, String(index))
                    }
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="ml-3 text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          )}

          {/* Question type: True/False */}
          {currentQuestion?.type === "true_false" && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {["True", "False"].map((option, index) => (
                <label
                  key={index}
                  className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-indigo-600 hover:bg-indigo-50 transition"
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={index}
                    checked={answers[currentQuestion.id] === String(index)}
                    onChange={() =>
                      handleAnswerChange(currentQuestion.id, String(index))
                    }
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="ml-3 text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          )}

          {/* Question type: Short Answer */}
          {currentQuestion?.type === "short_answer" && (
            <div className="mb-6">
              <textarea
                value={answers[currentQuestion.id] || ""}
                onChange={(e) =>
                  handleAnswerChange(currentQuestion.id, e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition"
                placeholder="Type your answer here..."
                rows="4"
              />
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between gap-4">
            <button
              onClick={() =>
                setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))
              }
              disabled={currentQuestionIndex === 0 || submitting}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 rounded-lg transition disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <button
              onClick={handleNextQuestion}
              disabled={!answers[currentQuestion?.id] && submitting}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg transition"
            >
              {submitting
                ? "Saving..."
                : currentQuestionIndex === questions.length - 1
                  ? "Submit Quiz"
                  : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
