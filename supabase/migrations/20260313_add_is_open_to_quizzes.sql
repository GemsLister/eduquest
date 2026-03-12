-- Add is_open column to quizzes table
-- When true (default), students can access the quiz via share link
-- When false, the quiz link is blocked even if published
ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT true;
