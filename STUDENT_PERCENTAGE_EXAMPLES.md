# Student Profile Percentage Examples

## Example 1: Quiz Performance Percentage

### Query to Calculate Student's Overall Quiz Performance
```sql
SELECT 
    sp.student_id,
    sp.student_name,
    sp.quiz_id,
    q.title as quiz_title,
    -- Overall performance percentage
    ROUND((sp.total_correct::DECIMAL / NULLIF(sp.total_questions, 0) * 100), 2) as overall_percentage,
    sp.total_correct,
    sp.total_questions,
    sp.attempt_date
FROM public.student_blooms_performance sp
JOIN public.quizzes q ON sp.quiz_id = q.id
WHERE sp.student_id = 'your-student-uuid-here'
ORDER BY sp.attempt_date DESC;
```

### Example Results:
```
student_id    | student_name | quiz_title           | overall_percentage | total_correct | total_questions | attempt_date
--------------|--------------|---------------------|------------------|----------------|--------------
c5e8d4c2-... | John Doe     | Biology Quiz 1       | 85.50           | 17             | 20             | 2026-03-29
```

## Example 2: Bloom's Taxonomy Performance Percentages

### Query to Show Performance by Cognitive Domain
```sql
SELECT 
    sp.student_name,
    sp.quiz_id,
    q.title as quiz_title,
    -- Individual Bloom's taxonomy percentages
    sp.remembering_percentage,
    sp.remembering_correct,
    sp.remembering_total,
    sp.understanding_percentage,
    sp.understanding_correct,
    sp.understanding_total,
    sp.applying_percentage,
    sp.applying_correct,
    sp.applying_total,
    sp.analyzing_percentage,
    sp.analyzing_correct,
    sp.analyzing_total,
    sp.evaluating_percentage,
    sp.evaluating_correct,
    sp.evaluating_total,
    sp.creating_percentage,
    sp.creating_correct,
    sp.creating_total,
    -- Overall percentage
    ROUND((sp.total_correct::DECIMAL / NULLIF(sp.total_questions, 0) * 100), 2) as overall_percentage
FROM public.student_blooms_performance sp
JOIN public.quizzes q ON sp.quiz_id = q.id
WHERE sp.student_id = 'your-student-uuid-here'
ORDER BY sp.attempt_date DESC;
```

### Example Results:
```
student_name | quiz_title     | remembering_percentage | understanding_percentage | applying_percentage | analyzing_percentage | evaluating_percentage | creating_percentage | overall_percentage
-------------|----------------|---------------------|----------------------|-------------------|---------------------|-------------------|------------------
John Doe     | Biology Quiz    | 100.00              | 75.00                | 50.00             | 85.00               | 0.00              | 85.50
```

## Example 3: Class Average Percentages

### Query to Calculate Class Average by Bloom's Domain
```sql
SELECT 
    q.title as quiz_title,
    -- Average percentages for each cognitive domain
    ROUND(AVG(sp.remembering_percentage), 2) as avg_remembering_pct,
    ROUND(AVG(sp.understanding_percentage), 2) as avg_understanding_pct,
    ROUND(AVG(sp.applying_percentage), 2) as avg_applying_pct,
    ROUND(AVG(sp.analyzing_percentage), 2) as avg_analyzing_pct,
    ROUND(AVG(sp.evaluating_percentage), 2) as avg_evaluating_pct,
    ROUND(AVG(sp.creating_percentage), 2) as avg_creating_pct,
    -- Overall class average
    ROUND(AVG(sp.total_correct::DECIMAL / NULLIF(sp.total_questions, 0) * 100), 2) as avg_overall_pct,
    COUNT(*) as total_students
FROM public.student_blooms_performance sp
JOIN public.quizzes q ON sp.quiz_id = q.id
WHERE q.id = 'your-quiz-uuid-here'
GROUP BY q.title;
```

### Example Results:
```
quiz_title     | avg_remembering_pct | avg_understanding_pct | avg_applying_pct | avg_analyzing_pct | avg_evaluating_pct | avg_creating_pct | avg_overall_pct | total_students
---------------|-------------------|---------------------|------------------|------------------|------------------|-----------------|----------------|---------------
Biology Quiz   | 78.50             | 65.25               | 72.00            | 68.75            | 82.00            | 45.50           | 75.25
```

## Example 4: Student Progress Over Time

### Query to Show Student's Progress Across Multiple Quizzes
```sql
SELECT 
    sp.student_name,
    q.title as quiz_title,
    sp.attempt_date,
    sp.overall_percentage,
    -- Performance trend
    CASE 
        WHEN LAG(sp.overall_percentage) OVER (ORDER BY sp.attempt_date) IS NULL THEN 'First Attempt'
        WHEN sp.overall_percentage > LAG(sp.overall_percentage) OVER (ORDER BY sp.attempt_date) THEN 'Improving'
        WHEN sp.overall_percentage < LAG(sp.overall_percentage) OVER (ORDER BY sp.attempt_date) THEN 'Declining'
        ELSE 'Stable'
    END as performance_trend
FROM public.student_blooms_performance sp
JOIN public.quizzes q ON sp.quiz_id = q.id
WHERE sp.student_id = 'your-student-uuid-here'
ORDER BY sp.attempt_date DESC;
```

### Example Results:
```
student_name | quiz_title     | attempt_date         | overall_percentage | performance_trend
-------------|----------------|---------------------|------------------|------------------
John Doe     | Biology Quiz 1 | 2026-03-29          | 85.50            | First Attempt
John Doe     | Biology Quiz 2 | 2026-03-28          | 92.00            | Improving
John Doe     | Biology Quiz 3 | 2026-03-27          | 78.50            | Declining
```

## Example 5: Top Performing Students by Cognitive Domain

### Query to Find Top Students in Each Bloom's Domain
```sql
SELECT DISTINCT ON (sp.remembering_percentage)
    sp.student_name,
    sp.remembering_percentage,
    'Remembering' as domain
FROM public.student_blooms_performance sp
WHERE sp.remembering_percentage > 0
ORDER BY sp.remembering_percentage DESC

UNION ALL

SELECT DISTINCT ON (sp.understanding_percentage)
    sp.student_name,
    sp.understanding_percentage,
    'Understanding' as domain
FROM public.student_blooms_performance sp
WHERE sp.understanding_percentage > 0
ORDER BY sp.understanding_percentage DESC

UNION ALL

SELECT DISTINCT ON (sp.analyzing_percentage)
    sp.student_name,
    sp.analyzing_percentage,
    'Analyzing' as domain
FROM public.student_blooms_performance sp
WHERE sp.analyzing_percentage > 0
ORDER BY sp.analyzing_percentage DESC;
```

### Example Results:
```
student_name | remembering_percentage | domain
-------------|---------------------|---------
Alice Smith | 95.00               | Remembering
Bob Johnson  | 88.00               | Understanding
Charlie Lee | 92.00               | Analyzing
```

## Key Points for Percentage Calculations:

### 1. Overall Performance Formula
```sql
overall_percentage = (total_correct / total_questions) * 100
```

### 2. Domain-Specific Formula
```sql
domain_percentage = (domain_correct / domain_total) * 100
```

### 3. Handling Division by Zero
```sql
-- Use NULLIF to prevent division by zero errors
percentage = (correct::DECIMAL / NULLIF(total, 0) * 100)
```

### 4. Rounding for Display
```sql
-- Round to 2 decimal places for clean display
ROUND(percentage, 2)
```

These examples show how to calculate and display percentages for student performance across different dimensions!
