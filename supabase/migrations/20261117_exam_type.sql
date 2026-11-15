-- ============================================================
-- Type of examination: Midterm or Final
--
-- Chosen when the exam is created (and editable in the exam editor until it
-- is submitted). The TOS (Table of Specifications) PDF ticks the matching
-- "Type of Examination" box (Mid-Term / Final-Term), which used to be left
-- blank. Revision copies and new versions keep the type.
--
-- NULL = not chosen (exams created before this change); the editor asks for
-- it before the exam can be submitted for review.
-- ============================================================

BEGIN;

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS exam_type TEXT;

ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_exam_type_check;
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_exam_type_check CHECK (exam_type IS NULL OR exam_type IN ('midterm', 'final'));

COMMENT ON COLUMN public.quizzes.exam_type IS
  'Type of examination: midterm or final. Ticked on the TOS PDF.';

COMMIT;
