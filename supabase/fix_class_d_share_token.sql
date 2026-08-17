-- ============================================================
-- Fix: Add Class D section to Database Management quiz with unique share token
-- Run this in Supabase Studio SQL Editor
-- ============================================================

-- First, let's find the quiz ID and Class D section ID
DO $$
DECLARE
  v_quiz_id UUID;
  v_class_d_section_id UUID;
  v_new_share_token VARCHAR(20);
  v_token_exists BOOLEAN := TRUE;
  v_attempts INT := 0;
  v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
BEGIN
  -- Get the Database Management quiz ID
  SELECT id INTO v_quiz_id
  FROM public.quizzes 
  WHERE title ILIKE '%DATABASE MANAGEMENT%'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_quiz_id IS NULL THEN
    RAISE NOTICE 'Quiz not found!';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Quiz ID: %', v_quiz_id;
  
  -- Get the Class D section ID
  SELECT id INTO v_class_d_section_id
  FROM public.sections 
  WHERE name ILIKE '%DATABASE MANAGEMENT%' AND name ILIKE '%CLASS D%';
  
  IF v_class_d_section_id IS NULL THEN
    RAISE NOTICE 'Class D section not found! Checking for any Class D section...';
    
    -- Try to find any Class D section
    SELECT id INTO v_class_d_section_id
    FROM public.sections 
    WHERE name ILIKE '%CLASS D%';
    
    IF v_class_d_section_id IS NULL THEN
      RAISE NOTICE 'No Class D section found at all!';
      RETURN;
    END IF;
  END IF;
  
  RAISE NOTICE 'Class D Section ID: %', v_class_d_section_id;
  
  -- Check if Class D is already assigned to this quiz
  IF EXISTS (
    SELECT 1 FROM public.quiz_sections 
    WHERE quiz_id = v_quiz_id AND section_id = v_class_d_section_id
  ) THEN
    RAISE NOTICE 'Class D is already assigned to this quiz. Generating new share token...';
    
    -- Generate a new unique share token
    WHILE v_token_exists AND v_attempts < 10 LOOP
      v_new_share_token := '';
      
      -- Generate 12-character random token
      FOR i IN 1..12 LOOP
        v_new_share_token := v_new_share_token || substring(v_chars, floor(random() * length(v_chars) + 1)::INT, 1);
      END LOOP;
      
      -- Check if token already exists
      v_token_exists := EXISTS (
        SELECT 1 FROM public.quizzes WHERE share_token = v_new_share_token
        UNION
        SELECT 1 FROM public.quiz_sections WHERE share_token = v_new_share_token
      );
      
      v_attempts := v_attempts + 1;
    END LOOP;
    
    -- Update the existing entry with new token
    UPDATE public.quiz_sections
    SET share_token = v_new_share_token
    WHERE quiz_id = v_quiz_id AND section_id = v_class_d_section_id;
    
    RAISE NOTICE 'Updated Class D share token to: %', v_new_share_token;
  ELSE
    RAISE NOTICE 'Class D is not assigned to this quiz. Adding it now...';
    
    -- Generate a unique share token
    WHILE v_token_exists AND v_attempts < 10 LOOP
      v_new_share_token := '';
      
      -- Generate 12-character random token
      FOR i IN 1..12 LOOP
        v_new_share_token := v_new_share_token || substring(v_chars, floor(random() * length(v_chars) + 1)::INT, 1);
      END LOOP;
      
      -- Check if token already exists
      v_token_exists := EXISTS (
        SELECT 1 FROM public.quizzes WHERE share_token = v_new_share_token
        UNION
        SELECT 1 FROM public.quiz_sections WHERE share_token = v_new_share_token
      );
      
      v_attempts := v_attempts + 1;
    END LOOP;
    
    -- Insert Class D into quiz_sections with the new token
    INSERT INTO public.quiz_sections (quiz_id, section_id, share_token)
    VALUES (v_quiz_id, v_class_d_section_id, v_new_share_token);
    
    RAISE NOTICE 'Added Class D to quiz with share token: %', v_new_share_token;
  END IF;
  
  -- Show the final result
  RAISE NOTICE '=== FINAL RESULT ===';
  RAISE NOTICE 'Class A token: (check database)';
  RAISE NOTICE 'Class D token: %', v_new_share_token;
END $$;

-- Verify the changes
SELECT 
  qs.id,
  qs.quiz_id,
  qs.section_id,
  qs.share_token as section_share_token,
  s.name as section_name
FROM public.quiz_sections qs
LEFT JOIN public.sections s ON s.id = qs.section_id
WHERE qs.quiz_id IN (
  SELECT id FROM public.quizzes WHERE title ILIKE '%DATABASE MANAGEMENT%'
)
ORDER BY s.name;
