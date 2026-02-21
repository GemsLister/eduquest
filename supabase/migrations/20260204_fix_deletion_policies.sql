-- COMPREHENSIVE FIX FOR DELETION ISSUES
-- This migration ensures all RLS policies are properly set up
-- Run this in Supabase SQL Editor if deletions aren't working

-- First, drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Instructors can delete their own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can update their own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can delete questions in their quizzes" ON public.questions;
DROP POLICY IF EXISTS "Instructors can update questions in their quizzes" ON public.questions;
DROP POLICY IF EXISTS "Instructors can insert questions in their quizzes" ON public.questions;

-- Now create the corrected policies

-- QUIZZES TABLE POLICIES
CREATE POLICY "Instructors can delete their own quizzes" ON public.quizzes
  FOR DELETE USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can update their own quizzes" ON public.quizzes
  FOR UPDATE USING (auth.uid() = instructor_id);

-- QUESTIONS TABLE POLICIES
CREATE POLICY "Instructors can delete questions in their quizzes" ON public.questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update questions in their quizzes" ON public.questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can insert questions in their quizzes" ON public.questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

-- Verify the policies exist
SELECT tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
AND (tablename = 'quizzes' OR tablename = 'questions')
ORDER BY tablename, policyname;
