-- Complete database fix for student performance analysis
-- This migration ensures all necessary columns and relationships exist

-- 1. Ensure user_id column exists in quiz_attempts table
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL DEFAULT gen_random_uuid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Ensure cognitive_level column exists in questions table
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(20) DEFAULT 'LOTS' CHECK (cognitive_level IN ('HOTS', 'LOTS'));

-- 3. Ensure is_archived column exists in questions table
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_cognitive_level ON public.questions(cognitive_level);
CREATE INDEX IF NOT EXISTS idx_questions_is_archived ON public.questions(is_archived);

-- 5. Add comments for documentation
COMMENT ON COLUMN public.quiz_attempts.user_id IS 'Reference to the user who made the quiz attempt';
COMMENT ON COLUMN public.questions.cognitive_level IS 'Cognitive level of the question: HOTS (Higher Order Thinking Skills) or LOTS (Lower Order Thinking Skills)';
COMMENT ON COLUMN public.questions.is_archived IS 'Flag to indicate if a question is archived (hidden from active question bank)';

-- 6. Ensure studentprofile table has the correct structure and relationship
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'studentprofile_user_id_fkey' 
        AND table_name = 'studentprofile'
    ) THEN
        ALTER TABLE public.studentprofile 
        ADD CONSTRAINT studentprofile_user_id_fkey 
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for studentprofile
CREATE INDEX IF NOT EXISTS idx_studentprofile_user_id ON public.studentprofile(id);

-- Add comment for documentation
COMMENT ON TABLE public.studentprofile IS 'Student profile information linked to auth.users';

-- 7. Update RLS policies if needed
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.quiz_attempts;
CREATE POLICY "Users can view their own attempts" ON public.quiz_attempts
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

-- 8. Enable RLS if not already enabled
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
