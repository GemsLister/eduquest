# Database Schema Troubleshooting

## Issue: "column quiz_attempts.user_id does not exist"

## Root Cause
The database migrations haven't been applied yet, so the `user_id` column is missing from the `quiz_attempts` table.

## Solutions

### 1. Apply Database Migrations (Recommended)
Run the following migrations in order:

```bash
# Apply all pending migrations
npx supabase db push

# Or apply specific migrations
npx supabase migration up
```

### 2. Manual SQL Fix (If migrations fail)
Execute this SQL directly in your Supabase database:

```sql
-- Add user_id column to quiz_attempts
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL DEFAULT gen_random_uuid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add cognitive_level column to questions
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(20) DEFAULT 'LOTS' CHECK (cognitive_level IN ('HOTS', 'LOTS'));

-- Add is_archived column to questions
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_cognitive_level ON public.questions(cognitive_level);
CREATE INDEX IF NOT EXISTS idx_questions_is_archived ON public.questions(is_archived);
```

### 3. Verify Schema
Check that the columns exist:

```sql
-- Check quiz_attempts table structure
\d public.quiz_attempts

-- Check questions table structure  
\d public.questions

-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quiz_attempts' AND column_name = 'user_id';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'questions' AND column_name = 'cognitive_level';
```

## Migration Files Created

1. `20260405_add_is_archived_to_questions.sql` - Adds is_archived column
2. `20260405_add_cognitive_level_to_questions.sql` - Adds cognitive_level column  
3. `20260405_fix_quiz_attempts_user_id.sql` - Ensures user_id exists
4. `20260405_complete_database_fix.sql` - Complete fix in one file

## What Each Migration Does

### quiz_attempts table
- `user_id`: Links to auth.users (who took the quiz)
- Index on user_id for better performance

### questions table  
- `cognitive_level`: HOTS or LOTS categorization
- `is_archived`: Archive flag for question bank
- Indexes for filtering performance

### profiles table
- `is_instructor`: Distinguishes students from instructors

## Testing the Fix

After applying migrations:

1. **Test Question Bank**: 
   - Add questions with HOTS/LOTS selection
   - Verify questions appear in active list
   - Test cognitive level filtering

2. **Test Student Performance**:
   - Select section and quiz
   - Verify only students appear (not instructors)
   - Check cognitive domain analysis works

3. **Verify Data**:
   ```sql
   -- Check quiz attempts have user_id
   SELECT user_id, score, status FROM public.quiz_attempts LIMIT 5;
   
   -- Check questions have cognitive_level
   SELECT text, cognitive_level, is_archived FROM public.questions LIMIT 5;
   ```

## Common Issues

### Migration Not Applied
- Error: "column does not exist"
- Solution: Run `npx supabase db push`

### Permission Issues  
- Error: "permission denied"
- Solution: Check RLS policies and user permissions

### Relationship Issues
- Error: "relationship not found"
- Solution: Apply foreign key constraints in migrations

## Next Steps

1. Apply the complete database fix migration
2. Restart the web application
3. Test both Question Bank and Student Performance features
4. Verify all HOTS/LOTS functionality works

The database schema issue is the root cause of both the Question Bank and Student Performance problems. Once fixed, both features should work correctly.
