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
          .select(`
            *,
            sections (
              exam_code
            )
          `)
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
    if (!studentName || !studentEmail) {
      setError("Please provide your name and school email.");
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
        .select("id")
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
              student_name: studentName,
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
            student_name: studentName, // Update name in case it changed
            exam_code: currentExamCode 
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
            student_name: studentName,
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

  const handleNextQuestion = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    const userAnswer = answers[currentQuestion.id] || "";

    try {
      setSubmitting(true);

      let isCorrect = false;
      let pointsEarned = 0;

      if (currentQuestion.type === "mcq") {
        isCorrect = currentQuestion.options[parseInt(userAnswer)] === currentQuestion.correct_answer;
        pointsEarned = isCorrect ? currentQuestion.points : 0;
      } else if (currentQuestion.type === "true_false") {
        const answerText = userAnswer === "0" ? "true" : "false";
        isCorrect = answerText === currentQuestion.correct_answer;
        pointsEarned = isCorrect ? currentQuestion.points : 0;
      }

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

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        handleSubmitQuiz();
      }
    } catch (err) {
      setError(err.message || "Failed to save answer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitQuiz = async () => {
    try {
      setSubmitting(true);
      const { data: responses, error: responsesError } = await supabase
        .from("quiz_responses")
        .select("points_earned")
        .eq("attempt_id", attemptId);

      if (responsesError) throw responsesError;

      const totalScore = responses?.reduce((sum, r) => sum + (r.points_earned || 0), 0) || 0;

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

  // Rendering logic remains largely the same...
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  
  if (completed) {
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="text-3xl font-bold">Quiz Complete!</h1>
        <div className="mt-4 rounded-lg bg-indigo-50 p-8">
           <p className="text-5xl font-bold text-indigo-600">{score}/{totalPoints}</p>
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
            <StudentFormInput label="Full Name" value={studentName} onChange={setStudentName} />
            <StudentFormInput label="School Email" type="email" value={studentEmail} onChange={setStudentEmail} />
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="text-xl font-bold">{questions[currentQuestionIndex]?.text}</h2>
          <div className="mt-6 space-y-4">
            {/* Logic for MCQs/TF options... */}
            {questions[currentQuestionIndex]?.type === "mcq" && (
                questions[currentQuestionIndex].options.map((opt, i) => (
                    <button 
                        key={i}
                        onClick={() => handleAnswerChange(questions[currentQuestionIndex].id, String(i))}
                        className={`w-full text-left p-4 border rounded-lg ${answers[questions[currentQuestionIndex].id] === String(i) ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
                    >
                        {opt}
                    </button>
                ))
            )}
          </div>
          <div className="mt-8 flex justify-between">
            <button 
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                disabled={currentQuestionIndex === 0}
                className="px-6 py-2 bg-gray-100 rounded-lg disabled:opacity-50"
            >
                Previous
            </button>
            <button 
                onClick={handleNextQuestion}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg"
            >
                {currentQuestionIndex === questions.length - 1 ? "Submit" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};