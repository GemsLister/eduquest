import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { studentService } from "../services/studentService.js";
import { useGoogleLogin } from "../hooks/authHook/useGoogleLogin.jsx";
import { useSearchParams } from "react-router-dom";

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
  const [showReviewPage, setShowReviewPage] = useState(false);
  const [session, setSession] = useState(null);
  const [authenticating, setAuthenticating] = useState(false);

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // --- LOAD QUIZ DATA ---
  useEffect(() => {
    const loadQuiz = async () => {
      setError("");
      try {
        console.log("Loading quiz with share token:", shareToken);
        
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

        console.log("Quiz data result:", { quizData, quizError });

        if (quizError) {
          console.error("Quiz loading error:", quizError);
          setError("Quiz not found. Invalid link.");
          setLoading(false);
          return;
        }

        if (!quizData) {
          setError("Quiz not found. Invalid link.");
          setLoading(false);
          return;
        }

        if (quizData.is_open === false) {
          setError("This quiz is currently closed by the instructor.");
          setLoading(false);
          return;
        }

        setQuiz(quizData);

        const { data: questionsData, error: questionsError } = await supabase
          .from("questions")
          .select("*")
          .eq("quiz_id", quizData.id)
          .order("created_at", { ascending: true });

        console.log("Questions result:", { questionsData, questionsError });

        if (questionsError) throw questionsError;
        setQuestions(questionsData || []);
      } catch (err) {
        console.error("Full error loading quiz:", err);
        setError(err.message || "Failed to load quiz");
      } finally {
        setLoading(false);
      }
    };
    if (shareToken) loadQuiz();
  }, [shareToken]);

  // Auth state listener
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-start quiz after Google auth
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (session?.user && searchParams.get('auth') === 'success' && !hasStarted && quiz) {
      handleGoogleQuizStart();
    }
  }, [session, searchParams, hasStarted, quiz]);

  const { handleGoogleQuizLogin } = useGoogleLogin();

  const handleGoogleQuizLoginClick = () => {
    handleGoogleQuizLogin(shareToken);
    setAuthenticating(true);
  };

  const handleGoogleQuizStart = async () => {
    if (!session?.user) return;
    setError("");

    // Check if user already has an attempt for this quiz
    const user = session.user;
    const email = user.email;
    const studentId = email.split('@')[0];
    const studentName = user.user_metadata?.full_name || studentId;

    if (!email.endsWith('@gmail.com')) {
      setError('You are currently signed in with an instructor account. To take this quiz as a student, please switch to a @gmail.com account.');
      setAuthenticating(false);
      return;
    }

    try {
      setAuthenticating(true);
      const currentExamCode = quiz?.sections?.exam_code;

      let { data: student, error: fetchError } = await studentService.getStudentByEmail(email);
      if (fetchError && fetchError.code !== 'PGRST116') throw new Error(fetchError.message);

      if (!student) {
        const { data: newStudent, error: createError } = await studentService.createStudent({
          student_email: email,
          student_name: studentName,
          student_id: studentId,
          exam_code: currentExamCode,
        });
        if (createError) throw new Error(createError.message);
        student = newStudent;
      } else {
        // Update existing
        const { error: updateError } = await studentService.updateStudent(student.id, {
          student_id: studentId,
          student_name: studentName,
          exam_code: currentExamCode,
        });
        if (updateError) throw new Error(updateError.message);
      }

      if (!student || !student.id) {
        throw new Error("Failed to obtain student profile details.");
      }

      // Check for existing attempt
      const { data: existingAttempts, error: checkError } = await supabase
        .from("quiz_attempts")
        .select("id, status")
        .eq("quiz_id", quiz.id)
        .eq("student_id", student.id)
        .in("status", ["in_progress", "completed"]);

      if (checkError) throw new Error(checkError.message);

      if (existingAttempts && existingAttempts.length > 0) {
        // User already has an attempt, use the existing one
        const existingAttempt = existingAttempts.find(a => a.status === "in_progress") || existingAttempts[0];
        setAttemptId(existingAttempt.id);
        setHasStarted(true);
        if (existingAttempt.status === "completed") {
          setCompleted(true);
          // Load the existing score
          const { data: responses } = await supabase
            .from("quiz_responses")
            .select("points_earned")
            .eq("attempt_id", existingAttempt.id);
          const totalScore = responses?.reduce((sum, r) => sum + (r.points_earned || 0), 0) || 0;
          setScore(totalScore);
        }
        return;
      }

      // Create new attempt only if none exists
      const { data: attempt, error: attemptError } = await supabase
        .from("quiz_attempts")
        .insert([
          {
            quiz_id: quiz.id,
            student_id: student.id,
            student_name: studentName,
            student_email: email,
            status: "in_progress",
          },
        ])
        .select()
        .single();

      if (attemptError) throw new Error(attemptError.message);
      if (!attempt) throw new Error("Failed to create quiz attempt.");

      setAttemptId(attempt.id);
      setHasStarted(true);
    } catch (err) {
      setError(err.message || 'Failed to start quiz');
    } finally {
      setAuthenticating(false);
    }
  };

  // --- Manual start (deprecated but keep for fallback) ---
  const handleStartQuiz = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!studentName || !studentEmail) {
      setError("Please provide your name and email.");
      return;
    }

    if (!studentEmail.endsWith("@student.buksu.edu.ph")) {
      setError("Only @student.buksu.edu.ph email addresses are allowed.");
      return;
    }

    try {
      setSubmitting(true);
      const currentExamCode = quiz?.sections?.exam_code;

      let { data: student, error: fetchError } = await supabase
        .from("student_profile")
        .select("id, student_name")
        .eq("student_email", studentEmail)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!student) {
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
            exam_code: currentExamCode,
          })
          .eq("id", student.id);

        if (updateError) throw updateError;
      }

      // Check for existing attempt
      const { data: existingAttempts, error: checkError } = await supabase
        .from("quiz_attempts")
        .select("id, status")
        .eq("quiz_id", quiz.id)
        .eq("student_id", student.id)
        .in("status", ["in_progress", "completed"]);

      if (checkError) throw new Error(checkError.message);

      if (existingAttempts && existingAttempts.length > 0) {
        // User already has an attempt, use the existing one
        const existingAttempt = existingAttempts.find(a => a.status === "in_progress") || existingAttempts[0];
        setAttemptId(existingAttempt.id);
        setHasStarted(true);
        if (existingAttempt.status === "completed") {
          setCompleted(true);
          // Load the existing score
          const { data: responses } = await supabase
            .from("quiz_responses")
            .select("points_earned")
            .eq("attempt_id", existingAttempt.id);
          const totalScore = responses?.reduce((sum, r) => sum + (r.points_earned || 0), 0) || 0;
          setScore(totalScore);
        }
        return;
      }

      // Create new attempt only if none exists
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

      setScore(totalScore);
      setCompleted(true);
    } catch (err) {
      setError(err.message);
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
      <div className="flex h-screen items-center justify-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
        Loading...
      </div>
    );

  if (completed) {
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    
    const handleExit = async () => {
      await supabase.auth.signOut();
      window.location.href = "/";
    };

    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
        <h1 className="text-3xl font-bold">Quiz Complete!</h1>
        <div className="mt-4 rounded-lg bg-full-white p-8 shadow-xl max-w-md w-full">
          <p className="text-5xl font-bold text-hornblende-green">
            {score}/{totalPoints}
          </p>
          <p className="mt-2 text-gray-600">Your responses are recorded.</p>
          
          <div className="mt-8 border-t pt-6">
            <p className="text-xs text-gray-500 mb-4 italic">
              Note: You will be signed out when you exit to protect your account.
            </p>
            <button
              onClick={handleExit}
              className="w-full py-3 px-6 bg-casual-green text-white rounded-lg font-semibold hover:bg-hornblende-green transition-all shadow-md"
            >
              Finish & Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          {error && !quiz ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-2">Oops!</h1>
              <p className="text-gray-700 mb-6">{error}</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Retry
                </button>
                <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Switch Account
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                  <button 
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.reload();
                    }}
                    className="mt-3 text-xs font-bold text-red-600 hover:text-red-800 underline uppercase tracking-wider"
                  >
                    Logout and Switch Account
                  </button>
                </div>
              )}
              <h1 className="text-2xl font-bold">{quiz?.title || "Loading Quiz..."}</h1>
              <p className="mt-2 text-gray-600">{quiz?.description}</p>
              
              {authenticating ? (
                <div className="mt-6 flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="text-gray-600">Signing in with Google...</p>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="text-sm text-gray-600 mb-4 text-center">
                    Sign in with your institutional Google account (@student.buksu.edu.ph) to start the exam quickly.
                  </p>
                  <button
                    onClick={handleGoogleQuizLoginClick}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-white border-2 border-gray-300 py-3 px-4 font-semibold text-gray-800 hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-md"
                  >
                    <img src="/src/assets/google-icon.png" alt="Google" className="h-5 w-5" />
                    Sign in with Google
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Review page (shown after last question)
  if (showReviewPage) {
    return (
      <div className="min-h-screen bg-[url('/src/assets/bg.svg')] bg-cover bg-center p-4">
        <div className="mx-auto max-w-4xl">
          {/* Header — matches question page */}
          <div className="bg-white border-b-4 border-casual-green rounded-t-lg px-6 py-4 shadow-md">
            <h1 className="text-lg font-bold text-gray-800">{quiz?.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Review &middot; {answeredCount}/{questions.length} answered
            </p>
          </div>

          {/* Question navigation panel — mirrors question page */}
          <div className="bg-white px-6 py-4 shadow-md border-b border-gray-200">
            <div className="flex flex-wrap gap-1.5">
              {questions.map((q, i) => {
                const isAnswered =
                  answers[q.id] !== undefined && answers[q.id] !== "";
                const isUnanswered = !isAnswered;
                return (
                  <button
                    key={q.id}
                    onClick={() => goToQuestion(i)}
                    className={`w-9 h-9 rounded text-sm font-bold transition-colors
                      ${
                        isUnanswered
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-400 hover:bg-yellow-200"
                          : "bg-green-100 text-green-800 border border-green-400 hover:bg-green-200"
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
                <span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-400"></span>{" "}
                Unanswered
              </span>
            </div>
          </div>

          {/* Review body */}
          <div className="bg-white p-6 shadow-md rounded-b-lg">
            {/* Unanswered warning */}
            {unansweredQuestions.length > 0 ? (
              <div className="mb-5 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <p className="text-sm text-gray-700 mb-2">
                  You are at the end of the assessment, however not all of the
                  items have been answered. Click the numbered buttons above to
                  go back and answer them.
                </p>
              </div>
            ) : (
              <p className="text-green-700 font-semibold mb-5">
                All questions have been answered.
              </p>
            )}

            <p className="text-gray-700">
              To receive a grade for this assessment, please press the{" "}
              <strong>Grade Assessment</strong> button below.
            </p>
            <p className="text-gray-600 mt-1">
              If you want to change your answers, please do so using the{" "}
              <strong>Previous</strong> button.
            </p>

            {/* Notice */}
            <div className="mt-5 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              <p className="font-bold text-gray-800 text-sm">NOTICE</p>
              <p className="text-yellow-700 text-sm mt-1">
                Once you submit the assessment for grading, you will not be able
                to return to the assessment and edit your answers! Your
                assessment will be graded and the score will be determined for
                this assessment.
              </p>
            </div>

            {/* Action buttons */}
            <div className="mt-8 flex justify-between">
              <button
                onClick={handlePrevious}
                className="px-6 py-2.5 bg-gray-100 rounded-lg font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={handleSubmitQuiz}
                disabled={submitting}
                className="px-6 py-2.5 bg-casual-green text-white rounded-lg font-semibold hover:bg-hornblende-green transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Grade Assessment"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Question display
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.svg')] bg-cover bg-center p-4">
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
