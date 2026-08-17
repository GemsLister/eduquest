import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import { studentService } from "../services/studentService.js";
import { quizService } from "../services/quizService.js";
import { useGoogleLogin } from "../hooks/authHook/useGoogleLogin.jsx";
import { useSearchParams } from "react-router-dom";

const isMissingTableError = (error) => {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  const code = error.code || "";
  return (
    code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
};

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
  const [quizSectionData, setQuizSectionData] = useState(null);
  const [targetSectionId, setTargetSectionId] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Time spent per question tracking
  const [questionTimeSpent, setQuestionTimeSpent] = useState({});
  const questionEnteredAtRef = useRef(null);
  const currentQuestionIdRef = useRef(null);
  const timerRef = useRef(null);
  const autoSubmitRef = useRef(false);
  const quizContainerRef = useRef(null);

  // Toggle fullscreen mode
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && quizContainerRef.current) {
        await quizContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

  // Track time: save time spent for a given question (now integrated with save_quiz_response)
  const saveTimeForQuestion = async (questionId, seconds) => {
    if (!attemptId || !questionId || !seconds || seconds <= 0) return;
    try {
      // Get current answer for this question
      const currentAnswer = answers[questionId] || null;

      // Use save_quiz_response to save both answer and time
      await supabase.rpc("save_quiz_response", {
        p_attempt_id: attemptId,
        p_question_id: questionId,
        p_answer: currentAnswer,
        p_time_spent: Math.round(seconds * 10) / 10, // Round to 1 decimal place
      });
    } catch (err) {
      console.error("Error saving question time:", err);
    }
  };

  const finalizeCurrentQuestionTime = () => {
    if (!questionEnteredAtRef.current || !currentQuestionIdRef.current) return;
    const now = Date.now();
    const secondsSpent = (now - questionEnteredAtRef.current) / 1000;
    if (secondsSpent > 0.5) {
      const qid = currentQuestionIdRef.current;
      setQuestionTimeSpent(prev => ({
        ...prev,
        [qid]: (prev[qid] || 0) + secondsSpent
      }));
      saveTimeForQuestion(qid, secondsSpent);
    }
    questionEnteredAtRef.current = null;
  };

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
    if (hrs > 0)
      return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Low time warning (last 5 minutes)
  const isLowTime =
    remainingSeconds !== null &&
    remainingSeconds <= 300 &&
    remainingSeconds > 0;

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    // Auto-save answer via server-side grading (fire and forget)
    if (attemptId) {
      // Calculate time spent on this question
      const timeSpent = questionTimeSpent[questionId] || 0;

      supabase
        .rpc("save_quiz_response", {
          p_attempt_id: attemptId,
          p_question_id: questionId,
          p_answer: value,
          p_time_spent: Math.round(timeSpent * 10) / 10, // Round to 1 decimal place
        })
        .then(() => {});
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
    const { data: savedResponses } =
      await quizService.getResponsesDetailsByAttempt(existingAttemptId);
    if (savedResponses && savedResponses.length > 0) {
      const restoredAnswers = {};
      savedResponses.forEach((r) => {
        restoredAnswers[r.question_id] = r.answer;
      });
      setAnswers(restoredAnswers);
    }

    // Auto-answer questions with auto_answer flag that don't have saved answers
    const autoAnswers = {};
    questionsArr.forEach(question => {
      if (question.auto_answer && 
          question.correct_answer !== undefined && 
          !restoredAnswers[question.id]) {
        autoAnswers[question.id] = String(question.correct_answer);
      }
    });
    
    if (Object.keys(autoAnswers).length > 0) {
      setAnswers(prev => ({ ...prev, ...autoAnswers }));
      
      // Save auto-answers to server
      for (const [questionId, answer] of Object.entries(autoAnswers)) {
        supabase.rpc("save_quiz_response", {
          p_attempt_id: existingAttemptId,
          p_question_id: questionId,
          p_answer: answer,
          p_time_spent: 0 // Auto-answers have no time spent
        }).catch(err => console.error("Error saving auto-answer:", err));
      }
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
        let quizData = null;
        let quizError = null;
        let targetSectionId = requestedSectionId;

        // First try to load by section-specific share token
        const { data: sectionQuizData, error: sectionQuizError } = await supabase
          .from("quiz_sections")
          .select("*, quizzes(*), sections(*)")
          .eq("share_token", shareToken)
          .eq("quizzes.is_published", true)
          .maybeSingle();

        if (sectionQuizData && !sectionQuizError) {
          // Found section-specific share token
          quizData = sectionQuizData.quizzes;
          setTargetSectionId(sectionQuizData.section_id);
          setQuizSectionData(sectionQuizData);
          console.log("Loaded quiz via section-specific share token");
        } else {
          // Fall back to regular quiz share token
          const { data: regularQuizData, error: regularQuizError } = await supabase
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
            .maybeSingle();

          quizData = regularQuizData;
          quizError = regularQuizError;
          console.log("Loaded quiz via regular share token");
        }

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
          targetSectionId,
        );
        if (!assignedToRequestedSection) {
          setError("This quiz link is not valid for this section.");
          setLoading(false);
          return;
        }

        // Fetch section name for display
        if (targetSectionId) {
          const { data: sectionData } = await supabase
            .from("sections")
            .select("*")
            .eq("id", targetSectionId)
            .maybeSingle();
          if (sectionData)
            setSectionName(sectionData.section_name || sectionData.name || "");
        }

        if (quizData.is_open === false) {
          setError("This quiz is currently closed by the instructor.");
          setLoading(false);
          return;
        }

        setQuiz(quizData);

        // ---------- Fetch questions via RPC, fallback to junction table & direct ----------
        let questionsData = [];
        let questionsError = null;

        // Try SECURITY DEFINER RPC first to ensure questions are loaded for published private/public quizzes
        try {
          const { data: rpcQs, error: rpcErr } = await supabase.rpc(
            "get_public_quiz_questions",
            { p_quiz_id: quizData.id }
          );

          if (!rpcErr && Array.isArray(rpcQs) && rpcQs.length > 0) {
            questionsData = rpcQs;
          }
        } catch (rpcCatchErr) {
          console.warn("RPC get_public_quiz_questions skipped:", rpcCatchErr);
        }

        const tryViaJunction = async () => {
          try {
            const { data, error } = await supabase
              .from("quiz_questions")
              .select(
                "questions(id, quiz_id, type, text, options, points, created_at, correct_answer, auto_answer), order_index"
              )
              .eq("quiz_id", quizData.id)
              .order("order_index", { ascending: true });
            if (isMissingTableError(error)) return { ok: false, error };
            if (error) return { ok: false, error };
            if (!data || data.length === 0) return { ok: false, error: null };
            const mapped = data
              .map((r) => r.questions)
              .filter((q) => q !== null);
            if (mapped.length === 0) return { ok: false, error: null };
            return { ok: true, data: mapped };
          } catch (e) {
            return { ok: false, error: null };
          }
        };

        const tryDirect = async () => {
          let { data, error } = await supabase
            .from("questions")
            .select(
              "id, quiz_id, type, text, options, points, created_at, correct_answer, auto_answer"
            )
            .eq("quiz_id", quizData.id)
            .order("created_at", { ascending: true });

          if (
            error &&
            (error.code === "42703" ||
              error.message?.includes("auto_answer"))
          ) {
            const retry = await supabase
              .from("questions")
              .select(
                "id, quiz_id, type, text, options, points, created_at, correct_answer"
              )
              .eq("quiz_id", quizData.id)
              .order("created_at", { ascending: true });
            data = retry.data;
            error = retry.error;
          }
          if (error) return { ok: false, error };
          return { ok: true, data };
        };

        if (questionsData.length === 0) {
          const junc = await tryViaJunction();
          if (junc.ok) {
            questionsData = junc.data;
          } else {
            const dir = await tryDirect();
            questionsData = dir.data || [];
            if (!junc.ok && isMissingTableError(junc.error)) {
              questionsError = dir.error || null;
            } else {
              questionsError = dir.error || junc.error;
            }
          }
        }

        if (questionsError) throw questionsError;

        if (!questionsData || questionsData.length === 0) {
          try {
            const { data: sub } = await supabase
              .from("quiz_analysis_submissions")
              .select("analysis_results")
              .eq("quiz_id", quizData.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const snapshots =
              sub?.analysis_results?.questionSnapshots ||
              sub?.analysis_results?.analysis ||
              [];

            if (Array.isArray(snapshots) && snapshots.length > 0) {
              questionsData = snapshots
                .slice()
                .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                .map((snap) => {
                  const qType = snap.type || "mcq";
                  const isMCQ = qType === "mcq";
                  const isTF = qType === "true_false";
                  let rawOptions =
                    isMCQ && Array.isArray(snap.options) ? snap.options : [];
                  while (isMCQ && rawOptions.length < 4) rawOptions.push("");
                  rawOptions = rawOptions.filter(
                    (o, idx) =>
                      !isMCQ ||
                      idx < 4 ||
                      String(o || "").trim().length > 0,
                  );
                  if (isMCQ && rawOptions.length < 4) {
                    while (rawOptions.length < 4) rawOptions.push("");
                  }

                  let correctAnswer = null;
                  const snapCorrect = snap.correctAnswer;
                  if (isMCQ) {
                    if (typeof snapCorrect === "number") {
                      correctAnswer = rawOptions[snapCorrect] ?? null;
                    } else {
                      correctAnswer = snapCorrect ?? null;
                    }
                  } else if (isTF) {
                    correctAnswer =
                      String(snapCorrect ?? "true").toLowerCase() === "true" ||
                      snapCorrect === 0 ||
                      snapCorrect === "0"
                        ? "true"
                        : "false";
                  } else {
                    correctAnswer = snapCorrect ?? null;
                  }

                  const pseudoId =
                    snap.questionId ||
                    `restored-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

                  return {
                    id: String(pseudoId),
                    quiz_id: quizData.id,
                    type: isTF ? "true_false" : qType,
                    text: snap.questionText || snap.text || "",
                    options: isMCQ ? rawOptions : [],
                    points: 1,
                    correct_answer: correctAnswer,
                    auto_answer: false,
                    created_at: new Date().toISOString(),
                  };
                });
            }
          } catch (subErr) {
            console.warn(
              "[PublicQuizPage.loadQuiz] Could not restore from analysis snapshot",
              subErr,
            );
          }
        }

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
  const authDeadlineRef = useRef(null);
  useEffect(() => {
    if (!searchParams.get("auth") || searchParams.get("auth") !== "success") return;

    // Start a 20-second deadline — if we still haven't started, show a concrete error
    if (authDeadlineRef.current === null) {
      authDeadlineRef.current = setTimeout(() => {
        if (!hasStarted) {
          const why = [];
          if (!session?.user) why.push("Google session not established");
          if (!quiz) why.push("Quiz data not loaded");
          if (quiz && questions.length === 0) why.push("No questions exist for this quiz");
          if (!googleStartRef.current && quiz && questions.length === 0) {
            googleStartRef.current = true; // block duplicate
          }
          setError(
            "Could not automatically start the quiz. " +
            (why.length > 0 ? `Reason: ${why.join(", ")}. ` : "") +
            "Please sign in again using the button below.",
          );
        }
      }, 20000);
    }

    if (
      session?.user &&
      !hasStarted &&
      quiz &&
      questions.length > 0 &&
      !googleStartRef.current
    ) {
      googleStartRef.current = true;
      if (authDeadlineRef.current) {
        clearTimeout(authDeadlineRef.current);
        authDeadlineRef.current = null;
      }
      handleGoogleQuizStart();
      return;
    }

    // If auth=success + everything loaded but questions = 0 even after snapshot fallback,
    // fail fast instead of infinite spinner
    if (
      session?.user &&
      quiz &&
      questions.length === 0 &&
      !hasStarted &&
      !googleStartRef.current &&
      loading === false
    ) {
      googleStartRef.current = true;
      if (authDeadlineRef.current) {
        clearTimeout(authDeadlineRef.current);
        authDeadlineRef.current = null;
      }
      setError(
        "This quiz currently has no questions available to take. " +
        "Please contact your instructor to populate the quiz before attempting again.",
      );
    }

    return () => {
      // don't clear on rerender; only clear if component fully unmounts below
    };
  }, [session, searchParams, hasStarted, quiz, questions, loading]);

  useEffect(() => {
    return () => {
      if (authDeadlineRef.current) {
        clearTimeout(authDeadlineRef.current);
        authDeadlineRef.current = null;
      }
    };
  }, []);

  const { handleGoogleQuizLogin } = useGoogleLogin();

  const handleGoogleQuizLoginClick = () => {
    handleGoogleQuizLogin(shareToken, requestedSectionId);
    setAuthenticating(true);
  };

  const handleGoogleQuizStart = async () => {
    if (!session?.user) return;
    setError("");

    const user = session.user;
    const email = user.email;
    const studentId = email.split("@")[0];
    const studentName = user.user_metadata?.full_name || studentId;

    const instructorDomain = import.meta.env.VITE_INSTRUCTOR_ACCOUNT_EXTENSION || "@student.buksu.edu.ph";
    const studentDomain = import.meta.env.VITE_STUDENT_ACCOUNT_EXTENSION || "@gmail.com";

    const isInstructorEmail = email.endsWith(instructorDomain);
    if (isInstructorEmail) {
      setError(
        `You are currently signed in with an instructor account (${email}). To take this quiz as a student, please switch to a student account (e.g. ${studentDomain}).`,
      );
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

      // Check for existing attempt by email + section (works across devices)
      let attemptsQuery = supabase
        .from("quiz_attempts")
        .select("id, status")
        .eq("quiz_id", quiz.id)
        .eq("student_email", email)
        .in("status", ["in_progress", "completed"]);

      attemptsQuery = targetSectionId
        ? attemptsQuery.eq("section_id", targetSectionId)
        : attemptsQuery.is("section_id", null);

      const { data: existingAttempts, error: checkError } = await attemptsQuery;

      if (checkError) throw new Error(checkError.message);

      if (existingAttempts && existingAttempts.length > 0) {
        const completedAttempt = existingAttempts.find(
          (a) => a.status === "completed",
        );
        if (completedAttempt) {
          setAlreadyTaken(true);
          setAuthenticating(false);
          return;
        }
        // Resume in-progress attempt
        const inProgressAttempt = existingAttempts.find(
          (a) => a.status === "in_progress",
        );
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
            section_id: targetSectionId || null,
            user_id: session.user.id,
            student_name: studentName,
            student_email: email,
            status: "in_progress",
          },
        ])
        .select()
        .single();

      if (attemptError) {
        // Unique constraint violation — another device/tab already created an attempt
        if (attemptError.code === "23505") {
          setAlreadyTaken(true);
          setAuthenticating(false);
          return;
        }
        throw new Error(attemptError.message);
      }
      if (!attempt) throw new Error("Failed to create quiz attempt.");

      setAttemptId(attempt.id);
      await shuffleAndSaveOrder(questions, attempt.id);
      
      // Auto-answer questions with auto_answer flag
      const autoAnswers = {};
      questions.forEach(question => {
        if (question.auto_answer && question.correct_answer !== undefined) {
          autoAnswers[question.id] = String(question.correct_answer);
        }
      });

      if (Object.keys(autoAnswers).length > 0) {
        setAnswers(prev => ({ ...prev, ...autoAnswers }));

        // Save auto-answers to server
        for (const [questionId, answer] of Object.entries(autoAnswers)) {
          supabase.rpc("save_quiz_response", {
            p_attempt_id: attempt.id,
            p_question_id: questionId,
            p_answer: answer,
            p_time_spent: 0 // Auto-answers have no time spent
          }).catch(err => console.error("Error saving auto-answer:", err));
        }
      }

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

      attemptsQuery = targetSectionId
        ? attemptsQuery.eq("section_id", targetSectionId)
        : attemptsQuery.is("section_id", null);

      const { data: existingAttempts, error: checkError } = await attemptsQuery;

      if (checkError) throw new Error(checkError.message);

      if (existingAttempts && existingAttempts.length > 0) {
        const completedAttempt = existingAttempts.find(
          (a) => a.status === "completed",
        );
        if (completedAttempt) {
          setAlreadyTaken(true);
          setAuthenticating(false);
          return;
        }
        // Resume in-progress attempt
        const inProgressAttempt = existingAttempts.find(
          (a) => a.status === "in_progress",
        );
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
            section_id: targetSectionId || null,
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
      
      // Auto-answer questions with auto_answer flag
      const autoAnswers = {};
      questions.forEach(question => {
        if (question.auto_answer && question.correct_answer !== undefined) {
          autoAnswers[question.id] = String(question.correct_answer);
        }
      });

      if (Object.keys(autoAnswers).length > 0) {
        setAnswers(prev => ({ ...prev, ...autoAnswers }));

        // Save auto-answers to server
        for (const [questionId, answer] of Object.entries(autoAnswers)) {
          supabase.rpc("save_quiz_response", {
            p_attempt_id: attempt.id,
            p_question_id: questionId,
            p_answer: answer,
            p_time_spent: 0 // Auto-answers have no time spent
          }).catch(err => console.error("Error saving auto-answer:", err));
        }
      }

      setHasStarted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Navigate between questions freely
  const goToQuestion = (index) => {
    // Save time first before moving
    finalizeCurrentQuestionTime();
    setShowReviewPage(false);
    setCurrentQuestionIndex(index);
  };

  // Apply auto-answers when questions and attempt are loaded
  useEffect(() => {
    if (hasStarted && questions.length > 0 && attemptId) {
      const autoAnswers = {};
      questions.forEach(question => {
        if (question.auto_answer && question.correct_answer !== undefined && !answers[question.id]) {
          autoAnswers[question.id] = String(question.correct_answer);
        }
      });
      
      if (Object.keys(autoAnswers).length > 0) {
        setAnswers(prev => ({ ...prev, ...autoAnswers }));

        // Save auto-answers to server
        for (const [questionId, answer] of Object.entries(autoAnswers)) {
          supabase.rpc("save_quiz_response", {
            p_attempt_id: attemptId,
            p_question_id: questionId,
            p_answer: answer,
            p_time_spent: 0 // Auto-answers have no time spent
          }).catch(err => console.error("Error saving auto-answer:", err));
        }
      }
    }
  }, [hasStarted, questions, attemptId]);

  // Fetch existing time spent for this attempt (restore from DB)
  useEffect(() => {
    if (!hasStarted || !attemptId || questions.length === 0) return;
    const fetchTimeSpent = async () => {
      try {
        const { data } = await supabase
          .from("quiz_responses")
          .select("question_id, time_spent_seconds")
          .eq("attempt_id", attemptId);
        if (data && data.length > 0) {
          const timeMap = {};
          data.forEach(r => {
            if (r.time_spent_seconds) {
              timeMap[r.question_id] = r.time_spent_seconds;
            }
          });
          setQuestionTimeSpent(timeMap);
        }
      } catch (err) {
        console.error("Error fetching time spent:", err);
      }
    };
    fetchTimeSpent();
  }, [hasStarted, attemptId, questions]);

  const handleNext = () => {
    finalizeCurrentQuestionTime();
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Last question → show review page
      setShowReviewPage(true);
    }
  };

  const handlePrevious = () => {
    finalizeCurrentQuestionTime();
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
      // Finalize time on current question
      finalizeCurrentQuestionTime();

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

  // Update isFullscreen when fullscreen status changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Track time on question change / review page
  useEffect(() => {
    if (!hasStarted || !attemptId) return;
    // Start tracking new question
    if (!showReviewPage && questions.length > 0 && currentQuestionIndex < questions.length) {
      const qid = questions[currentQuestionIndex].id;
      currentQuestionIdRef.current = qid;
      questionEnteredAtRef.current = Date.now();
    } else {
      // Review page: no current question active
      currentQuestionIdRef.current = null;
      questionEnteredAtRef.current = null;
    }
    return () => {
      finalizeCurrentQuestionTime();
    };
  }, [currentQuestionIndex, showReviewPage, hasStarted, attemptId, questions]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      finalizeCurrentQuestionTime();
    };
  }, []);

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
        <span className="text-brand-gold font-semibold drop-shadow-md">
          Loading...
        </span>
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
            <h1 className="text-2xl font-bold text-brand-navy mb-2">
              Signed Out
            </h1>
            <p className="text-gray-600">You may now close this tab.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
        <div className="rounded-xl bg-full-white p-8 shadow-xl max-w-md w-full border border-gray-100">
          <div className="text-5xl mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-brand-navy mb-2">
            Quiz Already Taken
          </h1>
          <p className="text-gray-600 mb-6">
            You have already completed this quiz. Each student is only allowed
            one attempt.
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
    const totalTime = Object.values(questionTimeSpent).reduce((s, v) => s + (v || 0), 0);
    const formatTimeSpentLocal = (sec) => {
      if (!sec || sec <= 0) return "< 1s";
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    };

    const handleExit = async () => {
      await supabase.auth.signOut();
      setHasExited(true);
    };

    if (hasExited) {
      return (
        <div className="flex h-screen flex-col items-center justify-center p-4 text-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
          <div className="rounded-xl bg-full-white p-8 shadow-xl max-w-md w-full border border-gray-100">
            <h1 className="text-2xl font-bold text-brand-navy mb-2">
              Thank You!
            </h1>
            <p className="text-gray-600">
              You have been signed out successfully. You may now close this tab.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center overflow-auto py-12">
        <h1 className="text-3xl font-bold text-white drop-shadow-lg">
          Quiz Complete!
        </h1>
        <div className="mt-4 rounded-xl bg-full-white p-8 shadow-xl max-w-md w-full border border-gray-100 text-left">
          <div className="text-center">
            <p className="text-5xl font-bold text-brand-navy">
              {score}/{totalPoints}
            </p>
            <p className="mt-2 text-gray-600">Your responses are recorded.</p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-sm font-semibold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Total Time: {formatTimeSpentLocal(totalTime)}
            </div>
          </div>

          {/* Per Question Time Breakdown */}
          {questions.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Time per Question
              </h3>
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between text-sm bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
                  >
                    <span className="text-gray-700 truncate max-w-[75%]">
                      <span className="font-semibold text-brand-navy mr-2">Q{idx + 1}.</span>
                      {q.text?.length > 50 ? q.text.substring(0, 50) + "…" : q.text}
                    </span>
                    <span className="text-gray-600 font-semibold whitespace-nowrap ml-2">
                      {formatTimeSpentLocal(questionTimeSpent[q.id])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 border-t pt-6">
            <p className="text-xs text-gray-500 mb-4 italic text-center">
              Note: You will be signed out when you exit to protect your
              account.
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

  if (
    !hasStarted &&
    searchParams.get("auth") === "success" &&
    !error &&
    !alreadyTaken
  ) {
    return (
      <div className="flex h-screen items-center justify-center bg-[url('/src/assets/bg.svg')] bg-cover bg-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-navy"></div>
          <p className="mt-4 text-brand-gold font-semibold drop-shadow-md">
            Signing you in...
          </p>
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
                <p className="text-sm font-semibold text-brand-navy/60 uppercase tracking-wider">
                  {sectionName}
                </p>
              )}
              <h1 className="text-2xl font-bold text-brand-navy">
                {cleanTitle(quiz?.title) || "Loading Quiz..."}
              </h1>
              {quiz?.description && (
                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Instructions
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {quiz.description}
                  </p>
                </div>
              )}

              {quiz?.duration && (
                <div className="mt-3 flex items-center gap-2 p-3 bg-brand-navy/5 border border-brand-navy/10 rounded-lg">
                  <svg
                    className="w-4 h-4 text-brand-navy"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm font-semibold text-brand-navy">
                    Time Limit:{" "}
                    {quiz.duration >= 60
                      ? `${Math.floor(quiz.duration / 60)}h ${quiz.duration % 60 > 0 ? `${quiz.duration % 60}m` : ""}`
                      : `${quiz.duration} minutes`}
                  </p>
                </div>
              )}

              {authenticating ? (
                <div className="mt-6 flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy"></div>
                  <p className="text-brand-gold font-medium drop-shadow-sm">
                    Signing in with Google...
                  </p>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="text-sm text-gray-600 mb-4 text-center">
                    Sign in with your Google account
                    to start the exam quickly.
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
    const reviewProgressPercent =
      questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

    return (
      <div className="min-h-screen bg-[url('/src/assets/bg.svg')] bg-cover bg-center pt-0" ref={quizContainerRef}>
        <div className="mx-auto max-w-4xl">
          {/* Sticky header + nav */}
          <div className="sticky top-0 z-20">
            {/* Header — matches question page */}
            <div className="bg-brand-navy rounded-t-lg px-6 py-4 shadow-md">
              <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-white">
                  {cleanTitle(quiz?.title)}
                </h1>
                <p className="text-sm text-white/70 mt-1">Review</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Fullscreen toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4V9m0 0H9m-9 0l4-4m11 4h5m0 0V4m0 5l-4-4M4 20v-5m0 0H9m-9 0l4 4m11-4h5m0 0v5m0-5l-4 4" />
                    </svg>
                  )}
                </button>
                <div className="bg-brand-gold/20 text-brand-gold px-3 py-1.5 rounded-full text-sm font-bold">
                  {answeredCount}/{questions.length} answered
                </div>
                {quizDurationSeconds ? (
                  <div
                    className={`px-3 py-1.5 rounded-full text-sm font-mono font-bold ${isLowTime ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-white"}`}
                  >
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
                            : "bg-green-500 text-white border border-green-600 hover:bg-green-600"
                        }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-green-500 border border-green-600"></span>{" "}
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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Time elapsed:{" "}
              <span className="font-bold text-brand-navy">
                {formatTime(elapsedSeconds)}
              </span>
              {quizDurationSeconds && (
                <span
                  className={`ml-2 font-bold ${isLowTime ? "text-red-600" : "text-gray-600"}`}
                >
                  &middot; Remaining:{" "}
                  {formatTime(remainingSeconds ?? quizDurationSeconds)}
                </span>
              )}
            </div>

            {/* Unanswered warning */}
            {unansweredQuestions.length > 0 ? (
              <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-400 rounded">
                <p className="text-sm font-semibold text-red-700 mb-1">
                  You have {unansweredQuestions.length} unanswered{" "}
                  {unansweredQuestions.length === 1 ? "question" : "questions"}{" "}
                  remaining.
                </p>
                <p className="text-sm text-red-600 mb-2">
                  Unanswered:{" "}
                  {unansweredQuestions.map((item) => (
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
              <h3 className="text-lg font-bold text-brand-navy mb-2">
                Submit Assessment?
              </h3>
              <p className="text-gray-600 text-sm mb-1">
                You are about to submit your assessment for grading.
              </p>
              <p className="text-gray-600 text-sm mb-1">
                <span className="font-semibold">
                  {answeredCount}/{questions.length}
                </span>{" "}
                questions answered
              </p>
              <p className="text-gray-600 text-sm mb-1">
                Time spent:{" "}
                <span className="font-semibold">
                  {formatTime(elapsedSeconds)}
                </span>
              </p>
              {quizDurationSeconds && (
                <p
                  className={`text-sm mb-4 ${isLowTime ? "text-red-600 font-semibold" : "text-gray-600"}`}
                >
                  Time remaining:{" "}
                  <span className="font-semibold">
                    {formatTime(remainingSeconds ?? quizDurationSeconds)}
                  </span>
                </p>
              )}
              {!quizDurationSeconds && <div className="mb-3" />}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-5">
                <p className="text-yellow-700 text-xs font-medium">
                  This action cannot be undone. You will not be able to change
                  your answers after submitting.
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

  const progressPercent =
    questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-[url('/src/assets/bg.svg')] bg-cover bg-center pt-0" ref={quizContainerRef}>
      <div className="mx-auto max-w-4xl">
        {/* Sticky header + nav */}
        <div className="sticky top-0 z-20">
          {/* Quiz header */}
          <div className="bg-brand-navy rounded-t-lg px-6 py-4 shadow-md mb-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-white">
                  {cleanTitle(quiz?.title)}
                </h1>
                <p className="text-sm text-white/70 mt-1">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Fullscreen toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4V9m0 0H9m-9 0l4-4m11 4h5m0 0V4m0 5l-4-4M4 20v-5m0 0H9m-9 0l4 4m11-4h5m0 0v5m0-5l-4 4" />
                    </svg>
                  )}
                </button>
                {/* Answered badge */}
                <div className="bg-brand-gold/20 text-brand-gold px-3 py-1.5 rounded-full text-sm font-bold">
                  {answeredCount}/{questions.length} answered
                </div>
                {/* Timer */}
                {quizDurationSeconds ? (
                  <div
                    className={`px-3 py-1.5 rounded-full text-sm font-mono font-bold ${isLowTime ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-white"}`}
                  >
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
                            ? "bg-green-500 text-white border border-green-600 hover:bg-green-600"
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
