-- Diagnostic check to see what data exists in quiz_attempts and quiz_responses

-- This migration will NOT delete or modify any existing data
-- It only creates diagnostic views to help identify what happened

-- Create diagnostic view for quiz_attempts
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

-- Create diagnostic view for quiz_responses  
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

-- Check if tables exist and have data
DO $$
BEGIN
    RAISE NOTICE '=== DIAGNOSTIC CHECK ===';
    
    -- Check quiz_attempts table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_attempts') THEN
        PERFORM dblink_connect('temp_conn', 'dbname=postgres user=postgres');
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
                RAISE NOTICE 'quiz_attempts contains data';
            END IF;
        END;
    ELSE
        RAISE NOTICE 'ERROR: quiz_attempts table does not exist!';
    END IF;
    
    -- Check quiz_responses table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_responses') THEN
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
                RAISE NOTICE 'quiz_responses contains data';
            END IF;
        END;
    ELSE
        RAISE NOTICE 'ERROR: quiz_responses table does not exist!';
    END IF;
    
    RAISE NOTICE '=== END DIAGNOSTIC ===';
END $$;

-- Create a backup table if data exists (safety measure)
CREATE TABLE IF NOT EXISTS public.quiz_attempts_backup AS 
SELECT * FROM public.quiz_attempts WHERE 1=0;

CREATE TABLE IF NOT EXISTS public.quiz_responses_backup AS 
SELECT * FROM public.quiz_responses WHERE 1=0;

-- If original tables have data, copy to backup
DO $$
BEGIN
    -- Backup quiz_attempts if it has data
    IF EXISTS (SELECT 1 FROM public.quiz_attempts LIMIT 1) THEN
        RAISE NOTICE 'Creating backup of quiz_attempts...';
        DELETE FROM public.quiz_attempts_backup;
        INSERT INTO public.quiz_attempts_backup SELECT * FROM public.quiz_attempts;
        RAISE NOTICE 'quiz_attempts backed up successfully';
    END IF;
    
    -- Backup quiz_responses if it has data  
    IF EXISTS (SELECT 1 FROM public.quiz_responses LIMIT 1) THEN
        RAISE NOTICE 'Creating backup of quiz_responses...';
        DELETE FROM public.quiz_responses_backup;
        INSERT INTO public.quiz_responses_backup SELECT * FROM public.quiz_responses;
        RAISE NOTICE 'quiz_responses backed up successfully';
    END IF;
END $$;
