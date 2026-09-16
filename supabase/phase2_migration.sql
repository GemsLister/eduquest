-- Phase 2 Migration: Add peer review, GAD, and AI tracking columns
-- Run this in the Supabase SQL Editor

-- 1. Add assigned_reviewer_id to quiz_analysis_submissions (F9 + X1)
ALTER TABLE quiz_analysis_submissions
  ADD COLUMN IF NOT EXISTS assigned_reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_analysis_submissions_reviewer 
  ON quiz_analysis_submissions(assigned_reviewer_id);

-- 2. Add GAD tagging to questions (A1)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS is_gad BOOLEAN DEFAULT false;

-- 3. Add AI contribution tracking to questions (G2)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS ai_revised BOOLEAN DEFAULT false;

-- 4. Row Level Security (RLS) Policies for Peer Reviewers
-- Drop existing select/update policies to update them with peer reviewer permissions
DROP POLICY IF EXISTS "Instructors can view own submissions" ON quiz_analysis_submissions;
DROP POLICY IF EXISTS "Assigned peer reviewers can view submissions" ON quiz_analysis_submissions;

-- Allow instructors to view:
-- a) Quizzes they submitted
-- b) Quizzes assigned to them as peer reviewers
-- c) Admins and Faculty Heads
CREATE POLICY "Assigned peer reviewers can view submissions"
ON quiz_analysis_submissions
FOR SELECT
TO authenticated
USING (
    auth.uid() = instructor_id
    OR auth.uid() = assigned_reviewer_id
    OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_faculty_head = true)
    )
);

-- Allow assigned peer reviewers and admins to update submissions (to request revision / forward to dept head)
DROP POLICY IF EXISTS "Admins can update submissions" ON quiz_analysis_submissions;
DROP POLICY IF EXISTS "Assigned peer reviewers can update submissions" ON quiz_analysis_submissions;

CREATE POLICY "Assigned peer reviewers can update submissions"
ON quiz_analysis_submissions
FOR UPDATE
TO authenticated
USING (
    auth.uid() = assigned_reviewer_id
    OR auth.uid() = instructor_id
    OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_faculty_head = true)
    )
);


-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('quiz_analysis_submissions', 'questions')
  AND column_name IN ('assigned_reviewer_id', 'is_gad', 'ai_generated', 'ai_revised')
ORDER BY table_name, column_name;

