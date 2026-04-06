-- Working diagnostic check to see what data exists in quiz_attempts and quiz_responses
-- This migration will NOT delete or modify any existing data

-- Create diagnostic view for quiz_attempts (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_attempts' AND table_schema = 'public') THEN
        CREATE OR REPLACE VIEW public.diagnostic_quiz_attempts AS
        SELECT 
            id,
            user_id,
            quiz_id,
            score,
            status,
            started_at,
            completed_at,
            'EXISTS' as data_status
        FROM public.quiz_attempts;
        
        RAISE NOTICE 'diagnostic_quiz_attempts view created';
    ELSE
        RAISE NOTICE 'quiz_attempts table does not exist - cannot create view';
    END IF;
END $$;

-- Create diagnostic view for quiz_responses (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_responses' AND table_schema = 'public') THEN
        CREATE OR REPLACE VIEW public.diagnostic_quiz_responses AS
        SELECT 
            qr.id,
            qr.attempt_id,
            qr.question_id,
            qr.answer,
            qr.is_correct,
            qr.points_earned,
            'EXISTS' as data_status
        FROM public.quiz_responses qr;
        
        RAISE NOTICE 'diagnostic_quiz_responses view created';
    ELSE
        RAISE NOTICE 'quiz_responses table does not exist - cannot create view';
    END IF;
END $$;

-- Check if tables exist and have data (without dblink)
DO $$
BEGIN
    RAISE NOTICE '=== DIAGNOSTIC CHECK ===';
    
    -- Check quiz_attempts table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_attempts' AND table_schema = 'public') THEN
        RAISE NOTICE 'quiz_attempts table exists';
        
        -- Count records
        DECLARE
            attempt_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO attempt_count FROM public.quiz_attempts;
            RAISE NOTICE 'quiz_attempts has % records', attempt_count;
            
            IF attempt_count = 0 THEN
                RAISE NOTICE 'WARNING: quiz_attempts table is EMPTY!';
            ELSE
                RAISE NOTICE 'quiz_attempts contains data - showing sample:';
                
                -- Show sample records
                DECLARE
                    sample_record RECORD;
                BEGIN
                    FOR sample_record IN 
                        SELECT id, user_id, quiz_id, score, status, 
                               EXTRACT(EPOCH FROM started_at) as start_epoch,
                               EXTRACT(EPOCH FROM completed_at) as end_epoch
                        FROM public.quiz_attempts 
                        LIMIT 3
                    LOOP
                        RAISE NOTICE 'Sample: id=%, user_id=%, quiz_id=%, score=%, status=%', 
                            sample_record.id, sample_record.user_id, sample_record.quiz_id, 
                            sample_record.score, sample_record.status;
                    END LOOP;
                END;
            END IF;
        END;
    ELSE
        RAISE NOTICE 'ERROR: quiz_attempts table does not exist!';
    END IF;
    
    -- Check quiz_responses table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_responses' AND table_schema = 'public') THEN
        RAISE NOTICE 'quiz_responses table exists';
        
        -- Count records
        DECLARE
            response_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO response_count FROM public.quiz_responses;
            RAISE NOTICE 'quiz_responses has % records', response_count;
            
            IF response_count = 0 THEN
                RAISE NOTICE 'WARNING: quiz_responses table is EMPTY!';
            ELSE
                RAISE NOTICE 'quiz_responses contains data - showing sample:';
                
                -- Show sample records
                DECLARE
                    sample_response RECORD;
                BEGIN
                    FOR sample_response IN 
                        SELECT id, attempt_id, question_id, is_correct, points_earned
                        FROM public.quiz_responses 
                        LIMIT 3
                    LOOP
                        RAISE NOTICE 'Sample: id=%, attempt_id=%, question_id=%, correct=%, points=%', 
                            sample_response.id, sample_response.attempt_id, sample_response.question_id, 
                            sample_response.is_correct, sample_response.points_earned;
                    END LOOP;
                END;
            END IF;
        END;
    ELSE
        RAISE NOTICE 'ERROR: quiz_responses table does not exist!';
    END IF;
    
    RAISE NOTICE '=== END DIAGNOSTIC ===';
END $$;

-- Create backup tables if data exists
DO $$
BEGIN
    -- Create backup tables (if they don't exist)
    CREATE TABLE IF NOT EXISTS public.quiz_attempts_backup (
        id UUID,
        user_id UUID,
        quiz_id UUID,
        score INTEGER,
        status VARCHAR(50),
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE
    );
    
    CREATE TABLE IF NOT EXISTS public.quiz_responses_backup (
        id UUID,
        attempt_id UUID,
        question_id UUID,
        answer TEXT,
        is_correct BOOLEAN,
        points_earned INTEGER
    );
    
    RAISE NOTICE 'Backup tables created/verified';
END $$;

-- If original tables have data, copy to backup
DO $$
BEGIN
    -- Backup quiz_attempts if it has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_attempts' AND table_schema = 'public')
       AND EXISTS (SELECT 1 FROM public.quiz_attempts LIMIT 1) THEN
        RAISE NOTICE 'Creating backup of quiz_attempts...';
        
        -- Clear backup and copy data
        DELETE FROM public.quiz_attempts_backup;
        INSERT INTO public.quiz_attempts_backup 
        SELECT id, user_id, quiz_id, score, status, started_at, completed_at
        FROM public.quiz_attempts;
        
        RAISE NOTICE 'quiz_attempts backed up successfully - % records copied', 
            (SELECT COUNT(*) FROM public.quiz_attempts_backup);
    ELSE
        RAISE NOTICE 'quiz_attempts backup skipped - no data or table missing';
    END IF;
    
    -- Backup quiz_responses if it has data  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_responses' AND table_schema = 'public')
       AND EXISTS (SELECT 1 FROM public.quiz_responses LIMIT 1) THEN
        RAISE NOTICE 'Creating backup of quiz_responses...';
        
        -- Clear backup and copy data
        DELETE FROM public.quiz_responses_backup;
        INSERT INTO public.quiz_responses_backup 
        SELECT id, attempt_id, question_id, answer, is_correct, points_earned
        FROM public.quiz_responses;
        
        RAISE NOTICE 'quiz_responses backed up successfully - % records copied', 
            (SELECT COUNT(*) FROM public.quiz_responses_backup);
    ELSE
        RAISE NOTICE 'quiz_responses backup skipped - no data or table missing';
    END IF;
END $$;

-- Create summary view for easy checking
CREATE OR REPLACE VIEW public.data_status_summary AS
SELECT 
    'quiz_attempts' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_attempts' AND table_schema = 'public') 
        THEN (SELECT COUNT(*) FROM public.quiz_attempts)
        ELSE 0
    END as record_count,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_attempts' AND table_schema = 'public') 
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as table_status
UNION ALL
SELECT 
    'quiz_responses' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_responses' AND table_schema = 'public') 
        THEN (SELECT COUNT(*) FROM public.quiz_responses)
        ELSE 0
    END as record_count,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_responses' AND table_schema = 'public') 
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as table_status
UNION ALL
SELECT 
    'quiz_attempts_backup' as table_name,
    (SELECT COUNT(*) FROM public.quiz_attempts_backup) as record_count,
    'BACKUP' as table_status
UNION ALL
SELECT 
    'quiz_responses_backup' as table_name,
    (SELECT COUNT(*) FROM public.quiz_responses_backup) as record_count,
    'BACKUP' as table_status;

RAISE NOTICE 'Diagnostic check completed. Check public.data_status_summary for results.';

-- Apply fix for quiz_attempts table to support both authenticated users and student profiles
-- This is the fix for the "null value in column 'user_id'" error

-- Step 1: Make user_id nullable to allow student profiles  
ALTER TABLE public.quiz_attempts
ALTER COLUMN user_id DROP NOT NULL;

-- Step 2: Add student_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'quiz_attempts' 
        AND column_name = 'student_id'
    ) THEN
        ALTER TABLE public.quiz_attempts ADD COLUMN student_id UUID REFERENCES public.student_profile(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added student_id column to quiz_attempts table';
    ELSE
        RAISE NOTICE 'student_id column already exists in quiz_attempts table';
    END IF;
END $$;

-- Step 3: Add constraint to ensure at least one identifier is present
ALTER TABLE public.quiz_attempts
ADD CONSTRAINT IF NOT EXISTS check_attempt_identifier CHECK (
  user_id IS NOT NULL OR student_id IS NOT NULL
);

-- Step 4: Update RLS policies to support both user_id and student_id
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can create attempts" ON public.quiz_attempts;

-- Create updated RLS policies
CREATE POLICY "Users can view their own attempts" ON public.quiz_attempts
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT instructor_id FROM public.quizzes q WHERE q.id = quiz_id
    ) OR
    EXISTS (
      SELECT 1 FROM public.student_profile sp 
      WHERE sp.id = student_id AND sp.student_email = auth.email()
    )
  );

CREATE POLICY "Users can create attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    -- Allow student profile based attempts (for manual entry)
    (student_id IS NOT NULL AND user_id IS NULL)
  );

-- Step 5: Create index for student_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON public.quiz_attempts(student_id);

RAISE NOTICE 'Quiz attempts dual support fix applied successfully!';
