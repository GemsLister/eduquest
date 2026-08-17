-- Add section-specific share tokens to quiz_sections table
-- This allows each section to have its own unique share code for the same quiz

-- Add share_token column to quiz_sections
ALTER TABLE public.quiz_sections
ADD COLUMN IF NOT EXISTS share_token VARCHAR(20) UNIQUE;

-- Create index for share_token lookups
CREATE INDEX IF NOT EXISTS idx_quiz_sections_share_token ON public.quiz_sections(share_token);

-- Add a function to generate a unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS VARCHAR(20)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token VARCHAR(20);
  v_attempts INT := 0;
  v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
BEGIN
  -- Try to generate a unique token (max 10 attempts)
  WHILE v_attempts < 10 LOOP
    v_token := '';
    
    -- Generate 12-character random token
    FOR i IN 1..12 LOOP
      v_token := v_token || substring(v_chars, floor(random() * length(v_chars) + 1)::INT, 1);
    END LOOP;
    
    -- Check if token already exists in either quizzes or quiz_sections
    IF NOT EXISTS (
      SELECT 1 FROM public.quizzes WHERE share_token = v_token
      UNION
      SELECT 1 FROM public.quiz_sections WHERE share_token = v_token
    ) THEN
      RETURN v_token;
    END IF;
    
    v_attempts := v_attempts + 1;
  END LOOP;
  
  -- Fallback to timestamp-based token if random generation fails
  v_token := upper(substring(md5(extract(epoch from now())::text || random()::text), 1, 12));
  RETURN v_token;
END;
$$;

-- Add a function to auto-generate share token for quiz_sections
CREATE OR REPLACE FUNCTION auto_generate_section_share_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.share_token IS NULL OR NEW.share_token = '' THEN
    NEW.share_token := generate_share_token();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate share tokens
DROP TRIGGER IF EXISTS on_quiz_sections_insert ON public.quiz_sections;
CREATE TRIGGER on_quiz_sections_insert
  BEFORE INSERT ON public.quiz_sections
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_section_share_token();

-- Backfill existing quiz_sections with share tokens
UPDATE public.quiz_sections
SET share_token = generate_share_token()
WHERE share_token IS NULL OR share_token = '';

-- Update RLS policies to allow public access to quiz_sections via share_token
DROP POLICY IF EXISTS "Users can view quiz sections for accessible quizzes" ON public.quiz_sections;

CREATE POLICY "Users can view quiz sections for accessible quizzes" ON public.quiz_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        -- Own quizzes
        q.instructor_id = auth.uid()
        OR
        -- Published quizzes
        q.is_published = TRUE
        OR
        -- Quizzes from co-instructors in the same subject
        EXISTS (
          SELECT 1 FROM public.instructor_subjects iss1
          WHERE iss1.instructor_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.instructor_subjects iss2
            WHERE iss2.instructor_id = q.instructor_id
            AND iss2.subject_id = iss1.subject_id
          )
        )
      )
    )
    OR
    -- Allow access via share_token (for public quiz access)
    share_token IS NOT NULL
  );

-- Add a function to manually generate share tokens for all sections of a quiz
CREATE OR REPLACE FUNCTION generate_share_tokens_for_quiz(p_quiz_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Update all quiz_sections for this quiz that don't have share tokens
  UPDATE public.quiz_sections
  SET share_token = generate_share_token()
  WHERE quiz_id = p_quiz_id 
  AND (share_token IS NULL OR share_token = '');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;