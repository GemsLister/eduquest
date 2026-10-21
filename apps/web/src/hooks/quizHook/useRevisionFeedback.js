import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { formatReviewerLabel } from "../../utils/reviewerLabel.js";

const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Comments from the review that sent this quiz back for revision, so the quiz
 * editor can show them next to the questions they are about.
 *
 * Looks at the latest submission in the quiz's version chain; comments only
 * apply while that submission is "revision_requested" (once resubmitted, the
 * new review starts clean). Revision copies get new question ids, so a
 * question is matched to its comment by id, then by text, then by position.
 */
export const useRevisionFeedback = (quizId, parentQuizId) => {
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!quizId || quizId === "draft") return;
    let cancelled = false;

    (async () => {
      const rootId = parentQuizId || quizId;
      const { data: chainQuizzes } = await supabase
        .from("quizzes")
        .select("id")
        .or(`id.eq.${rootId},parent_quiz_id.eq.${rootId}`);
      const chainIds = (chainQuizzes || []).map((q) => q.id);
      if (chainIds.length === 0) return;

      const { data: subs } = await supabase
        .from("quiz_analysis_submissions")
        .select("*")
        .in("quiz_id", chainIds)
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = subs?.[0];
      if (cancelled || !latest || latest.status !== "revision_requested") {
        if (!cancelled) setFeedback(null);
        return;
      }

      const reviewerId = latest.reviewed_by || latest.assigned_reviewer_id;
      const { data: reviewer } = reviewerId
        ? await supabase
            .from("profiles")
            .select("first_name, last_name, username, email, is_admin")
            .eq("id", reviewerId)
            .maybeSingle()
        : { data: null };
      if (cancelled) return;

      const reviewerLabel = formatReviewerLabel(reviewer);
      const items = (latest.analysis_results?.analysis || []).map((item) => ({
        questionId: String(item.questionId),
        text: normalize(item.questionText),
        comments: [
          latest.question_feedback?.[item.questionId] && {
            author: reviewerLabel,
            text: latest.question_feedback[item.questionId],
          },
          latest.faculty_head_question_feedback?.[item.questionId] && {
            author: "Department Head",
            text: latest.faculty_head_question_feedback[item.questionId],
          },
        ].filter(Boolean),
      }));

      setFeedback({
        submissionId: latest.id,
        overall: [
          latest.admin_feedback && { author: reviewerLabel, text: latest.admin_feedback },
          latest.faculty_head_feedback && {
            author: "Department Head",
            text: latest.faculty_head_feedback,
          },
        ].filter(Boolean),
        items,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [quizId, parentQuizId]);

  const getQuestionComments = (question, index) => {
    if (!feedback) return [];
    const { items } = feedback;
    const match =
      items.find((i) => i.questionId === String(question.id)) ||
      items.find((i) => i.text && i.text === normalize(question.text)) ||
      items[index];
    return match?.comments || [];
  };

  return { revisionFeedback: feedback, getQuestionComments };
};
