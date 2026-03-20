-- Fix public access to published quizzes via share token
-- This ensures quiz links work for all instructors

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Instructors can view their own quizzes" ON public.quizzes;

-- Create new policy that allows anyone to view published quizzes
CREATE POLICY "Anyone can view published quizzes" ON public.quizzes
  FOR SELECT USING (is_published = TRUE);

-- Keep instructor-specific access for their own quizzes (including drafts)
CREATE POLICY "Instructors can view all their quizzes" ON public.quizzes
  FOR SELECT USING (auth.uid() = instructor_id);

-- Update the insert policy to ensure it works properly
DROP POLICY IF EXISTS "Instructors can create quizzes" ON public.quizzes;
CREATE POLICY "Instructors can create quizzes" ON public.quizzes
  FOR INSERT WITH CHECK (auth.uid() = instructor_id);

-- Update the update policy
DROP POLICY IF EXISTS "Instructors can update their own quizzes" ON public.quizzes;
CREATE POLICY "Instructors can update their own quizzes" ON public.quizzes
  FOR UPDATE USING (auth.uid() = instructor_id);
