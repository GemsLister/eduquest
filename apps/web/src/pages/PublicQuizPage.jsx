import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { StudentFormInput } from "../components/StudentForm.jsx";

export const PublicQuizPage = () => {
  const { shareToken } = useParams();
  const navigate = useNavigate();

  // State for student info
  const [studentEmail, setStudentEmail] = useState("");
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
  const [showReviewPage, setShowReviewPage] = useState(false);

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  // 1. Load quiz and JOIN with sections to get the exam_code
  useEffect(() => {
    const loadQuiz = async () => {
      try {
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .select(
            `
            *,
            sections (
              exam_code
            )
          `,
          )
          .eq("share_token", shareToken)
          .eq("is_published", true)
          .single();

        if (quizError || !quizData) {
          setError("Quiz not found. Invalid or expired link.");
          setLoading(false);
          return;
        }

        setQuiz(quizData);

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

  // 2. Start Quiz: Link student to the Section's Exam Code
  const handleStartQuiz = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!studentEmail) {
      setError("Please provide your school email.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      // Get exam_code from the joined section data
      const currentExamCode = quiz.sections?.exam_code;

      // Check if student already exists
      let { data: student, error: fetchError } = await supabase
        .from("student_profile")
        .select("id, student_name")
        .eq("student_email", studentEmail)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!student) {
        // Create new student WITH the exam code
        const { data: newStudent, error: createError } = await supabase
          .from("student_profile")
          .insert([
            {
              student_email: studentEmail,
              exam_code: currentExamCode,
            },
          ])
          .select()
          .single();

        if (createError) throw createError;
        student = newStudent;
      } else {
        // Update existing student's exam_code to match THIS quiz's section
        const { error: updateError } = await supabase
          .from("student_profile")
          .update({
            exam_code: currentExamCode,
          })
          .eq("id", student.id);

        if (updateError) throw updateError;
      }

      // Create the quiz attempt
      const { data: attempt, error: attemptError } = await supabase
        .from("quiz_attempts")
        .insert([
          {
            quiz_id: quiz.id,
            student_id: student.id,
            student_email: studentEmail,
            status: "in_progress",
          },
        ])
        .select()
        .single();

      if (attemptError) throw attemptError;

      setAttemptId(attempt.id);
      setHasStarted(true);
    } catch (err) {
      setError(err.message);
      console.error("Database Error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Navigate between questions freely
  const goToQuestion = (index) => {
    setShowReviewPage(false);
    setCurrentQuestionIndex(index);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Last question → show review page
      setShowReviewPage(true);
    }
  };

  const handlePrevious = () => {
    if (showReviewPage) {
      setShowReviewPage(false);
    } else if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Submit all answers at once
  const handleSubmitQuiz = async () => {
    try {
      setSubmitting(true);

      // Build all responses
      const responses = questions.map((q) => {
        const userAnswer = answers[q.id] || "";
        let isCorrect = false;
        let pointsEarned = 0;

        if (q.type === "mcq") {
          isCorrect = q.options[parseInt(userAnswer)] === q.correct_answer;
          pointsEarned = isCorrect ? q.points : 0;
        } else if (q.type === "true_false") {
          const answerText = userAnswer === "0" ? "true" : "false";
          isCorrect = answerText === q.correct_answer;
          pointsEarned = isCorrect ? q.points : 0;
        }

        return {
          attempt_id: attemptId,
          question_id: q.id,
          answer: userAnswer,
          is_correct: isCorrect,
          points_earned: pointsEarned,
        };
      });

      // Insert all responses
      const { error: responseError } = await supabase
        .from("quiz_responses")
        .insert(responses);

      if (responseError) throw responseError;

      // Calculate total score
      const totalScore = responses.reduce(
        (sum, r) => sum + (r.points_earned || 0),
        0,
      );

      // Update attempt
      const { error: updateError } = await supabase
        .from("quiz_attempts")
        .update({
          score: totalScore,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", attemptId);

      if (updateError) throw updateError;

      setScore(totalScore);
      setCompleted(true);
    } catch (err) {
      setError(err.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper: count answered questions
  const answeredCount = questions.filter(
    (q) => answers[q.id] !== undefined && answers[q.id] !== "",
  ).length;
  const unansweredQuestions = questions
    .map((q, i) => ({ index: i, id: q.id }))
    .filter((item) => !answers[item.id] || answers[item.id] === "");

  // --- RENDERING ---
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );

  if (completed) {
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="text-3xl font-bold">Quiz Complete!</h1>
        <div className="mt-4 rounded-lg bg-indigo-50 p-8">
          <p className="text-5xl font-bold text-indigo-600">
            {score}/{totalPoints}
          </p>
          <p className="mt-2 text-gray-600">Your responses are recorded.</p>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold">{quiz?.title}</h1>
          <p className="mt-2 text-gray-600">{quiz?.description}</p>
          {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}
          <form onSubmit={handleStartQuiz} className="mt-6 space-y-4">
            <StudentFormInput
              label="School Email"
              type="email"
              value={studentEmail}
              onChange={setStudentEmail}
            />
            <button
              disabled={submitting}
              className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {submitting ? "Starting..." : "Start Quiz"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Review page (shown after last question)
  if (showReviewPage) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="bg-white border-b-4 border-casual-green rounded-t-lg p-6 shadow-md">
            <h1 className="text-xl font-bold text-gray-800">{quiz?.title}</h1>
          </div>

          {/* Unanswered notice */}
          <div className="bg-white p-6 shadow-md border-b border-gray-200">
            {unansweredQuestions.length > 0 ? (
              <>
                <p className="text-gray-700 mb-3">
                  You are at the end of the assessment, however not all of the
                  items have been answered. Below you will find the item numbers
                  for which an answer was not submitted:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unansweredQuestions.map((item) => (
                    <button
                      key={item.index}
                      onClick={() => goToQuestion(item.index)}
                      className="w-8 h-8 rounded bg-yellow-100 border border-yellow-400 text-yellow-800 text-sm font-bold hover:bg-yellow-200 transition-colors"
                    >
                      {item.index + 1}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-green-700 font-semibold">
                All questions have been answered.
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-white p-6 shadow-md border-b border-gray-200">
            <p className="text-gray-700">
              To receive a grade for this assessment, please press the{" "}
              <strong>Grade Assessment</strong> button below.
            </p>
            <p className="text-gray-600 mt-1">
              If you want to change your answers, please do so using the{" "}
              <strong>Previous</strong> button.
            </p>
          </div>

          {/* Notice */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 shadow-md">
            <p className="font-bold text-gray-800">NOTICE</p>
            <p className="text-yellow-700 text-sm mt-1">
              Once you submit the assessment for grading, you will not be able
              to return to the assessment and edit your answers! Your assessment
              will be graded and the score will be determined for this
              assessment.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={handlePrevious}
              className="px-8 py-3 bg-white border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={handleSubmitQuiz}
              disabled={submitting}
              className="px-8 py-3 bg-casual-green text-white rounded-lg font-semibold hover:bg-hornblende-green transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Grade Assessment"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Question display
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl">
        {/* Quiz header */}
        <div className="bg-white border-b-4 border-casual-green rounded-t-lg px-6 py-4 shadow-md mb-0">
          <h1 className="text-lg font-bold text-gray-800">{quiz?.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Question {currentQuestionIndex + 1} of {questions.length} &middot;{" "}
            {answeredCount}/{questions.length} answered
          </p>
        </div>

        {/* Question navigation panel */}
        <div className="bg-white px-6 py-4 shadow-md border-b border-gray-200">
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q, i) => {
              const isAnswered =
                answers[q.id] !== undefined && answers[q.id] !== "";
              const isCurrent = i === currentQuestionIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(i)}
                  className={`w-9 h-9 rounded text-sm font-bold transition-colors
                    ${
                      isCurrent
                        ? "bg-casual-green text-white ring-2 ring-hornblende-green"
                        : isAnswered
                          ? "bg-green-100 text-green-800 border border-green-400 hover:bg-green-200"
                          : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                    }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-400"></span>{" "}
              Answered
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-300"></span>{" "}
              Unanswered
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-casual-green"></span>{" "}
              Current
            </span>
          </div>
        </div>

        {/* Question content */}
        <div className="bg-white p-6 shadow-md rounded-b-lg">
          <h2 className="text-lg font-bold text-gray-800 mb-6">
            {currentQuestionIndex + 1}. {currentQuestion?.text}
          </h2>

          <div className="space-y-3 ml-4">
            {/* MCQ Options */}
            {currentQuestion?.type === "mcq" &&
              currentQuestion.options.map((opt, i) => {
                const letter = String.fromCharCode(97 + i); // a, b, c, d...
                const isSelected = answers[currentQuestion.id] === String(i);
                return (
                  <button
                    key={i}
                    onClick={() =>
                      handleAnswerChange(currentQuestion.id, String(i))
                    }
                    className={`w-full text-left p-4 border-2 rounded-lg flex items-center gap-3 transition-colors
                      ${
                        isSelected
                          ? "border-casual-green bg-green-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                  >
                    <span
                      className={`font-bold text-sm ${isSelected ? "text-casual-green" : "text-gray-500"}`}
                    >
                      ({letter})
                    </span>
                    <span
                      className={`${isSelected ? "text-gray-900 font-semibold" : "text-gray-700"}`}
                    >
                      {opt}
                    </span>
                  </button>
                );
              })}

            {/* True/False Options */}
            {currentQuestion?.type === "true_false" && (
              <>
                {["True", "False"].map((opt, i) => {
                  const letter = String.fromCharCode(97 + i);
                  const isSelected = answers[currentQuestion.id] === String(i);
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        handleAnswerChange(currentQuestion.id, String(i))
                      }
                      className={`w-full text-left p-4 border-2 rounded-lg flex items-center gap-3 transition-colors
                        ${
                          isSelected
                            ? "border-casual-green bg-green-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      <span
                        className={`font-bold text-sm ${isSelected ? "text-casual-green" : "text-gray-500"}`}
                      >
                        ({letter})
                      </span>
                      <span
                        className={`${isSelected ? "text-gray-900 font-semibold" : "text-gray-700"}`}
                      >
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="mt-8 flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-2.5 bg-gray-100 rounded-lg font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2.5 bg-casual-green text-white rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
            >
              {currentQuestionIndex === questions.length - 1
                ? "Review & Submit"
                : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
