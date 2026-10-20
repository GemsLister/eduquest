import { useState, useEffect, useCallback } from "react";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { fetchQuestionCounts } from "../../utils/quizCounts.js";

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
      // 1. Fetch instructor's section IDs
      const { data: mySections } = await supabase
        .from("sections")
        .select("id")
        .eq("instructor_id", user.id);
      const mySectionIds = (mySections || []).map((s) => s.id).filter(Boolean);

      // 2. Fetch quiz IDs assigned to instructor's sections via quiz_sections junction
      let sectionQuizIds = [];
      if (mySectionIds.length > 0) {
        const { data: qSecs } = await supabase
          .from("quiz_sections")
          .select("quiz_id")
          .in("section_id", mySectionIds);
        sectionQuizIds = (qSecs || []).map((qs) => qs.quiz_id).filter(Boolean);
      }

      // 3. Fetch submissions by instructor
      let submissions = [];
      try {
        const { data: subData, error: submissionsError } = await supabase
          .from("quiz_analysis_submissions")
          .select("*")
          .eq("instructor_id", user.id)
          .order("created_at", { ascending: false });

        if (!submissionsError && subData) {
          submissions = subData;
        }
      } catch (subErr) {
        console.warn("Could not fetch quiz_analysis_submissions:", subErr);
      }

      const submissionQuizIds = (submissions || []).map((s) => s.quiz_id).filter(Boolean);

      // 4. The instructor's own quizzes plus quizzes shared into their sections.
      //    Public quizzes of unrelated instructors are browsed through the
      //    Question Bank, not listed here.
      const { data: myQuizzes, error: myErr } = await supabase
        .from("quizzes")
        .select("*")
        .eq("instructor_id", user.id)
        .order("created_at", { ascending: false });

      if (myErr) console.error("Error fetching instructor quizzes:", myErr);

      const candidateQuizIds = Array.from(new Set([...sectionQuizIds, ...submissionQuizIds]));
      const extraIds = candidateQuizIds.filter((id) => !(myQuizzes || []).some((q) => q.id === id));
      let candidateQuizzes = [];
      if (extraIds.length > 0) {
        const { data: extraData } = await supabase
          .from("quizzes")
          .select("*")
          .in("id", extraIds)
          .order("created_at", { ascending: false });
        candidateQuizzes = extraData || [];
      }

      const combinedMap = new Map();
      [...(myQuizzes || []), ...candidateQuizzes].forEach((q) => {
        if (q && q.id && !combinedMap.has(q.id)) combinedMap.set(q.id, q);
      });
      const rawQuizzes = Array.from(combinedMap.values());

      // Owner profiles
      const instructorIds = Array.from(
        new Set(rawQuizzes.map((q) => q.instructor_id).filter(Boolean)),
      );
      const profileMap = new Map();
      if (instructorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, username, email")
          .in("id", instructorIds);
        (profilesData || []).forEach((p) => profileMap.set(p.id, p));
      }

      const data = rawQuizzes.map((q) => {
        const profile = profileMap.get(q.instructor_id);
        const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
        const fallbackName = profile?.username || profile?.email || "Instructor";
        return {
          ...q,
          profiles: profile,
          owner_id: q.instructor_id,
          owner_name: fullName || fallbackName,
          is_archived: Boolean(q.is_archived),
        };
      });

      const maxVersionByRoot = new Map();
      data
        .filter((quiz) => !quiz.is_archived)
        .forEach((quiz) => {
          const rootId = quiz.parent_quiz_id || quiz.id;
          const version = quiz.version_number || 1;
          maxVersionByRoot.set(rootId, Math.max(maxVersionByRoot.get(rootId) || 1, version));
        });

      const latestSubmissionByQuiz = new Map();
      (submissions || []).forEach((submission) => {
        if (!latestSubmissionByQuiz.has(submission.quiz_id)) {
          latestSubmissionByQuiz.set(submission.quiz_id, submission);
        }
      });

      const quizIds = data.map((quiz) => quiz.id);
      const parentQuizIds = data.map((q) => q.parent_quiz_id).filter(Boolean);
      const lookupQuizIds = Array.from(new Set([...quizIds, ...parentQuizIds]));

      // Section counts, attempts and question counts in batched queries
      const sectionCountByQuiz = new Map();
      const attemptsCountByQuiz = new Map();
      let questionCounts = new Map();

      if (quizIds.length > 0) {
        const [{ data: quizSections }, { data: attemptsData }, counts] = await Promise.all([
          supabase.from("quiz_sections").select("quiz_id, section_id").in("quiz_id", quizIds),
          supabase.from("quiz_attempts").select("id, quiz_id").in("quiz_id", lookupQuizIds),
          fetchQuestionCounts(lookupQuizIds),
        ]);

        const uniqueSections = new Map();
        (quizSections || []).forEach((row) => {
          const existing = uniqueSections.get(row.quiz_id) || new Set();
          existing.add(row.section_id);
          uniqueSections.set(row.quiz_id, existing);
        });
        uniqueSections.forEach((sectionSet, qId) => sectionCountByQuiz.set(qId, sectionSet.size));

        (attemptsData || []).forEach((a) => {
          attemptsCountByQuiz.set(a.quiz_id, (attemptsCountByQuiz.get(a.quiz_id) || 0) + 1);
        });

        questionCounts = counts;
      }

      const submissionQuizIdsSet = new Set(submissionQuizIds);
      const sectionQuizIdsSet = new Set(sectionQuizIds);
      const mySectionIdsSet = new Set(mySectionIds);

      const quizzesWithCounts = data.map((quiz) => {
        const latestSubmission = latestSubmissionByQuiz.get(quiz.id);

        let resolvedQuestionsCount = questionCounts.get(quiz.id) || 0;
        if (resolvedQuestionsCount === 0 && latestSubmission?.analysis_results) {
          const payload =
            latestSubmission.analysis_results.analysis ||
            latestSubmission.analysis_results.questionSnapshots ||
            [];
          if (Array.isArray(payload) && payload.length > 0) {
            resolvedQuestionsCount = payload.length;
          }
        }
        if (resolvedQuestionsCount === 0 && quiz.parent_quiz_id) {
          resolvedQuestionsCount = questionCounts.get(quiz.parent_quiz_id) || 0;
        }

        const totalAttempts =
          (attemptsCountByQuiz.get(quiz.id) || 0) +
          (quiz.parent_quiz_id ? attemptsCountByQuiz.get(quiz.parent_quiz_id) || 0 : 0);

        return {
          ...quiz,
          attempts: totalAttempts,
          questions_count: resolvedQuestionsCount,
          admin_review_status: latestSubmission?.status || null,
          admin_review_feedback:
            latestSubmission?.faculty_head_feedback || latestSubmission?.admin_feedback || "",
          admin_review_feedback_source: latestSubmission?.faculty_head_feedback
            ? "Department Head"
            : "Reviewer",
          hasNewerVersion:
            (quiz.version_number || 1) <
            (maxVersionByRoot.get(quiz.parent_quiz_id || quiz.id) || quiz.version_number || 1),
          section_count: sectionCountByQuiz.get(quiz.id) || (quiz.section_id ? 1 : 0),
        };
      });

      const visibleQuizzes = quizzesWithCounts.filter((quiz) => {
        const isOwner = (quiz.instructor_id || quiz.owner_id) === user.id;
        const isSubmittedByMe = submissionQuizIdsSet.has(quiz.id);
        const isAssignedToMySection =
          sectionQuizIdsSet.has(quiz.id) || (quiz.section_id && mySectionIdsSet.has(quiz.section_id));
        // Other instructors' drafts and archived quizzes are never shown
        if (!isOwner && !isSubmittedByMe) {
          return isAssignedToMySection && quiz.is_published && !quiz.is_archived;
        }
        return true;
      });

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

  // Updates one of the user's own quizzes; RLS silently ignores updates to
  // quizzes the user can't edit, so an empty result means "not allowed".
  const updateOwnQuiz = async (quizId, values) => {
    const { data, error } = await supabase
      .from("quizzes")
      .update(values)
      .eq("id", quizId)
      .eq("instructor_id", user?.id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("You can only change quizzes you own.");
    }
  };

  const handleRestoreQuiz = async (quizId) => {
    try {
      await updateOwnQuiz(quizId, { is_archived: false });
      await fetchQuizzes();
      notify.success("Quiz restored successfully!");
    } catch (error) {
      console.error("Error restoring quiz:", error);
      notify.error("Error restoring quiz: " + error.message);
    }
  };

  const handleArchiveQuiz = async (quizId) => {
    try {
      // Archived quizzes are also closed to students
      await updateOwnQuiz(quizId, { is_archived: true, is_open: false });

      await supabase.rpc("log_quiz_status_change", {
        p_quiz_id: quizId,
        p_new_status: "archived",
        p_reason: "Quiz archived by instructor",
      });

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
        .select("title, share_token, instructor_id")
        .eq("id", quizId)
        .single();

      if (fetchError) throw fetchError;
      if (quiz.instructor_id !== user?.id) {
        throw new Error("You can only publish quizzes you own.");
      }

      const { count: sectionCount } = await supabase
        .from("quiz_sections")
        .select("quiz_id", { count: "exact", head: true })
        .eq("quiz_id", quizId);
      if (!sectionCount) {
        throw new Error("Assign the quiz to at least one section before publishing.");
      }

      const shareToken = quiz?.share_token || (await getUniqueShareToken());
      const cleanTitle = (quiz?.title || "").replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "");

      await updateOwnQuiz(quizId, {
        is_published: true,
        share_token: shareToken,
        ...(cleanTitle ? { title: cleanTitle } : {}),
      });

      await supabase.rpc("log_quiz_status_change", {
        p_quiz_id: quizId,
        p_new_status: "published",
        p_reason: "Quiz published by instructor",
      });

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
