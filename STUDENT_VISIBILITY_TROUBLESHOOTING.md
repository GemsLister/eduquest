# Student Visibility Troubleshooting Guide

## Problem: Students Who Took the Exam Are Not Visible

### What I've Done
1. **Updated the Student Performance Analysis** to be more flexible with status filtering
2. **Created a Debug Version** that shows all attempts regardless of status
3. **Added comprehensive logging** to help identify issues
4. **Temporarily enabled debug mode** in your Student Profiles page

### How to Debug

#### Step 1: Check the Debug Information
When you select a section and quiz, you'll now see a blue debug box that shows:
- **Total Attempts**: How many quiz attempts exist for this quiz
- **Valid Students**: How many students were successfully processed
- **All Attempts**: List of every attempt with user ID, status, and score

#### Step 2: Look at the Console
Open your browser's developer console (F12) and check for:
- "Quiz attempts found: X" - Shows how many attempts were retrieved
- "Completed attempts: X" - Shows how many passed the status filter
- "Student profile not found for user: X" - Shows which users don't have student profiles

#### Step 3: Check the Debug Box
The debug box will show you:
```
All Attempts:
1. User: bafd9d09... | Status: completed | Score: 85%
2. User: c3e8a1f2... | Status: finished | Score: 92%
3. User: d5f7b3c4... | Status: NULL | Score: 78%
```

### Common Issues and Solutions

#### Issue 1: Wrong Status Values
**Problem**: Your quiz attempts have different status values than expected.

**Symptoms**: 
- Total Attempts > 0 but Valid Students = 0
- Debug shows status values like "submitted", "finished", or NULL

**Solution**: The debug version now accepts multiple status values:
- `completed`, `finished`, `submitted`, and `NULL`

#### Issue 2: Missing Student Profiles
**Problem**: Quiz attempts exist but users don't have entries in the `studentprofile` table.

**Symptoms**:
- Console shows "Student profile not found for user: X"
- Debug shows "Profile: Missing" for some students

**Solutions**:
1. **Create Student Profiles**:
   ```sql
   -- Create missing student profiles
   INSERT INTO public.studentprofile (id, first_name, last_name, email)
   SELECT DISTINCT qa.user_id, 'Student', 'Name', 'student@example.com'
   FROM public.quiz_attempts qa
   WHERE qa.user_id IS NOT NULL
   AND qa.user_id NOT IN (SELECT id FROM public.studentprofile);
   ```

2. **Check User IDs**:
   ```sql
   -- See which users don't have profiles
   SELECT qa.user_id, qa.status, qa.score
   FROM public.quiz_attempts qa
   LEFT JOIN public.studentprofile sp ON qa.user_id = sp.id
   WHERE sp.id IS NULL;
   ```

#### Issue 3: Foreign Key Constraint Issues
**Problem**: Invalid user_id references in quiz_attempts.

**Symptoms**:
- Error: "foreign key constraint violation"
- No attempts are loaded

**Solution**: Apply the migration fixes:
```bash
npx supabase migration up 20260405_simple_quiz_fix.sql
```

#### Issue 4: No Quiz Attempts Exist
**Problem**: No one has actually taken the quiz yet.

**Symptoms**:
- Total Attempts = 0
- Debug box shows "No attempts found"

**Solution**: This is expected - students need to take the quiz first.

### Quick Fixes

#### Fix 1: Update Status Filter
If your quiz attempts have different status values, update the filter:

```javascript
// In StudentPerformanceAnalysis.jsx, update this line:
const completedAttempts = (attemptsData || []).filter(attempt => 
  attempt.status === 'completed' || 
  attempt.status === 'finished' || 
  attempt.status === 'submitted' ||
  attempt.status === 'in_progress' ||  // Add this
  attempt.status === null              // Add this
);
```

#### Fix 2: Create Missing Student Profiles
Run this SQL to create profiles for users who took quizzes but don't have profiles:

```sql
-- Create student profiles for all users who took quizzes
INSERT INTO public.studentprofile (id, first_name, last_name, email)
SELECT DISTINCT 
  qa.user_id,
  COALESCE(u.raw_user_meta_data->>'first_name', 'Student'),
  COALESCE(u.raw_user_meta_data->>'last_name', 'User'),
  u.email
FROM public.quiz_attempts qa
JOIN auth.users u ON qa.user_id = u.id
LEFT JOIN public.studentprofile sp ON qa.user_id = sp.id
WHERE sp.id IS NULL
AND qa.user_id IS NOT NULL;
```

#### Fix 3: Check Quiz ID
Make sure you're selecting the right quiz:

```sql
-- Check what quizzes exist
SELECT id, title, section_id FROM public.quizzes ORDER BY title;

-- Check attempts per quiz
SELECT quiz_id, COUNT(*) as attempts, 
       COUNT(DISTINCT user_id) as unique_students
FROM public.quiz_attempts 
GROUP BY quiz_id ORDER BY attempts DESC;
```

### Testing the Fix

1. **Go to Student Profiles** page
2. **Select your section and quiz**
3. **Check the debug box** - it will show you exactly what's happening
4. **Look at the console** for detailed logging
5. **Apply the appropriate fix** based on what you find

### Expected Results

After fixing the issues, you should see:
- **Total Attempts**: > 0 (students have taken the quiz)
- **Valid Students**: > 0 (students have profiles)
- **Debug Box**: Shows student names with "Profile: Found"
- **Student Cards**: Visible with performance data

### Switching Back to Normal Mode

Once everything is working, switch back to the normal component:

```javascript
// In StudentProfiles.jsx, change back to:
import { StudentPerformanceAnalysis } from "../../components/StudentPerformanceAnalysis.jsx";

// And use:
<StudentPerformanceAnalysis 
  sectionId={selectedSection}
  quizId={selectedQuiz}
  instructorId={userId}
/>
```

The debug mode will help you identify exactly why your students aren't showing up and provide the specific fixes needed!
