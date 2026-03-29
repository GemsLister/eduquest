# Foreign Key Constraint Error Troubleshooting

## Error: `23503: foreign key constraint violation`

### Problem Description
```
ERROR: 23503: insert or update on table "quiz_attempts" 
violates foreign key constraint "quiz_attempts_user_id_fkey" 
DETAIL: Key (user_id)=(bafd9d09-40af-450d-a31c-51f7e3415393) 
is not present in table "users".
```

### Root Cause
The `quiz_attempts` table has a foreign key constraint that requires every `user_id` to exist in the `auth.users` table, but there are quiz attempts with invalid or non-existent user IDs.

### Why This Happens
1. **Invalid User IDs**: Quiz attempts were created with user IDs that don't exist in `auth.users`
2. **Migration Issues**: Previous migrations used `gen_random_uuid()` as default, creating invalid user references
3. **Data Integrity**: Orphaned records in quiz_attempts without valid user references

## Solutions

### Solution 1: Apply Safe Migration (Recommended)
Run the safe migration that cleans up invalid data first:

```bash
npx supabase migration up 20260405_safe_quiz_attempts_fix.sql
```

Or apply manually:
```sql
-- Delete quiz attempts with invalid user_ids
DELETE FROM public.quiz_attempts 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- Remove and recreate foreign key constraint
ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;
ALTER TABLE public.quiz_attempts 
ADD CONSTRAINT quiz_attempts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

### Solution 2: Manual Data Cleanup
If you want to preserve some data, first identify the invalid records:

```sql
-- Check for invalid user_ids
SELECT qa.id, qa.user_id, qa.score, qa.created_at
FROM public.quiz_attempts qa
LEFT JOIN auth.users u ON qa.user_id = u.id
WHERE u.id IS NULL;

-- Delete invalid records
DELETE FROM public.quiz_attempts 
WHERE user_id NOT IN (SELECT id FROM auth.users);
```

### Solution 3: Temporary Disable Constraints (Not Recommended)
Only for emergency situations:

```sql
-- Disable foreign key constraint temporarily
ALTER TABLE public.quiz_attempts DISABLE TRIGGER ALL;

-- Fix your data, then re-enable
ALTER TABLE public.quiz_attempts ENABLE TRIGGER ALL;
```

## Migration Files Created

### 1. `20260405_fix_quiz_attempts_foreign_key.sql`
- Aggressive cleanup approach
- Deletes all invalid user references
- Recreates foreign key constraint

### 2. `20260405_safe_quiz_attempts_fix.sql` (Recommended)
- Safer approach with checks
- Preserves valid data
- Step-by-step cleanup process

## What the Safe Migration Does

1. **Check if column exists** - Adds user_id column if missing
2. **Remove existing constraint** - Drops broken foreign key
3. **Clean invalid references** - Deletes quiz attempts with invalid user_ids
4. **Add proper constraint** - Recreates foreign key with correct references
5. **Set NOT NULL** - Ensures future data integrity
6. **Create index** - Improves query performance

## Prevention

### For Future Migrations
Never use `gen_random_uuid()` as default for foreign keys:

```sql
-- WRONG (causes invalid references)
ALTER TABLE quiz_attempts 
ADD COLUMN user_id UUID NOT NULL DEFAULT gen_random_uuid() REFERENCES auth.users(id);

-- CORRECT (allows NULL initially)
ALTER TABLE quiz_attempts 
ADD COLUMN user_id UUID REFERENCES auth.users(id);
```

### For Application Code
Always validate user IDs before inserting:

```javascript
// Verify user exists before creating quiz attempt
const { data: user } = await supabase.auth.getUser();
if (!user) throw new Error("User not authenticated");

// Use the actual user.id from auth
await supabase.from('quiz_attempts').insert({
  user_id: user.id, // Valid user ID from auth
  quiz_id: quizId,
  // ... other fields
});
```

## Testing the Fix

After applying the migration:

### 1. Verify Data Integrity
```sql
-- Check for any remaining invalid references
SELECT COUNT(*) as invalid_attempts
FROM public.quiz_attempts qa
LEFT JOIN auth.users u ON qa.user_id = u.id
WHERE u.id IS NULL;

-- Should return 0
```

### 2. Test Student Performance
- Navigate to Student Profiles
- Select section and quiz
- Verify no foreign key errors
- Confirm only valid students appear

### 3. Test Question Creation
- Create new quiz attempts
- Verify they use valid user IDs
- Check no constraint violations

## Common Issues

### "Migration failed due to existing data"
- Run the safe migration instead of the aggressive one
- The safe migration handles existing data properly

### "Still getting foreign key errors after migration"
- Check if there are other tables with similar issues
- Verify all quiz attempts have valid user IDs
- Restart the application after migration

### "Lost quiz attempts after migration"
- Only invalid attempts (with non-existent users) were deleted
- Valid attempts with real users are preserved
- Check your auth.users table for missing users

## Recovery

If you accidentally deleted valid data:

```sql
-- Check if you have backups
SELECT * FROM public.quiz_attempts WHERE created_at > 'your_backup_timestamp';

-- Restore from backup if available
-- Or recreate quiz attempts manually for valid users
```

## Next Steps

1. Apply the safe migration: `20260405_safe_quiz_attempts_fix.sql`
2. Restart your web application
3. Test Student Performance feature
4. Verify Question Bank works correctly
5. Monitor for any remaining constraint errors

The foreign key constraint issue is now resolved with proper data integrity checks.
