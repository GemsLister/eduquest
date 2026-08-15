# Question Bank Refactoring: Subject-Based Organization

## Overview
This refactoring changes the Question Bank from a section-based organization to a subject-based organization. Previously, questions were categorized by section (e.g., "Database Management - Section A", "Database Management - Section B"), creating duplicate subject entries. Now, all questions belonging to the same subject are grouped under a single subject entry (e.g., "Database Management").

## Changes Made

### 1. Database Schema Changes

#### New Migration: `20260812_010000_add_subject_id_to_questions.sql`
- Added `subject_id` column to the `questions` table
- Created indexes for efficient querying on `subject_id` and composite `subject_id, section_id`
- Backfilled existing questions with `subject_id` derived from their section relationships
- Added RLS policy for instructors to update `subject_id` for their questions
- Added documentation comments explaining the purpose of `section_id` vs `subject_id`

**Key Points:**
- `subject_id` is now the primary categorization field for questions
- `section_id` is retained as metadata indicating where the question originated or was used
- Existing data is preserved through backfill operations

### 2. Backend Logic Changes

#### `useQuestionBank.jsx` Hook
- Updated all question queries to include `subjects(id, name, code)` data
- Modified `addToBank()` function to accept `subjectId` parameter and derive it from section if not provided
- Modified `addBulkToBank()` function to handle subject assignment similarly
- All question fetching now includes subject information for proper categorization

#### `useAddSaveQuestion.jsx` Hook
- Added `subject_id` and `section_id` to form data state
- Updated question creation logic to handle `subject_id` assignment
- Added logic to derive `subject_id` from `section_id` when only section is provided
- Updated form reset functions to include new fields

### 3. Frontend UI Changes

#### `QuestionBank.jsx` Component
- Changed filter from section-based to subject-based:
  - `selectedSectionId` → `selectedSubjectId`
  - `sections` → `subjects`
  - `quizzesFromSection` → `quizzesFromSubject`
  - `sectionsLoading` → `subjectsLoading`
- Updated all filtering logic to use `subject_id` instead of `section_id`
- Modified subject/quiz fetching to work with subjects instead of sections
- Updated UI labels and dropdowns to reflect subject-based organization
- Updated active filter chips to show subject instead of section
- Modified `handleAddToBank()` and import functions to use subject ID

**Key UI Changes:**
- Subject dropdown now shows unique subjects (e.g., "Database Management")
- Quiz dropdown shows quizzes from the selected subject
- Questions are filtered by subject rather than section
- Section information is preserved as metadata but doesn't drive categorization

## Data Preservation

All existing question data is preserved through the migration:
- Questions with `section_id` get their `subject_id` backfilled from the section's subject
- Questions from quizzes get their `subject_id` derived from the quiz's section or subject
- `section_id` is retained for metadata purposes
- No questions are deleted or lost in the process

## Benefits

1. **Centralized Question Bank**: All questions for a subject appear in one place, regardless of which section they came from
2. **No Duplicate Subjects**: Eliminates duplicate subject entries like "Database Management - Section A", "Database Management - Section B"
3. **Better Reusability**: Instructors can easily find and reuse questions across different sections of the same subject
4. **Preserved Section Context**: Section information is still available as metadata for exam assignment and student management
5. **Backward Compatible**: Existing data and functionality are preserved

## Usage Examples

### Before:
- Filter by: "Database Management - Section A" → Shows only questions from Section A
- Filter by: "Database Management - Section B" → Shows only questions from Section B

### After:
- Filter by: "Database Management" → Shows all questions from Section A, Section B, Section C, etc.
- Section information is available as metadata but doesn't create separate question banks

## Testing Recommendations

1. Verify that the migration runs successfully
2. Check that existing questions have proper `subject_id` values
3. Test the Question Bank filter with different subjects
4. Verify that questions from different sections of the same subject appear together
5. Test adding new questions to the bank with subject assignment
6. Verify that section information is still available as metadata
7. Test quiz assignment and student management still work correctly with sections

## Rollback Plan

If issues arise, the changes can be reverted by:
1. Removing the `subject_id` column from questions (optional, as it doesn't break existing functionality)
2. Reverting the frontend changes to use section-based filtering
3. The `section_id` column still exists and contains the original data

## Future Enhancements

Potential improvements that could be made:
- Add subject management UI for creating/editing subjects
- Add subject-based analytics and reporting
- Enable cross-subject question sharing with proper permissions
- Add subject-level question templates or question pools
