# Quiz Attempts Migration Fix

## Issue with Original Migration

The original migration had a logic error in the information_schema check. The condition was checking if the column exists to add it, but the logic was confusing.

## Original Problematic Code
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_attempts' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.quiz_attempts ADD COLUMN user_id UUID;
    END IF;
END $$;
```

**Issue**: The logic was adding the column only if it already exists, which is backwards.

## Corrected Logic

### 1. Proper Column Check
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'  -- Added table_schema
        AND table_name = 'quiz_attempts' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.quiz_attempts ADD COLUMN user_id UUID;
        RAISE NOTICE 'Added user_id column';
    ELSE
        RAISE NOTICE 'user_id column already exists';
    END IF;
END $$;
```

### 2. Step-by-Step Approach
The corrected migration breaks the process into clear steps:

1. **Add Column** (if missing)
2. **Drop Constraint** (if exists)
3. **Clean Invalid Data** (only if column exists)
4. **Add Constraint** (only if column exists)
5. **Make NOT NULL** (only if no NULL values)
6. **Create Index**
7. **Add Comment**

### 3. Better Error Handling
- Added `table_schema = 'public'` to ensure correct schema
- Added RAISE NOTICE for debugging
- Each step wrapped in separate DO blocks
- Conditional logic for each operation

## Key Fixes

### 1. Schema Specification
**Before**: `WHERE table_name = 'quiz_attempts'`
**After**: `WHERE table_schema = 'public' AND table_name = 'quiz_attempts'`

### 2. Conditional Operations
Each operation now checks if the column exists before attempting it:

```sql
-- Only clean data if column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public'
               AND table_name = 'quiz_attempts' 
               AND column_name = 'user_id') THEN
        DELETE FROM public.quiz_attempts 
        WHERE user_id IS NOT NULL 
        AND user_id NOT IN (SELECT id FROM auth.users);
    END IF;
END $$;
```

### 3. Safe NOT NULL Conversion
Only makes column NOT NULL if there are no NULL values:

```sql
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public'
               AND table_name = 'quiz_attempts' 
               AND column_name = 'user_id')
    AND NOT EXISTS (SELECT 1 FROM public.quiz_attempts WHERE user_id IS NULL LIMIT 1) THEN
        ALTER TABLE public.quiz_attempts ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;
```

## Testing the Fix

### 1. Apply Corrected Migration
```bash
npx supabase migration up 20260405_corrected_quiz_attempts_fix.sql
```

### 2. Verify Column Exists
```sql
-- Check if user_id column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'quiz_attempts'
AND column_name = 'user_id';
```

### 3. Verify Constraint Exists
```sql
-- Check if foreign key constraint was added
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint 
WHERE conname = 'quiz_attempts_user_id_fkey';
```

### 4. Test Data Integrity
```sql
-- Check for invalid user references
SELECT COUNT(*) as invalid_attempts
FROM public.quiz_attempts qa
LEFT JOIN auth.users u ON qa.user_id = u.id
WHERE u.id IS NULL;

-- Should return 0
```

## Alternative Simple Fix

If you want a simpler approach, just run this:

```sql
-- Simple approach - ignore if column exists
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS user_id UUID;

-- Drop and recreate constraint
ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;
ALTER TABLE public.quiz_attempts 
ADD CONSTRAINT quiz_attempts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Clean up invalid data
DELETE FROM public.quiz_attempts 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- Make NOT NULL (only if no invalid data)
ALTER TABLE public.quiz_attempts ALTER COLUMN user_id SET NOT NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
```

## Common Issues

### "column already exists"
- The migration should handle this gracefully
- If not, use the simple approach

### "constraint already exists"
- The `DROP CONSTRAINT IF EXISTS` should handle this
- Check constraint name carefully

### "permission denied"
- Ensure you have proper permissions
- Run as superuser if needed

## Benefits of Corrected Migration

1. **Better Debugging** - RAISE NOTICE statements
2. **Safer Operations** - Each step conditional
3. **Proper Schema** - Explicit schema specification
4. **Error Recovery** - Handles edge cases
5. **Performance** - Proper indexing

## Next Steps

1. **Apply corrected migration**
2. **Verify all operations completed**
3. **Test Student Performance Analysis**
4. **Monitor for any remaining issues**

The corrected migration provides a robust, step-by-step approach to fixing the quiz_attempts table structure and data integrity.
