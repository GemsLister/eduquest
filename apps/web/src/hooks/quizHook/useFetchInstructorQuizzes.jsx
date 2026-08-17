import { useState, useEffect, useCallback } from "react";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

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
          .select("quiz_id, status, admin_feedback, analysis_results, created_at")
          .eq("instructor_id", user.id)
          .order("created_at", { ascending: false });

        if (!submissionsError && subData) {
          submissions = subData;
        }
      } catch (subErr) {
        console.warn("Could not fetch quiz_analysis_submissions:", subErr);
      }

      const submissionQuizIds = (submissions || []).map((s) => s.quiz_id).filter(Boolean);

      // Combine section & submission candidate quiz IDs
      const candidateQuizIds = Array.from(new Set([...sectionQuizIds, ...submissionQuizIds]));

      // 4. Fetch quizzes directly without foreign key embedded join requirements
      let rawQuizzes = [];
      try {
        // Fetch user's own quizzes directly (primary)
        const { data: myQuizzes, error: myErr } = await supabase
          .from("quizzes")
          .select("*")
          .eq("instructor_id", user.id)
          .order("created_at", { ascending: false });

        if (myErr) console.error("Error fetching instructor quizzes:", myErr);

        // Fetch candidate/section quizzes if any
        let candidateQuizzes = [];
        const extraIds = candidateQuizIds.filter((id) => !(myQuizzes || []).some((q) => q.id === id));
        if (extraIds.length > 0) {
          const { data: extraData } = await supabase
            .from("quizzes")
            .select("*")
            .in("id", extraIds)
            .order("created_at", { ascending: false });
          candidateQuizzes = extraData || [];
        }

        // Fetch public quizzes
        const { data: publicQuizzes } = await supabase
          .from("quizzes")
          .select("*")
          .eq("is_private", false)
          .order("created_at", { ascending: false });

        const combinedMap = new Map();
        [...(myQuizzes || []), ...candidateQuizzes, ...(publicQuizzes || [])].forEach((q) => {
          if (q && q.id && !combinedMap.has(q.id)) {
            combinedMap.set(q.id, q);
          }
        });

        rawQuizzes = Array.from(combinedMap.values());
      } catch (quizErr) {
        console.error("Error loading rawQuizzes:", quizErr);
      }

      // Fetch profiles for instructors in a separate, robust query
      const instructorIds = Array.from(
        new Set((rawQuizzes || []).map((q) => q.instructor_id).filter(Boolean))
      );

      const profileMap = new Map();
      if (instructorIds.length > 0) {
        try {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, username, email")
            .in("id", instructorIds);

          if (profilesData) {
            profilesData.forEach((p) => {
              profileMap.set(p.id, p);
            });
          }
        } catch (pErr) {
          console.warn("Could not fetch profiles:", pErr);
        }
      }

      const data = (rawQuizzes || []).map((q) => {
        const profile = profileMap.get(q.instructor_id);
        const ownerFirstName = profile?.first_name || "";
        const ownerLastName = profile?.last_name || "";
        const fullName = `${ownerFirstName} ${ownerLastName}`.trim();
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

      const quizIds = data.map((quiz) => quiz.id);
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

          uniqueSections.forEach((sectionSet, qId) => {
            sectionCountByQuiz.set(qId, sectionSet.size);
          });
        }
      }

      const submissionQuizIdsSet = new Set(submissionQuizIds);
      const sectionQuizIdsSet = new Set(sectionQuizIds);
      const mySectionIdsSet = new Set(mySectionIds);

      const quizzesWithCounts = await Promise.all(
        data.map(async (quiz) => {
          let count = null;
          let countError = null;
          try {
            const { count: juncCount, error: juncError } = await supabase
              .from("quiz_questions")
              .select("*", { count: "exact", head: true })
              .eq("quiz_id", quiz.id);
            if (!isMissingTableError(juncError) && juncCount && juncCount > 0) {
              count = juncCount;
              countError = null;
            } else if (!isMissingTableError(juncError) && !juncError) {
              count = juncCount || 0;
              countError = null;
            } else {
              const direct = await supabase
                .from("questions")
                .select("*", { count: "exact", head: true })
                .eq("quiz_id", quiz.id);
              count = direct.count || 0;
              countError = direct.error;
            }
          } catch (e) {
            const direct = await supabase
              .from("questions")
              .select("*", { count: "exact", head: true })
              .eq("quiz_id", quiz.id);
            count = direct.count || 0;
            countError = direct.error;
          }

          const latestSubmission = latestSubmissionByQuiz.get(quiz.id);

          let resolvedQuestionsCount = !countError ? count || 0 : 0;

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
            try {
              const { count: rootJunc, error: rootJuncErr } = await supabase
                .from("quiz_questions")
                .select("*", { count: "exact", head: true })
                .eq("quiz_id", quiz.parent_quiz_id);
              if (!isMissingTableError(rootJuncErr) && rootJunc && rootJunc > 0) {
                resolvedQuestionsCount = rootJunc;
              } else {
                const { count: rootCount } = await supabase
                  .from("questions")
                  .select("*", { count: "exact", head: true })
                  .eq("quiz_id", quiz.parent_quiz_id);
                if (rootCount && rootCount > 0) {
                  resolvedQuestionsCount = rootCount;
                }
              }
            } catch (e) {
              const { count: rootCount } = await supabase
                .from("questions")
                .select("*", { count: "exact", head: true })
                .eq("quiz_id", quiz.parent_quiz_id);
              if (rootCount && rootCount > 0) {
                resolvedQuestionsCount = rootCount;
              }
            }
          }

          return {
            ...quiz,
            attempts: quiz.quiz_attempts?.[0]?.count || 0,
            questions_count: resolvedQuestionsCount,
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
        })
      );

      const visibleQuizzes = quizzesWithCounts.filter((quiz) => {
        const isOwner = (quiz.instructor_id || quiz.owner_id) === user.id;
        const isSubmittedByMe = submissionQuizIdsSet.has(quiz.id);
        const isAssignedToMySection =
          sectionQuizIdsSet.has(quiz.id) || (quiz.section_id && mySectionIdsSet.has(quiz.section_id));
        const isPublic = quiz.is_private === false;

        const isAccessible = isOwner || isSubmittedByMe || isAssignedToMySection || isPublic;
        return isAccessible && (!quiz.hasNewerVersion || quiz.is_archived);
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

      // Log status change
      await supabase.rpc("log_quiz_status_change", {
        p_quiz_id: quizId,
        p_new_status: "archived",
        p_reason: "Quiz archived by instructor"
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

      // Log status change
      await supabase.rpc("log_quiz_status_change", {
        p_quiz_id: quizId,
        p_new_status: "published",
        p_reason: "Quiz published by instructor"
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
