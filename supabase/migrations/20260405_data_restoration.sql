-- Data Restoration Migration
-- This will help restore quiz_attempts and quiz_responses if they were accidentally deleted

-- Step 1: Check if backup tables have data
DO $$
BEGIN
    RAISE NOTICE '=== DATA RESTORATION CHECK ===';
    
    -- Check quiz_attempts_backup
    DECLARE
        backup_attempt_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO backup_attempt_count FROM public.quiz_attempts_backup;
        RAISE NOTICE 'quiz_attempts_backup has % records', backup_attempt_count;
        
        IF backup_attempt_count > 0 THEN
            RAISE NOTICE 'Found data in quiz_attempts_backup, preparing to restore...';
            
            -- Check if main table is empty
            DECLARE
                main_attempt_count INTEGER;
            BEGIN
                SELECT COUNT(*) INTO main_attempt_count FROM public.quiz_attempts;
                RAISE NOTICE 'quiz_attempts has % records', main_attempt_count;
                
                IF main_attempt_count = 0 THEN
                    RAISE NOTICE 'Restoring quiz_attempts from backup...';
                    INSERT INTO public.quiz_attempts SELECT * FROM public.quiz_attempts_backup;
                    RAISE NOTICE 'quiz_attempts restored successfully!';
                ELSE
                    RAISE NOTICE 'quiz_attempts already has data, skipping restore';
                END IF;
            END;
        ELSE
            RAISE NOTICE 'No data found in quiz_attempts_backup';
        END IF;
    END;
    
    -- Check quiz_responses_backup
    DECLARE
        backup_response_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO backup_response_count FROM public.quiz_responses_backup;
        RAISE NOTICE 'quiz_responses_backup has % records', backup_response_count;
        
        IF backup_response_count > 0 THEN
            RAISE NOTICE 'Found data in quiz_responses_backup, preparing to restore...';
            
            -- Check if main table is empty
            DECLARE
                main_response_count INTEGER;
            BEGIN
                SELECT COUNT(*) INTO main_response_count FROM public.quiz_responses;
                RAISE NOTICE 'quiz_responses has % records', main_response_count;
                
                IF main_response_count = 0 THEN
                    RAISE NOTICE 'Restoring quiz_responses from backup...';
                    INSERT INTO public.quiz_responses SELECT * FROM public.quiz_responses_backup;
                    RAISE NOTICE 'quiz_responses restored successfully!';
                ELSE
                    RAISE NOTICE 'quiz_responses already has data, skipping restore';
                END IF;
            END;
        ELSE
            RAISE NOTICE 'No data found in quiz_responses_backup';
        END IF;
    END;
    
    RAISE NOTICE '=== END RESTORATION CHECK ===';
END $$;

-- Step 2: Create summary view of current data state
CREATE OR REPLACE VIEW public.data_recovery_summary AS
SELECT 
    'quiz_attempts' as table_name,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'EMPTY - NEEDS RESTORATION'
        WHEN COUNT(*) > 0 THEN 'HAS DATA'
    END as status
FROM public.quiz_attempts
UNION ALL
SELECT 
    'quiz_responses' as table_name,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'EMPTY - NEEDS RESTORATION'
        WHEN COUNT(*) > 0 THEN 'HAS DATA'
    END as status
FROM public.quiz_responses
UNION ALL
SELECT 
    'quiz_attempts_backup' as table_name,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'NO BACKUP'
        WHEN COUNT(*) > 0 THEN 'BACKUP AVAILABLE'
    END as status
FROM public.quiz_attempts_backup
UNION ALL
SELECT 
    'quiz_responses_backup' as table_name,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'NO BACKUP'
        WHEN COUNT(*) > 0 THEN 'BACKUP AVAILABLE'
    END as status
FROM public.quiz_responses_backup;

-- Step 3: If no backup exists, create placeholder structure for manual restoration
DO $$
BEGIN
    -- Check if we need to create sample data for testing
    DECLARE
        attempt_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO attempt_count FROM public.quiz_attempts;
        
        IF attempt_count = 0 THEN
            RAISE NOTICE 'Creating sample structure for manual data entry...';
            
            -- Insert a sample attempt to verify structure
            INSERT INTO public.quiz_attempts (id, quiz_id, user_id, score, status, started_at, completed_at)
            VALUES (
                gen_random_uuid(),
                (SELECT id FROM public.quizzes LIMIT 1),
                (SELECT id FROM public.studentprofile LIMIT 1),
                85,
                'completed',
                NOW(),
                NOW()
            ) ON CONFLICT (id) DO NOTHING;
            
            RAISE NOTICE 'Sample quiz_attempts record created for structure verification';
        END IF;
    END;
END $$;
