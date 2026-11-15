import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { runExamAnalysis } from "../../utils/examAnalysis";

const newest = (...dates) =>
  dates.filter(Boolean).reduce((max, d) => (new Date(d) > new Date(max) ? d : max), "1970-01-01T00:00:00Z");

/**
 * The exam's latest Bloom's analysis for the exam editor.
 *
 * Loads the newest of:
 *   - the analysis saved by the editor (quiz_editor_analysis), and
 *   - the latest review submission in the exam's version chain, which holds
 *     any levels the reviewers corrected,
 * across the exam and its revision copies. `analyze` runs the classifier and
 * saves the result; `remember` saves a result produced elsewhere (the
 * Submit for Review dialog).
 */
export const useExamAnalysis = ({ quizId, parentQuizId, userId }) => {
  const [results, setResults] = useState(null);
  const [source, setSource] = useState(null); // "editor" | "review"
  const [running, setRunning] = useState(false);
  const resultsRef = useRef(null);
  resultsRef.current = results;

  const loadedQuizIdRef = useRef(null);

  useEffect(() => {
    if (!quizId || quizId === "draft") return;
    // Opening another exam clears the previous one's analysis; a new exam's
    // first save (no id -> id) keeps what was just analyzed
    if (loadedQuizIdRef.current && loadedQuizIdRef.current !== quizId) {
      setResults(null);
      setSource(null);
    }
    loadedQuizIdRef.current = quizId;
    let cancelled = false;

    (async () => {
      const rootId = parentQuizId || quizId;
      const { data: chain } = await supabase
        .from("quizzes")
        .select("id")
        .or(`id.eq.${rootId},parent_quiz_id.eq.${rootId}`);
      const chainIds = [...new Set([quizId, ...(chain || []).map((q) => q.id)])];

      const [{ data: saved, error: savedError }, { data: subs }] = await Promise.all([
        supabase
          .from("quiz_editor_analysis")
          .select("quiz_id, analysis, analyzed_at")
          .in("quiz_id", chainIds)
          .order("analyzed_at", { ascending: false })
          .limit(1),
        supabase
          .from("quiz_analysis_submissions")
          .select("analysis_results, created_at, updated_at, reviewed_at, faculty_head_reviewed_at")
          .in("quiz_id", chainIds)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;
      if (savedError) console.warn("Could not load the saved Bloom's analysis:", savedError.message);

      const editorRow = saved?.[0];
      const sub = subs?.[0];
      const editorAt = editorRow?.analyzed_at;
      const reviewAt = sub
        ? newest(sub.created_at, sub.updated_at, sub.reviewed_at, sub.faculty_head_reviewed_at)
        : null;

      if (editorRow && (!reviewAt || new Date(editorAt) >= new Date(reviewAt))) {
        setResults({ ...editorRow.analysis, analyzedAt: editorRow.analysis.analyzedAt || editorAt });
        setSource("editor");
      } else if (sub?.analysis_results?.analysis?.length) {
        setResults({ ...sub.analysis_results, analyzedAt: sub.analysis_results.analyzedAt || sub.created_at });
        setSource("review");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizId, parentQuizId]);

  const persist = useCallback(
    async (analysis, targetQuizId) => {
      const id = targetQuizId || quizId;
      if (!id || id === "draft") return;
      const { error } = await supabase.from("quiz_editor_analysis").upsert(
        {
          quiz_id: id,
          analysis,
          analyzed_at: analysis.analyzedAt || new Date().toISOString(),
          analyzed_by: userId || undefined,
        },
        { onConflict: "quiz_id" },
      );
      if (error) console.warn("Could not save the Bloom's analysis:", error.message);
    },
    [quizId, userId],
  );

  /** Saves a result produced elsewhere, e.g. in the Submit for Review dialog. */
  const remember = useCallback(
    (analysis, targetQuizId) => {
      if (!analysis?.analysis?.length) return;
      const stamped = { ...analysis, analyzedAt: analysis.analyzedAt || new Date().toISOString() };
      setResults(stamped);
      setSource("editor");
      persist(stamped, targetQuizId);
    },
    [persist],
  );

  /** Runs the classifier on the questions and saves the result. */
  const analyze = useCallback(
    async (questions, { targetQuizId, onBusy } = {}) => {
      setRunning(true);
      try {
        const analysis = await runExamAnalysis(targetQuizId || quizId, questions, {
          onBusy,
          previous: resultsRef.current,
        });
        setResults(analysis);
        setSource("editor");
        await persist(analysis, targetQuizId);
        return analysis;
      } finally {
        setRunning(false);
      }
    },
    [quizId, persist],
  );

  return { results, source, running, analyze, remember };
};
