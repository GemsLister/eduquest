import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { studentService } from "../services/studentService.js";
import { quizService } from "../services/quizService.js";
import { useGoogleLogin } from "../hooks/authHook/useGoogleLogin.jsx";
import { useSearchParams } from "react-router-dom";

export const PublicQuizPage = () => {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedSectionId = searchParams.get("section");

  const cleanTitle = (title) =>
    title?.replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "") || "";

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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasExited, setHasExited] = useState(false);
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const timerRef = useRef(null);
  const autoSubmitRef = useRef(false);

  // Quiz duration in seconds (null if unlimited)
  const quizDurationSeconds = quiz?.duration ? quiz.duration * 60 : null;

  // --- TIMER (elapsed + countdown) ---
  useEffect(() => {
    if (hasStarted && !completed) {
      // Initialize countdown only if not already set by restoreAttemptState
      if (quizDurationSeconds && remainingSeconds === null) {
        setRemainingSeconds(quizDurationSeconds);
      }

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);

        if (quizDurationSeconds) {
          setRemainingSeconds((prev) => {
            if (prev === null) return quizDurationSeconds - 1;
            const next = prev - 1;
            if (next <= 0) {
              setTimeExpired(true);
              clearInterval(timerRef.current);
              return 0;
            }
            return next;
          });
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [hasStarted, completed, quizDurationSeconds]);

  const formatTime = (totalSeconds) => {
    if (totalSeconds < 0) totalSeconds = 0;
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Low time warning (last 5 minutes)
  const isLowTime = remainingSeconds !== null && remainingSeconds <= 300 && remainingSeconds > 0;


  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    // Auto-save answer via server-side grading (fire and forget)
    if (attemptId) {
      supabase.rpc("save_quiz_response", {
        p_attempt_id: attemptId,
        p_question_id: questionId,
        p_answer: value,
      }).then(() => {});
    }
  };

  // Shuffle questions and save order to the attempt record
  const shuffleAndSaveOrder = async (questionsArr, newAttemptId) => {
    const shuffled = [...questionsArr].sort(() => Math.random() - 0.5);
    const order = shuffled.map((q) => q.id);
    setQuestions(shuffled);
    await supabase
      .from("quiz_attempts")
      .update({ question_order: order })
      .eq("id", newAttemptId);
  };

  // Restore question order from a saved attempt, and load saved answers
  const restoreAttemptState = async (existingAttemptId, questionsArr) => {
    // Load saved question order
    const { data: attemptData } = await supabase
      .from("quiz_attempts")
      .select("question_order, started_at")
      .eq("id", existingAttemptId)
      .single();

    if (attemptData?.question_order) {
      const orderIds = attemptData.question_order;
      const ordered = orderIds
        .map((id) => questionsArr.find((q) => q.id === id))
        .filter(Boolean);
      // Append any questions not in the saved order (edge case)
      const remaining = questionsArr.filter((q) => !orderIds.includes(q.id));
      setQuestions([...ordered, ...remaining]);
    } else {
      // No saved order — shuffle and save now
      await shuffleAndSaveOrder(questionsArr, existingAttemptId);
    }

    // Load saved answers
    const { data: savedResponses } = await quizService.getResponsesDetailsByAttempt(existingAttemptId);
    if (savedResponses && savedResponses.length > 0) {
      const restoredAnswers = {};
      savedResponses.forEach((r) => {
        restoredAnswers[r.question_id] = r.answer;
      });
      setAnswers(restoredAnswers);
    }

    // Restore timer from started_at
    if (attemptData?.started_at) {
      const startedAt = new Date(attemptData.started_at).getTime();
      const now = Date.now();
      const elapsedSec = Math.floor((now - startedAt) / 1000);
      setElapsedSeconds(elapsedSec);
      if (quizDurationSeconds) {
        const remaining = quizDurationSeconds - elapsedSec;
        if (remaining <= 0) {
          setTimeExpired(true);
          setRemainingSeconds(0);
        } else {
          setRemainingSeconds(remaining);
        }
      }
    }
  };

  const isQuizAssignedToSection = async (quizId, sectionId) => {
    if (!sectionId) return true;

    const { data: mappedSections, error: mappedError } = await supabase
      .from("quiz_sections")
      .select("section_id")
      .eq("quiz_id", quizId)
      .eq("section_id", sectionId);

    if (!mappedError && mappedSections && mappedSections.length > 0) {
      return true;
    }

    const { data: quizRow, error: quizRowError } = await supabase
      .from("quizzes")
      .select("section_id")
      .eq("id", quizId)
      .single();

    if (quizRowError) return false;
    return quizRow?.section_id === sectionId;
  };

  const resolveExamCode = async () => {
    if (!requestedSectionId) return quiz?.sections?.exam_code;

    const { data: sectionRow } = await supabase
      .from("sections")
      .select("exam_code")
      .eq("id", requestedSectionId)
      .maybeSingle();

    return sectionRow?.exam_code || quiz?.sections?.exam_code;
  };

  // --- LOAD QUIZ DATA ---
  useEffect(() => {
    const loadQuiz = async () => {
      setError("");
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

        const assignedToRequestedSection = await isQuizAssignedToSection(
          quizData.id,
          requestedSectionId,
        );
        if (!assignedToRequestedSection) {
          setError("This quiz link is not valid for this section.");
          setLoading(false);
          return;
        }

        // Fetch section name for display
        if (requestedSectionId) {
          const { data: sectionData } = await supabase
            .from("sections")
            .select("*")
            .eq("id", requestedSectionId)
            .maybeSingle();
          if (sectionData) setSectionName(sectionData.section_name || sectionData.name || "");
        }

        if (quizData.is_open === false) {
          setError("This quiz is currently closed by the instructor.");
          setLoading(false);
          return;
        }

        setQuiz(quizData);

        const { data: questionsData, error: questionsError } = await supabase
          .from("questions")
          .select("id, quiz_id, type, text, options, points, created_at")
          .eq("quiz_id", quizData.id)
          .order("created_at", { ascending: true });

        if (questionsError) throw questionsError;
        // Store questions in original order; shuffling happens when starting/resuming
        setQuestions(questionsData || []);
      } catch (err) {
        console.error("Full error loading quiz:", err);
        setError(err.message || "Failed to load quiz");
      } finally {
        setLoading(false);
      }
    };
    if (shareToken) loadQuiz();
  }, [shareToken, requestedSectionId]);

  // Auth state listener
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-start quiz after Google auth (wait for both quiz AND questions to be loaded)
  const googleStartRef = useRef(false);
  useEffect(() => {
    if (
      session?.user &&
      searchParams.get("auth") === "success" &&
      !hasStarted &&
      quiz &&
      questions.length > 0 &&
      !googleStartRef.current
    ) {
      googleStartRef.current = true;
      handleGoogleQuizStart();
    }
  }, [session, searchParams, hasStarted, quiz, questions]);

  const { handleGoogleQuizLogin } = useGoogleLogin();

  const handleGoogleQuizLoginClick = () => {
    handleGoogleQuizLogin(shareToken, requestedSectionId);
    setAuthenticating(true);
  };

  const handleGoogleQuizStart = async () => {
    if (!session?.user) return;
    setError("");

    // Check if user already has an attempt for this quiz
    const user = session.user;
    const email = user.email;
    const studentId = email.split("@")[0];
    const studentName = user.user_metadata?.full_name || studentId;

    if (!email.endsWith('@gmail.com')) {
      setError('You are currently signed in with an instructor account. To take this quiz as a student, please switch to a @gmail.com account.');
      await supabase.auth.signOut();
      setSession(null);
      setAuthenticating(false);
      return;
    }

    try {
      setAuthenticating(true);
      const currentExamCode = await resolveExamCode();

      let { data: student, error: fetchError } =
        await studentService.getStudentByEmail(email);
      if (fetchError && fetchError.code !== "PGRST116")
        throw new Error(fetchError.message);

      if (!student) {
        const { data: newStudent, error: createError } =
          await studentService.createStudent({
            student_email: email,
            student_name: studentName,
            student_id: studentId,
            exam_code: currentExamCode,
          });
        if (createError) throw new Error(createError.message);
        student = newStudent;
      } else {
        // Update existing
        const { error: updateError } = await studentService.updateStudent(
          student.id,
          {
            student_id: studentId,
            student_name: studentName,
            exam_code: currentExamCode,
          },
        );
        if (updateError) throw new Error(updateError.message);
      }

      if (!student || !student.id) {
        throw new Error("Failed to obtain student profile details.");
      }

      // Check for existing attempt
      let attemptsQuery = supabase
        .from("quiz_attempts")
        .select("id, status")
        .eq("quiz_id", quiz.id)
        .eq("user_id", session.user.id)
        .in("status", ["in_progress", "completed"]);

      attemptsQuery = requestedSectionId
        ? attemptsQuery.eq("section_id", requestedSectionId)
        : attemptsQuery.is("section_id", null);

      const { data: existingAttempts, error: checkError } = await attemptsQuery;

      if (checkError) throw new Error(checkError.message);

      if (existingAttempts && existingAttempts.length > 0) {
        const completedAttempt = existingAttempts.find((a) => a.status === "completed");
        if (completedAttempt) {
          setAlreadyTaken(true);
          setAuthenticating(false);
          return;
        }
        // Resume in-progress attempt
        const inProgressAttempt = existingAttempts.find((a) => a.status === "in_progress");
        if (inProgressAttempt) {
          setAttemptId(inProgressAttempt.id);
          await restoreAttemptState(inProgressAttempt.id, questions);
          setHasStarted(true);
          return;
        }
      }

      // Create new attempt only if none exists
      const { data: attempt, error: attemptError } = await supabase
        .from("quiz_attempts")
        .insert([
          {
            quiz_id: quiz.id,
            section_id: requestedSectionId || null,
            user_id: session.user.id,
            student_name: studentName,
            student_email: email,
            status: "in_progress",
            user_id: user.id,
          },
        ])
        .select()
        .single();

      if (attemptError) throw new Error(attemptError.message);
      if (!attempt) throw new Error("Failed to create quiz attempt.");

      setAttemptId(attempt.id);
      await shuffleAndSaveOrder(questions, attempt.id);
      setHasStarted(true);
    } catch (err) {
      setError(err.message || "Failed to start quiz");
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
      const currentExamCode = await resolveExamCode();

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
      let attemptsQuery = supabase
        .from("quiz_attempts")
        .select("id, status")
        .eq("quiz_id", quiz.id)
        .eq("user_id", student.id)
        .in("status", ["in_progress", "completed"]);

      attemptsQuery = requestedSectionId
        ? attemptsQuery.eq("section_id", requestedSectionId)
        : attemptsQuery.is("section_id", null);

      const { data: existingAttempts, error: checkError } = await attemptsQuery;

      if (checkError) throw new Error(checkError.message);

      if (existingAttempts && existingAttempts.length > 0) {
        const completedAttempt = existingAttempts.find((a) => a.status === "completed");
        if (completedAttempt) {
          setAlreadyTaken(true);
          setAuthenticating(false);
          return;
        }
        // Resume in-progress attempt
        const inProgressAttempt = existingAttempts.find((a) => a.status === "in_progress");
        if (inProgressAttempt) {
          setAttemptId(inProgressAttempt.id);
          await restoreAttemptState(inProgressAttempt.id, questions);
          setHasStarted(true);
          return;
        }
      }

      // Create new attempt only if none exists
      const { data: attempt, error: attemptError } = await supabase
        .from("quiz_attempts")
        .insert([
          {
            quiz_id: quiz.id,
            section_id: requestedSectionId || null,
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
      await shuffleAndSaveOrder(questions, attempt.id);
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

      // Build answers array for server-side grading
      const answersPayload = questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] || "",
      }));

      // Submit to server — grading happens in the database
      const { data: totalScore, error: rpcError } = await supabase.rpc(
        "submit_quiz_attempt",
        {
          p_attempt_id: attemptId,
          p_answers: answersPayload,
        },
      );

      if (rpcError) throw rpcError;

      setScore(totalScore);
      setCompleted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit when time expires
  useEffect(() => {
    if (timeExpired && !completed && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      handleSubmitQuiz();
    }
  }, [timeExpired, completed]);

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

  if (alreadyTaken) {
    const handleExitAlreadyTaken = async () => {
      await supabase.auth.signOut();
      setHasExited(true);
    };

    if (hasExited) {
      return (
        <div className="flex h-screen flex-col items-center justify-center p-4 text-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
          <div className="rounded-xl bg-full-white p-8 shadow-xl max-w-md w-full border border-gray-100">
            <h1 className="text-2xl font-bold text-brand-navy mb-2">Signed Out</h1>
            <p className="text-gray-600">You may now close this tab.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
        <div className="rounded-xl bg-full-white p-8 shadow-xl max-w-md w-full border border-gray-100">
          <div className="text-5xl mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-brand-navy mb-2">Quiz Already Taken</h1>
          <p className="text-gray-600 mb-6">
            You have already completed this quiz. Each student is only allowed one attempt.
          </p>
          <button
            onClick={handleExitAlreadyTaken}
            className="w-full py-3 px-6 bg-brand-navy text-white rounded-lg font-semibold hover:bg-brand-indigo transition-all shadow-md"
          >
            Logout & Exit
          </button>
        </div>
      </div>
    );
  }

  if (completed) {
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);

    const handleExit = async () => {
      await supabase.auth.signOut();
      setHasExited(true);
    };

    if (hasExited) {
      return (
        <div className="flex h-screen flex-col items-center justify-center p-4 text-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
          <div className="rounded-xl bg-full-white p-8 shadow-xl max-w-md w-full border border-gray-100">
            <h1 className="text-2xl font-bold text-brand-navy mb-2">Thank You!</h1>
            <p className="text-gray-600">You have been signed out successfully. You may now close this tab.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
        <h1 className="text-3xl font-bold text-white drop-shadow-lg">Quiz Complete!</h1>
        <div className="mt-4 rounded-xl bg-full-white p-8 shadow-xl max-w-md w-full border border-gray-100">
          <p className="text-5xl font-bold text-brand-navy">
            {score}/{totalPoints}
          </p>
          <p className="mt-2 text-gray-600">Your responses are recorded.</p>

          <div className="mt-8 border-t pt-6">
            <p className="text-xs text-gray-500 mb-4 italic">
              Note: You will be signed out when you exit to protect your account.
            </p>
            <button
              onClick={handleExit}
              className="w-full py-3 px-6 bg-brand-navy text-white rounded-lg font-semibold hover:bg-brand-indigo transition-all shadow-md"
            >
              Finish & Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasStarted && searchParams.get("auth") === "success" && !error && !alreadyTaken) {
    return (
      <div className="flex h-screen items-center justify-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-navy"></div>
          <p className="mt-4 text-brand-navy font-semibold">Signing you in...</p>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg border border-gray-100">
          {error && !quiz ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-2">Oops!</h1>
              <p className="text-gray-700 mb-6">{error}</p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-3 bg-brand-navy text-white rounded-lg font-semibold hover:bg-brand-indigo transition-colors shadow-sm"
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
              {sectionName && (
                <p className="text-sm font-semibold text-brand-navy/60 uppercase tracking-wider">{sectionName}</p>
              )}
              <h1 className="text-2xl font-bold text-brand-navy">{cleanTitle(quiz?.title) || "Loading Quiz..."}</h1>
              {quiz?.description && (
                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Instructions</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{quiz.description}</p>
                </div>
              )}

              {quiz?.duration && (
                <div className="mt-3 flex items-center gap-2 p-3 bg-brand-navy/5 border border-brand-navy/10 rounded-lg">
                  <svg className="w-4 h-4 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-brand-navy">
                    Time Limit: {quiz.duration >= 60 ? `${Math.floor(quiz.duration / 60)}h ${quiz.duration % 60 > 0 ? `${quiz.duration % 60}m` : ""}` : `${quiz.duration} minutes`}
                  </p>
                </div>
              )}

              {authenticating ? (
                <div className="mt-6 flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy"></div>
                  <p className="text-gray-600">Signing in with Google...</p>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="text-sm text-gray-600 mb-4 text-center">
                    Sign in with your institutional Google account
                    (@student.buksu.edu.ph) to start the exam quickly.
                  </p>
                  <button
                    onClick={handleGoogleQuizLoginClick}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-white border-2 border-gray-300 py-3 px-4 font-semibold text-gray-800 hover:border-brand-navy hover:bg-brand-navy/5 hover:text-brand-navy transition-all shadow-md"
                  >
                    <img
                      src="/src/assets/google-icon.png"
                      alt="Google"
                      className="h-5 w-5"
                    />
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
    const reviewProgressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

    return (
      <div className="min-h-screen bg-[url('/src/assets/bg.svg')] bg-cover bg-center pt-0">
        <div className="mx-auto max-w-4xl">
          {/* Sticky header + nav */}
          <div className="sticky top-0 z-20">
            {/* Header — matches question page */}
            <div className="bg-brand-navy rounded-t-lg px-6 py-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-bold text-white">{cleanTitle(quiz?.title)}</h1>
                  <p className="text-sm text-white/70 mt-1">Review</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-brand-gold/20 text-brand-gold px-3 py-1.5 rounded-full text-sm font-bold">
                    {answeredCount}/{questions.length} answered
                  </div>
                  {quizDurationSeconds ? (
                    <div className={`px-3 py-1.5 rounded-full text-sm font-mono font-bold ${isLowTime ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-white"}`}>
                      {formatTime(remainingSeconds ?? quizDurationSeconds)}
                    </div>
                  ) : (
                    <div className="bg-white/10 text-white px-3 py-1.5 rounded-full text-sm font-mono font-bold">
                      {formatTime(elapsedSeconds)}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-gold rounded-full transition-all duration-300"
                  style={{ width: `${reviewProgressPercent}%` }}
                />
              </div>
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
                            ? "bg-red-50 text-red-400 border border-red-200 hover:bg-red-100"
                            : "bg-brand-navy/10 text-brand-navy border border-brand-navy/30 hover:bg-brand-navy/20"
                        }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-brand-navy/10 border border-brand-navy/30"></span>{" "}
                  Answered
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200"></span>{" "}
                  Unanswered
                </span>
              </div>
            </div>
          </div>

          {/* Review body */}
          <div className="bg-white p-6 shadow-md rounded-b-lg">
            {/* Time summary */}
            <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time elapsed: <span className="font-bold text-brand-navy">{formatTime(elapsedSeconds)}</span>
              {quizDurationSeconds && (
                <span className={`ml-2 font-bold ${isLowTime ? "text-red-600" : "text-gray-600"}`}>
                  &middot; Remaining: {formatTime(remainingSeconds ?? quizDurationSeconds)}
                </span>
              )}
            </div>

            {/* Unanswered warning */}
            {unansweredQuestions.length > 0 ? (
              <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-400 rounded">
                <p className="text-sm font-semibold text-red-700 mb-1">
                  You have {unansweredQuestions.length} unanswered {unansweredQuestions.length === 1 ? "question" : "questions"} remaining.
                </p>
                <p className="text-sm text-red-600 mb-2">
                  Unanswered: {unansweredQuestions.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => goToQuestion(item.index)}
                      className="inline-block mx-0.5 px-2 py-0.5 bg-red-100 text-red-700 rounded font-bold text-xs hover:bg-red-200 transition-colors"
                    >
                      #{item.index + 1}
                    </button>
                  ))}
                </p>
                <p className="text-xs text-red-500">
                  Click any number above to go back and answer it.
                </p>
              </div>
            ) : (
              <div className="mb-5 p-4 bg-green-50 border-l-4 border-green-400 rounded">
                <p className="text-green-700 font-semibold text-sm">
                  All {questions.length} questions have been answered.
                </p>
              </div>
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
                onClick={() => setShowConfirmModal(true)}
                disabled={submitting || unansweredQuestions.length > 0}
                className="px-6 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Grade Assessment"}
              </button>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-bold text-brand-navy mb-2">Submit Assessment?</h3>
              <p className="text-gray-600 text-sm mb-1">
                You are about to submit your assessment for grading.
              </p>
              <p className="text-gray-600 text-sm mb-1">
                <span className="font-semibold">{answeredCount}/{questions.length}</span> questions answered
              </p>
              <p className="text-gray-600 text-sm mb-1">
                Time spent: <span className="font-semibold">{formatTime(elapsedSeconds)}</span>
              </p>
              {quizDurationSeconds && (
                <p className={`text-sm mb-4 ${isLowTime ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                  Time remaining: <span className="font-semibold">{formatTime(remainingSeconds ?? quizDurationSeconds)}</span>
                </p>
              )}
              {!quizDurationSeconds && <div className="mb-3" />}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-5">
                <p className="text-yellow-700 text-xs font-medium">
                  This action cannot be undone. You will not be able to change your answers after submitting.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleSubmitQuiz();
                  }}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Yes, Submit"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Question display
  const currentQuestion = questions[currentQuestionIndex];

  const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.svg')] bg-cover bg-center pt-0">
      <div className="mx-auto max-w-4xl">
        {/* Sticky header + nav */}
        <div className="sticky top-0 z-20">
          {/* Quiz header */}
          <div className="bg-brand-navy rounded-t-lg px-6 py-4 shadow-md mb-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-white">{cleanTitle(quiz?.title)}</h1>
                <p className="text-sm text-white/70 mt-1">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Answered badge */}
                <div className="bg-brand-gold/20 text-brand-gold px-3 py-1.5 rounded-full text-sm font-bold">
                  {answeredCount}/{questions.length} answered
                </div>
                {/* Timer */}
                {quizDurationSeconds ? (
                  <div className={`px-3 py-1.5 rounded-full text-sm font-mono font-bold ${isLowTime ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-white"}`}>
                    {formatTime(remainingSeconds ?? quizDurationSeconds)}
                  </div>
                ) : (
                  <div className="bg-white/10 text-white px-3 py-1.5 rounded-full text-sm font-mono font-bold">
                    {formatTime(elapsedSeconds)}
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-gold rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
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
                          ? "bg-brand-gold text-brand-navy ring-2 ring-brand-gold-dark"
                          : isAnswered
                            ? "bg-brand-navy/10 text-brand-navy border border-brand-navy/30 hover:bg-brand-navy/20"
                            : "bg-red-50 text-red-400 border border-red-200 hover:bg-red-100"
                      }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-brand-navy/10 border border-brand-navy/30"></span>{" "}
                Answered
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200"></span>{" "}
                Unanswered
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-brand-gold"></span>{" "}
                Current
              </span>
            </div>
          </div>
        </div>

        {/* Question content */}
        <div className="bg-white p-6 shadow-md rounded-b-lg">
          <h2 className="text-lg font-bold text-brand-navy mb-6">
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
                          ? "border-brand-navy bg-brand-navy/5"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                  >
                    <span
                      className={`font-bold text-sm ${isSelected ? "text-brand-navy" : "text-gray-500"}`}
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
                            ? "border-brand-navy bg-brand-navy/5"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      <span
                        className={`font-bold text-sm ${isSelected ? "text-brand-navy" : "text-gray-500"}`}
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
              className="px-6 py-2.5 bg-brand-navy text-white rounded-lg font-semibold hover:bg-brand-indigo transition-colors"
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
