-- Student Evaluating Score Query for T400 Quiz
-- Find how many evaluating questions a student got correct

## Query 1: Get Student's Evaluating Performance

```sql
SELECT 
    sp.student_name,
    sp.quiz_id,
    q.title as quiz_title,
    q.course_code,
    -- Evaluating domain performance
    sp.evaluating_correct as evaluating_correct_count,
    sp.evaluating_total as evaluating_total_count,
    sp.evaluating_percentage,
    -- Overall quiz performance
    sp.total_correct as overall_correct,
    sp.total_questions as overall_total,
    sp.overall_percentage
FROM public.student_blooms_performance sp
JOIN public.quizzes q ON sp.quiz_id = q.id
WHERE sp.quiz_id = (
    SELECT id FROM public.quizzes 
    WHERE title LIKE '%Application Development and Emerging Technologies%' 
    AND course_code = 'T400'
    LIMIT 1
)
AND sp.student_id = 'your-student-uuid-here'
AND sp.evaluating_total > 0;
```

## Query 2: Get Detailed Evaluating Question Results

```sql
SELECT 
    sp.student_name,
    q.title as quiz_title,
    qr.question_text,
    qr.selected_answer,
    qr.correct_answer,
    qr.is_correct,
    -- Check if this is an evaluating question
    CASE 
        WHEN qbt.blooms_taxonomy_level = 'Evaluating' THEN 'Evaluating Question'
        ELSE 'Other Domain'
    END as question_domain,
    -- Count only evaluating questions
    CASE 
        WHEN qbt.blooms_taxonomy_level = 'Evaluating' THEN 1
        ELSE 0
    END as is_evaluating_question
FROM public.student_blooms_performance sp
JOIN public.quizzes q ON sp.quiz_id = q.id
JOIN public.quiz_responses qr ON qr.attempt_id IN (
    SELECT qa.id FROM public.quiz_attempts qa 
    WHERE qa.student_id = sp.student_id AND qa.quiz_id = q.id
)
JOIN public.questions qn ON qr.question_id = qn.id
JOIN public.question_blooms_taxonomy qbt ON qn.id = qbt.question_id
WHERE q.title LIKE '%Application Development and Emerging Technologies%'
AND q.course_code = 'T400'
AND sp.student_id = 'your-student-uuid-here'
AND qbt.blooms_taxonomy_level = 'Evaluating'
ORDER BY qn.question_number;
```

## Query 3: Get Student Who Got 6/6 in Evaluating

```sql
SELECT 
    sp.student_name,
    sp.quiz_id,
    q.title as quiz_title,
    -- Evaluating domain performance
    sp.evaluating_correct as evaluating_correct_count,
    sp.evaluating_total as evaluating_total_count,
    -- Calculate if student got exactly 6 correct
    CASE 
        WHEN sp.evaluating_correct = 6 THEN 'Perfect Score: 6/6'
        WHEN sp.evaluating_correct >= 5 THEN 'Good Score: 5+ correct'
        WHEN sp.evaluating_correct >= 3 THEN 'Average Score: 3-5 correct'
        ELSE 'Needs Improvement: <3 correct'
    END as performance_level,
    -- Percentage
    sp.evaluating_percentage,
    sp.attempt_date
FROM public.student_blooms_performance sp
JOIN public.quizzes q ON sp.quiz_id = q.id
WHERE sp.quiz_id = (
    SELECT id FROM public.quizzes 
    WHERE title LIKE '%Application Development and Emerging Technologies%' 
    AND course_code = 'T400'
    LIMIT 1
)
AND sp.evaluating_correct = 6  -- Student who got exactly 6 correct
ORDER BY sp.attempt_date DESC;
```

## Example Results:

### Student Who Got 6/6 in Evaluating:
```
student_name | quiz_title                                 | evaluating_correct_count | evaluating_total_count | evaluating_percentage | performance_level
-------------|---------------------------------------------|----------------------|----------------------|------------------
John Doe     | Application Development and Emerging Technologies | 6                    | 6                     | 100.00              | Perfect Score: 6/6
Jane Smith    | Application Development and Emerging Technologies | 4                    | 6                     | 66.67               | Good Score: 5+ correct
Bob Johnson   | Application Development and Emerging Technologies | 2                    | 6                     | 33.33               | Needs Improvement: <3 correct
```

### Student Performance Summary:
```
Quiz: Application Development and Emerging Technologies (T400)
Student: John Doe
Evaluating Questions: 6 total
Correct Answers: 6
Incorrect Answers: 0
Percentage: 100.00%
Performance Level: Perfect Score
```

## Key Points:

### 1. Find the Quiz
```sql
WHERE title LIKE '%Application Development and Emerging Technologies%' 
AND course_code = 'T400'
```

### 2. Get Evaluating Performance
```sql
sp.evaluating_correct as evaluating_correct_count,
sp.evaluating_total as evaluating_total_count,
sp.evaluating_percentage
```

### 3. Check for 6/6 Score
```sql
WHEN sp.evaluating_correct = 6 THEN 'Perfect Score: 6/6'
```

### 4. Performance Levels
- **Perfect Score:** 6/6 (100%)
- **Good Score:** 5+ correct
- **Average Score:** 3-5 correct  
- **Needs Improvement:** <3 correct

This query will show you exactly which student got 6/6 in the evaluating questions for the T400 quiz!
