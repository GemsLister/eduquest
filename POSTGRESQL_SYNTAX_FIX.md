# PostgreSQL Syntax Error Fix

## Error: `42601: syntax error at or near "NOT"`

### Problem
```
ERROR: 42601: syntax error at or near "NOT"
LINE 11: ADD CONSTRAINT IF NOT EXISTS studentprofile_user_id_fkey ^
```

### Root Cause
PostgreSQL does **not** support the `ADD CONSTRAINT IF NOT EXISTS` syntax. This is a common misconception as PostgreSQL supports `IF NOT EXISTS` for many operations but not for constraints.

### Incorrect Syntax
```sql
-- This does NOT work in PostgreSQL
ALTER TABLE public.studentprofile 
ADD CONSTRAINT IF NOT EXISTS studentprofile_user_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

### Correct Syntax
Use a `DO` block with conditional logic:

```sql
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
```

## Fixed Migration Files

### 1. `20260405_fix_studentprofile_constraint.sql`
Simple fix that only addresses the syntax error.

### 2. Updated `20260405_fix_studentprofile_references.sql`
Now uses the correct `DO` block syntax.

### 3. Updated `20260405_complete_database_fix.sql`
Updated to use proper PostgreSQL syntax.

## Alternative Solutions

### Option 1: Ignore Error (Quick Fix)
```sql
-- Just try to add the constraint, ignore if it exists
ALTER TABLE public.studentprofile 
ADD CONSTRAINT studentprofile_user_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

### Option 2: Drop and Recreate
```sql
-- Drop existing constraint if it exists, then recreate
ALTER TABLE public.studentprofile 
DROP CONSTRAINT IF EXISTS studentprofile_user_id_fkey;

ALTER TABLE public.studentprofile 
ADD CONSTRAINT studentprofile_user_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

### Option 3: Check First (Manual)
```sql
-- Check if constraint exists first
SELECT conname FROM pg_constraint 
WHERE conname = 'studentprofile_user_id_fkey';

-- Only add if it doesn't exist
ALTER TABLE public.studentprofile 
ADD CONSTRAINT studentprofile_user_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

## What PostgreSQL Supports

### ✅ Supported IF NOT EXISTS
```sql
-- Tables
CREATE TABLE IF NOT EXISTS table_name (...);

-- Indexes
CREATE INDEX IF NOT EXISTS index_name ON table_name(...);

-- Views
CREATE VIEW IF NOT EXISTS view_name AS ...;

-- Schemas
CREATE SCHEMA IF NOT EXISTS schema_name;
```

### ❌ Not Supported IF NOT EXISTS
```sql
-- Constraints
ALTER TABLE table_name ADD CONSTRAINT IF NOT EXISTS ...; -- ERROR

-- Columns
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS ...; -- ERROR in older versions

-- Functions
CREATE FUNCTION IF NOT EXISTS ...; -- ERROR
```

## Testing the Fix

### 1. Apply the Fixed Migration
```bash
npx supabase migration up 20260405_fix_studentprofile_constraint.sql
```

### 2. Verify Constraint Exists
```sql
-- Check if constraint was created
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint 
WHERE conname = 'studentprofile_user_id_fkey';
```

### 3. Test Functionality
```sql
-- Test foreign key constraint
-- This should work if studentprofile.id exists in auth.users
INSERT INTO public.studentprofile (id, first_name, last_name, email)
VALUES (gen_random_uuid(), 'Test', 'Student', 'test@example.com');

-- This should fail if auth.users.id doesn't exist
INSERT INTO public.studentprofile (id, first_name, last_name, email)
VALUES ('invalid-uuid', 'Invalid', 'User', 'invalid@example.com');
```

## Common PostgreSQL Syntax Issues

### 1. DROP CONSTRAINT IF EXISTS
```sql
-- ✅ This works
ALTER TABLE table_name DROP CONSTRAINT IF EXISTS constraint_name;
```

### 2. ADD COLUMN IF NOT EXISTS
```sql
-- ✅ This works in PostgreSQL 9.6+
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE;
```

### 3. CREATE INDEX CONCURRENTLY
```sql
-- ✅ This works without locking
CREATE INDEX CONCURRENTLY IF NOT EXISTS index_name ON table_name(...);
```

## Best Practices

### 1. Always Use DO Blocks for Conditional Constraints
```sql
DO $$
BEGIN
    IF condition THEN
        -- Your constraint logic here
    END IF;
END $$;
```

### 2. Check Information Schema
```sql
-- Check for existing constraints
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'your_table' 
AND constraint_name = 'your_constraint';
```

### 3. Handle Errors Gracefully
```sql
-- Use EXCEPTION blocks in DO blocks
DO $$
BEGIN
    -- Your logic
EXCEPTION
    WHEN duplicate_object THEN
        -- Handle duplicate
END $$;
```

## Next Steps

1. **Apply the fixed migration**: `20260405_fix_studentprofile_constraint.sql`
2. **Verify constraint exists** using the SQL check
3. **Test Student Performance Analysis** feature
4. **Monitor for any remaining syntax errors**

The syntax error is now fixed with proper PostgreSQL-compatible SQL!
