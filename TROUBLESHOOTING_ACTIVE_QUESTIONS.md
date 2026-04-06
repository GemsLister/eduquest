# Troubleshooting: Why Can't See Active Questions

## Issue Identified
The active questions are not displaying because the `is_archived` column is missing from the `questions` table.

## Root Cause
1. The code in `useQuestionBank.jsx` filters questions based on `q.is_archived`
2. However, the `is_archived` column only exists in the `quizzes` table, not the `questions` table
3. This causes all questions to be filtered out, resulting in an empty active questions list

## Solution Applied

### 1. Database Migration
Created `20260405_add_is_archived_to_questions.sql` to add the missing column:
```sql
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
```

### 2. Updated Cognitive Level Migration
Modified `20260405_add_cognitive_level_to_questions.sql` to include both:
- `cognitive_level` column (HOTS/LOTS feature)
- `is_archived` column (fix for missing column)

### 3. Frontend Robustness
Updated the filtering logic in `useQuestionBank.jsx`:
```javascript
const active = dedupeQuestions(data?.filter((q) => !q.is_archived || q.is_archived === false) || []);
const archived = dedupeQuestions(data?.filter((q) => q.is_archived === true) || []);
```

### 4. Debug Logging
Added console logs to help diagnose:
- Fetched questions data
- Quiz IDs being used
- Active/archived question counts
- Filtered results

## Steps to Fix

### Immediate Fix (Frontend Only)
The frontend code has been updated to handle the missing `is_archived` column gracefully.

### Complete Fix (Database + Frontend)
1. Apply the database migration:
   ```bash
   npx supabase db push
   ```

2. Or apply manually to your database:
   ```sql
   ALTER TABLE public.questions
   ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
   
   ALTER TABLE public.questions
   ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(20) DEFAULT 'LOTS' 
   CHECK (cognitive_level IN ('HOTS', 'LOTS'));
   ```

3. Restart the web application

## Verification
After applying the fix:
1. Check browser console for debug logs
2. Verify active questions appear
3. Test HOTS/LOTS filtering functionality
4. Confirm question creation works

## Temporary Workaround
If you cannot apply database migrations immediately, the frontend code will now treat all questions as active (since `is_archived` will be `undefined` and the condition `!q.is_archived || q.is_archived === false` will be true).

## Files Modified
- `supabase/migrations/20260405_add_is_archived_to_questions.sql` (new)
- `supabase/migrations/20260405_add_cognitive_level_to_questions.sql` (updated)
- `apps/web/src/hooks/questionHook/useQuestionBank.jsx` (filtering logic + debug)
- `apps/web/src/pages/instructors/QuestionBank.jsx` (debug logs)
