import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { StudentFormInput } from "../components/StudentForm.jsx";

export const PublicQuizPage = () => {
  const { shareToken } = useParams();
  const navigate = useNavigate();

  // --- STATES ---
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [attemptId, setAttemptId] = useState(null);

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // --- LOAD QUIZ DATA ---
  useEffect(() => {
    const loadQuiz = async () => {
      try {
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .select(`*, sections(exam_code)`) // Gikuha ang exam_code diri
          .eq("share_token", shareToken)
          .eq("is_published", true)
          .single();

        if (quizError || !quizData) {
          setError("Quiz not found. Invalid link.");
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
      } finally {
        setLoading(false);
      }
    };
    if (shareToken) loadQuiz();
  }, [shareToken]);

  // --- START QUIZ LOGIC (FIXED EXAM_CODE) ---
  const handleStartQuiz = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!studentName || !studentEmail) {
      setError("Please provide your name and email.");
      return;
    }

    try {
      setSubmitting(true);
      const currentExamCode = quiz?.sections?.exam_code; 

      let { data: student, error: fetchError } = await supabase
        .from("student_profile")
        .select("id")
        .eq("student_email", studentEmail)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!student) {
        const { data: newStudent, error: createError } = await supabase
          .from("student_profile")
          .insert([{
            student_email: studentEmail,
            student_name: studentName,
            exam_code: currentExamCode, 
          }])
          .select().single();
        if (createError) throw createError;
        student = newStudent;
      } else {
        await supabase.from("student_profile")
          .update({ exam_code: currentExamCode })
          .eq("id", student.id);
      }

      const { data: attempt, error: attemptError } = await supabase
        .from("quiz_attempts")
        .insert([{
          quiz_id: quiz.id,
          student_id: student.id,
          student_name: studentName,
          student_email: studentEmail,
          status: "in_progress",
        }])
        .select().single();

      if (attemptError) throw attemptError;
      setAttemptId(attempt.id);
      setHasStarted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- SUBMIT ANSWER & NEXT (ANG NAWALA GANIHA) ---
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
        .insert([{
          attempt_id: attemptId,
          question_id: currentQuestion.id,
          answer: userAnswer,
          is_correct: isCorrect,
          points_earned: pointsEarned,
        }]);

      if (responseError) throw responseError;

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        handleSubmitQuiz();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- SUBMIT QUIZ ---
  const handleSubmitQuiz = async () => {
    try {
      setSubmitting(true);
      const { data: responses } = await supabase
        .from("quiz_responses")
        .select("points_earned")
        .eq("attempt_id", attemptId);

      const totalScore = responses?.reduce((sum, r) => sum + (r.points_earned || 0), 0) || 0;

      await supabase.from("quiz_attempts")
        .update({
          score: totalScore,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", attemptId);

      setScore(totalScore);
      setCompleted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- RENDER LOGIC (UI) ---
  if (loading) return <div className="p-20 text-center">Loading quiz...</div>;

  if (completed) {
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-10 rounded-xl shadow-lg text-center">
          <h1 className="text-3xl font-bold mb-4">Quiz Finished!</h1>
          <p className="text-4xl font-bold text-indigo-600">{score} / {totalPoints}</p>
          <button onClick={() => navigate("/")} className="mt-6 bg-indigo-600 text-white px-6 py-2 rounded">Go Home</button>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">{quiz?.title}</h1>
          <form onSubmit={handleStartQuiz} className="space-y-4">
            <StudentFormInput label="Full Name" value={studentName} onChange={setStudentName} />
            <StudentFormInput label="Email" value={studentEmail} onChange={setStudentEmail} />
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded font-bold hover:bg-indigo-700">
              {submitting ? "Starting..." : "Start Quiz"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-sm">
        <div className="mb-6">
          <span className="text-sm text-gray-500">Question {currentQuestionIndex + 1} of {questions.length}</span>
          <h2 className="text-xl font-bold mt-2">{currentQuestion?.text}</h2>
        </div>

        {currentQuestion?.type === "mcq" && (
          <div className="space-y-3">
            {currentQuestion.options.map((opt, i) => (
              <label key={i} className="flex items-center p-4 border rounded cursor-pointer hover:bg-gray-50">
                <input type="radio" name="ans" value={i} checked={answers[currentQuestion.id] === String(i)} onChange={() => handleAnswerChange(currentQuestion.id, String(i))} />
                <span className="ml-3">{opt}</span>
              </label>
            ))}
          </div>
        )}

        <button 
            onClick={handleNextQuestion} 
            disabled={submitting}
            className="mt-8 w-full bg-indigo-600 text-white py-3 rounded font-bold"
        >
          {submitting ? "Saving..." : currentQuestionIndex === questions.length - 1 ? "Submit Quiz" : "Next"}
        </button>
      </div>
    </div>
  );
};