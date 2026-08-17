# Published Quiz Questions Import Feature

## Feature Overview
Updated the question import system to allow users to import questions from published quizzes that they've closed, in addition to archived questions and question bank items.

## Changes Made

### QuestionBankImport Component
**Updated filtering logic to include:**
- Archived questions (`q.is_archived === true`)
- Question bank items (`q.quiz_id === null`) 
- **Published quiz questions** (`q.quizzes?.is_published === true`)

**Database queries updated:**
- Added `is_published` field to quiz queries
- Updated section quiz filtering to include published quizzes
- Enhanced quiz dropdown to show both active and published exams

### useQuestionBank Hook
**Updated to include published quiz questions:**
- Added `is_published` field to question queries
- Questions from published quizzes now appear in active questions list

### QuestionBank Page
**Enhanced quiz filtering:**
- Quiz dropdown now includes published exams
- Updated quiz fetching logic with `or("is_archived.eq.false,is_published.eq.true")`
- Published quizzes appear alongside active quizzes in subject filtering

## User Benefits

### Before:
- Could only import archived questions
- Published quiz questions were locked and inaccessible
- Limited to manually created question bank items

### After:
- **Full access to all question sources:**
  - Archived questions
  - Question bank items  
  - **Questions from published quizzes**
- Can reuse content from completed exams
- Better question management and recycling

## Technical Implementation

### Database Schema Compatibility
- Uses existing `quizzes.is_published` field
- Maintains backward compatibility with quiz_sections junction table
- Preserves existing question deduplication logic

### Filtering Logic
```javascript
// Updated to include published quiz questions
const recyclableQuestions = (allData || []).filter(q => 
  q.is_archived === true || 
  q.quiz_id === null || 
  q.quizzes?.is_published === true
);
```

### Quiz Query Enhancement
```javascript
// Include both active and published quizzes
.or("is_archived.eq.false,is_published.eq.true")
```

## Files Modified
1. `src/components/QuestionBankImport.jsx` - Main import component
2. `src/hooks/questionHook/useQuestionBank.jsx` - Question data hook
3. `src/pages/instructors/QuestionBank.jsx` - Question bank page

## Usage Instructions

1. **Import Questions Modal:**
   - Select a subject from dropdown
   - Choose an exam (including published ones)
   - Questions from published exams will appear for selection

2. **Question Bank Page:**
   - Published quizzes appear in exam dropdowns
   - Questions from published exams show in question list
   - Can filter by subject/exam as before

## Result
Users can now access and import questions from all their published quizzes, maximizing content reuse and efficiency in question management.
