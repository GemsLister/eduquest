# Fix SQL Query Column Error

> **Workspace:** c:\Users\james\Documents\James\Programming\Capstone\eduquest

---

**User**

Failed to run sql query: ERROR:  42703: column q.order_index does not exist 
 LINE 33:     ORDER BY COALESCE(q.order_index, 0), q.created_at 
 
 can you help me to fix this?

**Assistant**

I found the issue. The error is in the migration file [20260725_quiz_questions_junction_table.sql](file:///c:/Users/james/Documents/James/Programming/Capstone/eduquest/supabase/migrations/20260725_quiz_questions_junction_table.sql#L31-L34) at line 33.

The problem: The backfill query references `q.order_index` where `q` is the `questions` table alias. However, the `order_index` column only exists on the **new** `quiz_questions` junction table, NOT on the original `questions` table. The `questions` table was never designed with an `order_index` column — that ordering was only introduced with the junction table.

Let me fix this:

Now let me check if there are other migration files, views, or stored procedures that might have the same issue — referencing `order_index` directly on the `questions` table instead of the `quiz_questions` junction table:

The fix looks good. No other SQL files have the problematic pattern. Now let me verify the migration can be applied successfully:

---

**User**

can you help me to fix fis this issue? 
 
 is quiz management, the each quiz displays total questions with numbers, but when i open it, there are no questions inside of it.

**Assistant**

Let me also check the Question Bank page to understand how questions are linked to quizzes via the junction table:

Now I understand the full picture of the bug. Let me update the todos and implement the fixes:

Now let me implement the fixes. First, let me fix the `loadQuiz` function in [InstructorQuiz.jsx](file:///c:/Users/james/Documents/James/Programming/Capstone/eduquest/apps/web/src/pages/instructors/InstructorQuiz.jsx#L178-L242) — the root cause is that it ONLY queries the legacy direct `questions.quiz_id` relationship without checking the `quiz_questions` junction table (unlike `PublicQuizPage.jsx`, `QuizResultDetail.jsx`, and `quizService.getQuestionsByQuiz` which all use the correct junction-first pattern). It also has no fallback for versioned parent quizzes.

Now let me fix the `handleSaveQuiz` function to also populate the `quiz_questions` junction table when creating new questions. Let me read the relevant sections:

Now let me add the junction table sync to `handleSaveQuiz`. I'll add a block after the `quiz_sections` sync that ensures all questions linked via `quiz_id` are also in the `quiz_questions` junction table:

Now let me create a fix-up migration that safely reapplies the junction table setup with the corrected backfill query and missing RLS policies (the original migration failed partway, so RLS policies might be missing):

OK, done na ang tanang fixes. Ania ang summary sa mga nahimong kausaban:

## Bug 1: SQL Error `column q.order_index does not exist`

**Root cause:** Sa backfill query sa junction table migration, gi-refer ang `q.order_index` sa `questions` table — pero ang `order_index` column naa ra sa bag-ong `quiz_questions` junction table, wala sa original `questions` table. Maong failed ang INSERT backfill ug empty ang junction table.

**Fix 1a:** Gi-update ang original migration nga backfill query:
[20260725_quiz_questions_junction_table.sql:31-34](file:///c:/Users/james/Documents/James/Programming/Capstone/eduquest/supabase/migrations/20260725_quiz_questions_junction_table.sql#L31-L34)
→ Gireplace ang `ORDER BY COALESCE(q.order_index, 0), q.created_at` ng simple nga `ORDER BY q.created_at, q.id` (stable ordering nga wala mag-depende sa non-existent column).

**Fix 1b:** Gimugna ang NEW idempotent fix-up migration nga mo-complete sa bisan unsa pa missing tungod sa failed original migration (backfill + indexes + RLS + policies, all with `IF NOT EXISTS` / `DROP IF EXISTS`):
[20260809_fix_quiz_questions_backfill.sql](file:///c:/Users/james/Documents/James/Programming/Capstone/eduquest/supabase/migrations/20260809_fix_quiz_questions_backfill.sql)

---

## Bug 2: Nagpakita og question count sa list pero empty ang quiz page

**Root cause:** Dili consistent ang data flow:
- ✅ Ang **quiz list count** (`useFetchInstructorQuizzes.jsx`) naggamit ug junction-first pattern: `quiz_questions` → direct `questions.quiz_id` → fallback sa `analysis_results` snapshot → fallback sa `parent_quiz_id` (versioned quizzes). Bisan asa pa gikan ang questions, ma-count sila.
- ❌ Pero ang **InstructorQuiz edit page** (`InstructorQuiz.jsx`) nag-direct query ra sa `questions.quiz_id` — wala siyay check sa `quiz_questions` junction table, ug wala siyay fallback sa parent quiz. So kung ang questions na-link pinaagi sa junction table (o naa sa parent quiz para sa versioned copies), 0 ang makita sa edit page bisag dako ang count sa list.
- Bonus issue: Walay nag-sync sa `quiz_questions` table every time mag-save or mag-import ug questions.

**Fix 2a:** Gi-overhaul ang `loadQuiz` function sa [InstructorQuiz.jsx:206-302](file:///c:/Users/james/Documents/James/Programming/Capstone/eduquest/apps/web/src/pages/instructors/InstructorQuiz.jsx#L206-L302) aron match ang count logic:
1. I-check una ang `quiz_questions` junction table (with `order_index` ordering + `is_archived` filter)
2. Kung empty, fallback sa direct `questions.quiz_id` query
3. Kung empty gihapon, sulayan ang `parent_quiz_id` (junction unya direct) para sa versioned quizzes
- Same pattern ni sa `quizService.getQuestionsByQuiz()`, `PublicQuizPage.jsx`, ug `QuizResultDetail.jsx`

**Fix 2b:** Gidugang ang junction table sync block sa `handleSaveQuiz` sa [InstructorQuiz.jsx:645-684](file:///c:/Users/james/Documents/James/Programming/Capstone/eduquest/apps/web/src/pages/instructors/InstructorQuiz.jsx#L645-L684). Every save, gikuha ang tanan questions para niining quiz (via direct `quiz_id`), gidelete ang old junction rows, ug gi-reinsert with sequential `order_index` based on `created_at` order. Dili na ma-out of sync ang junction table.

**Fix 2c:** Same junction sync gidugang sa `handleImportToQuiz` sa [QuestionBank.jsx:461-500](file:///c:/Users/james/Documents/James/Programming/Capstone/eduquest/apps/web/src/pages/instructors/QuestionBank.jsx#L461-L500). Every import from Question Bank, na-sync na usab sa `quiz_questions`.

---

## Next steps para sa imoha:

1. **Run ang new fix-up migration** sa Supabase: `supabase/migrations/20260809_fix_quiz_questions_backfill.sql` (kini ang mo-populate sa `quiz_questions` junction table para sa existing questions ug i-enable ang RLS/policies).
2. Open any quiz — dapat makita na ang questions sulod!
3. Kung mag-save ka ug quiz o mag-import gikan sa Question Bank, automatic na na-sync sa junction table.

---

**User**

dili ba maapektohan akong daan nga table ani? 
 
 Potential issue detected 
 This query includes destructive operations. It may permanently change or remove data, tables, schemas, or other objects. 
 
 Run this query only if you intend these changes and understand the risks.

**Assistant**

Good question — **dili maapektohan ang imong daan nga data** sa `questions`, `quizzes`, `quiz_attempts`, `quiz_responses`, etc.

Let me walk you through each part sa [20260809_fix_quiz_questions_backfill.sql](file:///c:/Users/james/Documents/James/Programming/Capstone/eduquest/supabase/migrations/20260809_fix_quiz_questions_backfill.sql) para klaro kung unsay "destructive" ug ngano safe ra ni:

| Operation | Ngano "destructive" | Impact sa daan data |
|---|---|---|
| `ALTER TABLE questions ALTER COLUMN quiz_id DROP NOT NULL` | Modifies column constraint | ✅ Safe — gina-allow lang nga `quiz_id` mahimong `NULL` para sa standalone bank questions. Wala ni nag-delete ug bisan unsang existing row. |
| `CREATE TABLE IF NOT EXISTS quiz_questions` | — | ✅ Safe — only creates if wala pa. |
| `CREATE INDEX IF NOT EXISTS ...` | — | ✅ Safe — idempotent, mo-skip kung naa na. |
| `INSERT INTO quiz_questions ... ON CONFLICT DO NOTHING` | — | ✅ Safe — mo-backfill ra ug rows para sa mga existing `questions` nga naay `quiz_id`. If naa na ang pair, `DO NOTHING` (dili ma-duplicate). **Wala ni nag-modify sa `questions` table.** |
| `ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY` | — | ✅ Safe — sa `quiz_questions` table ra, dili sa imong uban tables. |
| `DROP POLICY IF EXISTS "..." ON quiz_questions` | ⚠️ Warning trigger | ✅ Safe — **ONLY sa `quiz_questions` table policies** (dili sa `questions`, `quizzes`, etc.). Gidrop lang ang existing policies on this specific junction table aron ma-recreate namo og limpyo. Kung wala pa ni sila before, ang `IF EXISTS` mo-skip ra. |
| `CREATE POLICY ... ON quiz_questions` | — | ✅ Safe — RLS policies for the junction table ra. |

**Summary:** Ang TANANG "destructive" operations LIMITADO RA SA `quiz_questions` JUNCTION TABLE ug sa column constraint sa `questions.quiz_id` (na-change ra gikan NOT NULL → NULLABLE).

- ❌ **Wala ni mag-DELETE ug rows sa** `questions`, `quizzes`, `quiz_attempts`, `quiz_responses`, `sections`, etc.
- ❌ **Wala ni mag-DROP ug tables** gawas sa policies (not tables).
- ❌ **Wala ni mag-modify sa existing column values** (gawas sa constraint lang na nullable).

---

### Gusto ba nimo ako na ang mo-apply ani sa imong Supabase database?

Kung OK ra, mo-run ko ani pinaagi sa `supabase_apply_migration` tool para dili na nimo i-copy-paste sa SQL Editor. Confirmed lang kung proceed na. 🚀

---

**User**

ngano ing ani man japon?

**Assistant**

The reason ngano ingani japon is because **the code changes I made to InstructorQuiz.jsx haven't been applied to your running browser yet**, AND **the fix-up migration hasn't been run yet** to populate the empty `quiz_questions` junction table in the database.

Let me verify the current state by applying the migration first, then we'll confirm the frontend:

---

**User**

humana kog connect

**Assistant**

OK, connected na ang Supabase project. Let me first check ang current state sa database para atong ma-diagnose kung ngano nagpakita gihapon og 0 questions, then i-apply ang fix-up migration.

Ang issue kay **duha ka butang** nga nag-combine:

**Root cause (why count=5, display=0):**
- Ang **count** (5 questions) naggikan sa Fallback 1 sa `useFetchInstructorQuizzes` — ang `analysis_results` JSONB snapshot sa `quiz_analysis_submissions` table. Kani mao ang "Pending" badge nga submission para sa admin review. Sa dihang gi-submit niyo ni for review, gi-snapshot ang 5 questions from browser memory papunta sa JSONB — pero **ang actual nga question rows sa `questions` table WALA (or na-archive/na-delete)**, maong 0 ang makita sa edit page.
- Dugang pa: **akong gi-edit na code sa `InstructorQuiz.jsx` wala pa na-pick up sa browser** (need i-restart ang dev server kay HMR dili mo-handle og maayo ang dako nga function rewrite), ug ang `quiz_questions` junction table sa database EMPTY pa tungod sa failed original migration.

---

### Step 1: I-restart ang dev server (CRITICAL)
Close ang current running `npm run dev` / `npm run dev:web` terminal, then run again:
```
npm run dev:web
```
(Para masiguro nga bag-ong JS ang gi-load — akong gi-rewrite ang tibuok `loadQuiz` function, HMR dili reliably mo-refresh niana kadaku na change.)

---

### Step 2: I-run ang fix-up migration sa Supabase SQL Editor
Tungod kay ang MCP Supabase integration error (invalid project ref), **kamo na lang i-paste ni sa Supabase Dashboard → SQL Editor → New Query**, then click **Run**:

```sql
-- ============================================================
-- Fix-up: quiz_questions backfill + RLS (SAFE - IDempotent)
-- ============================================================

-- 1) Ensure quiz_id nullable on questions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions'
      AND column_name = 'quiz_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.questions ALTER COLUMN quiz_id DROP NOT NULL;
  END IF;
END $$;

-- 2) Create junction table if missing
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(quiz_id, question_id)
);

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_question_id ON public.quiz_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON public.quiz_questions(quiz_id, order_index);

-- 4) BACKFILL existing questions.quiz_id → junction table
INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, created_at)
SELECT
  q.quiz_id,
  q.id AS question_id,
  ROW_NUMBER() OVER (
    PARTITION BY q.quiz_id ORDER BY q.created_at, q.id
  ) - 1 AS order_index,
  NOW()
FROM public.questions q
WHERE q.quiz_id IS NOT NULL
ON CONFLICT (quiz_id, question_id) DO NOTHING;

-- 5) RLS + Policies
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view quiz questions they have access to" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can manage quiz questions for their own quizzes" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can update quiz question order" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can delete quiz questions" ON public.quiz_questions;

CREATE POLICY "Users can view quiz questions they have access to" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes qz
      WHERE qz.id = quiz_id
      AND (qz.instructor_id = auth.uid() OR qz.is_published = TRUE)
    )
  );

CREATE POLICY "Instructors can manage quiz questions for their own quizzes" ON public.quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes qz
      WHERE qz.id = quiz_id AND qz.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update quiz question order" ON public.quiz_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes qz
      WHERE qz.id = quiz_id AND qz.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete quiz questions" ON public.quiz_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes qz
      WHERE qz.id = quiz_id AND qz.instructor_id = auth.uid()
    )
  );
```

Nindot ni kay **fully idempotent** — safe i-run bisag pila ka times, dili mag-duplicate. Walay data loss sa imong `questions` / `quizzes` tables, junction table ra ang gi-touch.

---

### Step 3: Pagkahuman sa steps 1 ug 2
1. **Hard refresh** ang browser (`Ctrl+Shift+R` / `Ctrl+F5`) para klaro ang cache
2. Abli ang "sdfsdf" quiz → i-click ang **Save as Draft** (usa ka click lang). Akong bag-ong code sa `handleSaveQuiz` (lines [645-684](file:///c:/Users/james/Documents/James/Programming/Capstone/eduquest/apps/web/src/pages/instructors/InstructorQuiz.jsx#L645-L684)) mo-sync sa junction table base sa direct `quiz_id` questions, plus mag-refresh ang page to `/instructor-dashboard/quizzes`.
3. Balik abli ang quiz → dapat makita na ang mga questions.

---

### IMPORTANT: Kung 0 gihapon ang questions after step 3
Kana nagpasabot nga ang actual question rows **tinuod na gyud nga wala sa database** (na-delete na o na-archive na tanan). Ang "5 Questions" count gikan ra sa snapshot sa admin review submission — dili na actual rows.

Solution para niini nga edge case: **Akong i-add ang LAST FINAL FALLBACK sa `loadQuiz` — if empty ang DB pero naay `analysis_results` snapshot, i-restore ang questions gikan sa snapshot** para makita pud niyo ug ma-save balik as real rows. Gusto ba niyo ako na himoon ni karon? 🛠️

---

