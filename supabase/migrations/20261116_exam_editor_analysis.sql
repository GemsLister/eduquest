-- ============================================================
-- Keep each exam's latest Bloom's analysis for the exam editor
--
-- Until now the analysis only lived inside the "Submit for Review" dialog:
-- closing the dialog without submitting threw it away, and the editor never
-- showed which question had which Bloom's level. The editor now analyzes on
-- its own and shows the result on every question, so the latest analysis is
-- kept here per exam (one row, replaced on every analysis).
--
-- A separate table instead of a column on quizzes: published quizzes are
-- readable by anyone, and the student exam page loads quizzes(*), so a
-- column there would expose the analysis and make that page heavier.
--
-- Who may read: the exam's owner, Senior Faculty and Department Heads.
-- Who may write: the exam's owner (the only one who can edit the exam).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.quiz_editor_analysis (
  quiz_id     UUID PRIMARY KEY REFERENCES public.quizzes(id) ON DELETE CASCADE,
  -- Same shape as quiz_analysis_submissions.analysis_results:
  -- { analysis: [...], summary: {...}, gadAnalysis: [...] }, and each
  -- analysis item also carries a "fingerprint" of the question text and
  -- choices it was made from, so the editor can tell which questions
  -- changed afterwards.
  analysis    JSONB       NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  analyzed_by UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.quiz_editor_analysis ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.quiz_editor_analysis FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_editor_analysis TO authenticated;

DROP POLICY IF EXISTS "Editor analysis: owner and staff can read" ON public.quiz_editor_analysis;
CREATE POLICY "Editor analysis: owner and staff can read"
  ON public.quiz_editor_analysis
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.quizzes z WHERE z.id = quiz_id AND z.instructor_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND (COALESCE(p.is_admin, FALSE) OR COALESCE(p.is_faculty_head, FALSE))
    )
  );

DROP POLICY IF EXISTS "Editor analysis: owner can add" ON public.quiz_editor_analysis;
CREATE POLICY "Editor analysis: owner can add"
  ON public.quiz_editor_analysis
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes z WHERE z.id = quiz_id AND z.instructor_id = auth.uid()));

DROP POLICY IF EXISTS "Editor analysis: owner can replace" ON public.quiz_editor_analysis;
CREATE POLICY "Editor analysis: owner can replace"
  ON public.quiz_editor_analysis
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes z WHERE z.id = quiz_id AND z.instructor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes z WHERE z.id = quiz_id AND z.instructor_id = auth.uid()));

DROP POLICY IF EXISTS "Editor analysis: owner can remove" ON public.quiz_editor_analysis;
CREATE POLICY "Editor analysis: owner can remove"
  ON public.quiz_editor_analysis
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes z WHERE z.id = quiz_id AND z.instructor_id = auth.uid()));

COMMIT;
