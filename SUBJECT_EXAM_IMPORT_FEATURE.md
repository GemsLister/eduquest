# Subject and Exam Selection for Question Import

## Feature Overview
Added functionality to the QuestionBankImport component that allows users to:
1. Select a subject from a dropdown
2. View exams/quizzes associated with the selected subject
3. Import questions from specific exams within that subject

## Changes Made

### Component: `QuestionBankImport.jsx`

#### New State Variables
- `selectedSectionId`: ID of the selected subject/section
- `selectedQuizId`: ID of the selected exam/quiz
- `sections`: List of available subjects
- `quizzesFromSection`: List of exams in selected subject
- `sectionsLoading`: Loading state for subjects

#### New Functions
- `fetchSections()`: Fetches instructor's subjects
- `fetchQuizzes()`: Fetches exams for selected subject
- Updated `fetchQuestionBank()`: Filters questions by selected subject/exam

#### UI Changes
- Added Subject dropdown with loading states
- Added Exam dropdown (appears when subject is selected)
- Added Clear Filters button
- Enhanced search functionality to work with filters

#### Database Queries
- Fetches sections where `instructor_id = user.id` and `is_archived = false`
- Fetches quizzes through `quiz_sections` junction table and direct assignments
- Filters questions by selected quiz or all quizzes in selected section

## User Flow
1. User opens Import Questions modal
2. Select a subject from the "📚 -- Select Subject --" dropdown
3. Exams for that subject load in the "📝 -- Select Exam --" dropdown
4. User can select a specific exam or leave it blank to see all questions from the subject
5. Questions are filtered based on selection and displayed for import
6. User can clear filters using the "Clear Filters" button

## Technical Details
- Uses React hooks (`useState`, `useEffect`) for state management
- Integrates with existing Supabase database schema
- Maintains backward compatibility with existing quiz-section relationships
- Preserves existing search and selection functionality

## Files Modified
- `src/components/QuestionBankImport.jsx` - Main implementation

## Testing
The feature has been implemented and should work with the existing database structure. The component is already integrated into the InstructorQuiz page where it's used for importing questions.
