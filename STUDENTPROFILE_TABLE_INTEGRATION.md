# StudentProfile Table Integration

## Overview
Updated the Student Performance Analysis to use the `studentprofile` table instead of the generic `profiles` table for better data organization and student-specific information.

## Changes Made

### 1. Component Updates
**File**: `apps/web/src/components/StudentPerformanceAnalysis.jsx`

**Changes**:
- Updated query to use `studentprofile` table
- Removed `is_instructor` filter (assuming studentprofile only contains students)
- Simplified profile fetching logic

### 2. Database Migrations
**Files Created**:
- `20260405_fix_studentprofile_references.sql` - Ensures proper studentprofile table setup
- Updated `20260405_complete_database_fix.sql` - References studentprofile instead of profiles

## Code Changes

### Before (Using profiles table)
```javascript
const { data: profileData } = await supabase
  .from("profiles")
  .select("first_name, last_name, email")
  .eq("id", attempt.user_id)
  .eq("is_instructor", false)
  .single();
```

### After (Using studentprofile table)
```javascript
const { data: profileData } = await supabase
  .from("studentprofile")
  .select("first_name, last_name, email")
  .eq("id", attempt.user_id)
  .single();
```

## StudentProfile Table Structure

### Expected Schema
```sql
CREATE TABLE public.studentprofile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Key Features
- **Direct Link to auth.users**: The `id` field directly references `auth.users(id)`
- **Student-Specific**: Only contains student records (no instructor filtering needed)
- **Simple Structure**: Clean, focused on student information

## Migration Details

### 1. Foreign Key Constraint
```sql
ALTER TABLE public.studentprofile 
ADD CONSTRAINT studentprofile_user_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

### 2. Performance Index
```sql
CREATE INDEX idx_studentprofile_user_id ON public.studentprofile(id);
```

### 3. RLS Policies (if needed)
```sql
-- Students can view their own profile
CREATE POLICY "Users can view their own profile" ON public.studentprofile
  FOR SELECT USING (auth.uid() = id);

-- Instructors can view student profiles
CREATE POLICY "Instructors can view student profiles" ON public.studentprofile
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.instructor_id = auth.uid()
    )
  );
```

## Benefits

### 1. Data Organization
- **Clear Separation**: Students and instructors in different tables
- **Focused Schema**: Studentprofile only contains relevant student data
- **Better Performance**: No need for instructor filtering

### 2. Simplified Queries
- **Direct Access**: No need to filter out instructors
- **Cleaner Code**: Simpler SQL queries
- **Better Performance**: Fewer WHERE conditions

### 3. Data Integrity
- **Type Safety**: Student-specific table ensures data consistency
- **Relationship Clarity**: Clear link between students and their profiles
- **Maintenance**: Easier to maintain student-specific features

## Implementation Steps

### 1. Apply Migration
```bash
npx supabase migration up 20260405_fix_studentprofile_references.sql
```

### 2. Verify Table Structure
```sql
-- Check studentprofile table
\d public.studentprofile

-- Verify foreign key
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint 
WHERE conname = 'studentprofile_user_id_fkey';
```

### 3. Test Integration
- Navigate to Student Profiles
- Select section and quiz
- Verify student data loads correctly
- Check performance analysis works

## Troubleshooting

### "studentprofile table does not exist"
```sql
-- Create the table if it doesn't exist
CREATE TABLE public.studentprofile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### "No student profiles found"
```sql
-- Check if studentprofile has data
SELECT COUNT(*) FROM public.studentprofile;

-- Check if quiz_attempts have matching student profiles
SELECT qa.id, qa.user_id, sp.first_name, sp.last_name
FROM public.quiz_attempts qa
LEFT JOIN public.studentprofile sp ON qa.user_id = sp.id
WHERE sp.id IS NULL;
```

### "Foreign key constraint errors"
```sql
-- Ensure all studentprofile IDs exist in auth.users
DELETE FROM public.studentprofile 
WHERE id NOT IN (SELECT id FROM auth.users);
```

## Data Migration (if needed)

If you need to migrate from profiles to studentprofile:

```sql
-- Copy student records from profiles to studentprofile
INSERT INTO public.studentprofile (id, first_name, last_name, email)
SELECT id, first_name, last_name, email
FROM public.profiles
WHERE is_instructor = false OR is_instructor IS NULL;
```

## Future Enhancements

### 1. Additional Student Fields
```sql
ALTER TABLE public.studentprofile
ADD COLUMN student_number TEXT,
ADD COLUMN grade_level TEXT,
ADD COLUMN enrollment_date DATE;
```

### 2. Performance Tracking
```sql
CREATE TABLE public.student_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.studentprofile(id),
  quiz_id UUID REFERENCES public.quizzes(id),
  cognitive_domain TEXT,
  performance_percentage INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Next Steps

1. **Apply the studentprofile migration**
2. **Verify table structure and data**
3. **Test Student Performance Analysis**
4. **Confirm all student data loads correctly**
5. **Monitor for any performance issues**

The integration with the studentprofile table provides a cleaner, more focused approach to managing student information and performance analysis.
