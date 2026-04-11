import { useState, useEffect, useCallback } from "react";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

export const useFetchInstructorQuizzes = () => {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const generateShareToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const getUniqueShareToken = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateShareToken();
      const { data, error } = await supabase
        .from("quizzes")
        .select("id")
        .eq("share_token", candidate)
        .maybeSingle();

      if (error) throw error;
      if (!data) return candidate;
    }

    throw new Error("Failed to generate a unique share token");
  };

  const fetchQuizzes = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*, quiz_attempts(count)")
        .eq("instructor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: submissions, error: submissionsError } = await supabase
        .from("quiz_analysis_submissions")
        .select("quiz_id, status, admin_feedback, created_at")
        .eq("instructor_id", user.id)
        .order("created_at", { ascending: false });

      if (submissionsError) throw submissionsError;

      const maxVersionByRoot = new Map();
      (data || [])
        .filter((quiz) => !quiz.is_archived)
        .forEach((quiz) => {
          const rootId = quiz.parent_quiz_id || quiz.id;
          const version = quiz.version_number || 1;
          const currentMax = maxVersionByRoot.get(rootId) || 1;
          if (version > currentMax) {
            maxVersionByRoot.set(rootId, version);
          } else if (!maxVersionByRoot.has(rootId)) {
            maxVersionByRoot.set(rootId, currentMax);
          }
        });

      const latestSubmissionByQuiz = new Map();
      (submissions || []).forEach((submission) => {
        if (!latestSubmissionByQuiz.has(submission.quiz_id)) {
          latestSubmissionByQuiz.set(submission.quiz_id, submission);
        }
      });

      const quizIds = (data || []).map((quiz) => quiz.id);
      const sectionCountByQuiz = new Map();

      if (quizIds.length > 0) {
        const { data: quizSections, error: quizSectionsError } = await supabase
          .from("quiz_sections")
          .select("quiz_id, section_id")
          .in("quiz_id", quizIds);

        if (!quizSectionsError && quizSections) {
          const uniqueSections = new Map();
          quizSections.forEach((row) => {
            const existing = uniqueSections.get(row.quiz_id) || new Set();
            existing.add(row.section_id);
            uniqueSections.set(row.quiz_id, existing);
          });

          uniqueSections.forEach((sectionSet, quizId) => {
            sectionCountByQuiz.set(quizId, sectionSet.size);
          });
        }
      }

      const quizzesWithCounts = await Promise.all(
        (data || []).map(async (quiz) => {
          const { count, error: countError } = await supabase
            .from("questions")
            .select("*", { count: "exact", head: true })
            .eq("quiz_id", quiz.id);

          const latestSubmission = latestSubmissionByQuiz.get(quiz.id);

          return {
            ...quiz,
            attempts: quiz.quiz_attempts?.[0]?.count || 0,
            questions_count: !countError ? count : 0,
            admin_review_status: latestSubmission?.status || null,
            admin_review_feedback: latestSubmission?.admin_feedback || "",
            hasNewerVersion:
              (quiz.version_number || 1) <
              (maxVersionByRoot.get(quiz.parent_quiz_id || quiz.id) ||
                quiz.version_number ||
                1),
            section_count:
              sectionCountByQuiz.get(quiz.id) || (quiz.section_id ? 1 : 0),
          };
        }),
      );

      const visibleQuizzes = quizzesWithCounts.filter(
        (quiz) => !quiz.hasNewerVersion || quiz.is_archived,
      );

      setQuizzes(visibleQuizzes);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleRestoreQuiz = async (quizId) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_archived: false })
        .eq("id", quizId);

      if (error) throw error;

      await fetchQuizzes();
      notify.success("Quiz restored successfully!");
    } catch (error) {
      console.error("Error restoring quiz:", error);
      notify.error("Error restoring quiz: " + error.message);
    }
  };

  const handleArchiveQuiz = async (quizId) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_archived: true })
        .eq("id", quizId);

      if (error) throw error;

      await fetchQuizzes();
      notify.success("Quiz archived successfully!");
    } catch (error) {
      console.error("Error archiving quiz:", error);
      notify.error("Error archiving quiz: " + error.message);
    }
  };

  const handlePublishQuiz = async (quizId) => {
    try {
      const { data: quiz, error: fetchError } = await supabase
        .from("quizzes")
        .select("share_token")
        .eq("id", quizId)
        .single();

      if (fetchError) throw fetchError;

      const shareToken = quiz?.share_token || (await getUniqueShareToken());

      const { error } = await supabase
        .from("quizzes")
        .update({ is_published: true, share_token: shareToken })
        .eq("id", quizId);

      if (error) throw error;

      await fetchQuizzes();
      notify.success("Quiz published successfully!");
    } catch (error) {
      console.error("Error publishing quiz:", error);
      notify.error("Error publishing quiz: " + error.message);
    }
  };

  return {
    quizzes,
    loading,
    fetchQuizzes,
    handleRestoreQuiz,
    handleArchiveQuiz,
    handlePublishQuiz,
  };
};
