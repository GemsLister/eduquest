# HOTS/LOTS Question Bank Feature Implementation

## Overview
Successfully implemented HOTS (Higher Order Thinking Skills) and LOTS (Lower Order Thinking Skills) categorization for the question bank system.

## Changes Made

### 1. Database Migration
- **File**: `supabase/migrations/20260405_add_cognitive_level_to_questions.sql`
- **Added**: `cognitive_level` column to questions table
- **Type**: VARCHAR(20) with CHECK constraint for 'HOTS' and 'LOTS'
- **Default**: 'LOTS'
- **Index**: Created for performance optimization

### 2. Backend Hook Updates
- **File**: `apps/web/src/hooks/questionHook/useQuestionBank.jsx`
- **Changes**:
  - Updated query to include `sections(section_name)`
  - Modified `addToBank` function to handle `cognitive_level` field
  - Added `cognitive_level` to question insertion logic

### 3. Frontend UI Updates

#### Filter Dropdown
- **Location**: QuestionBank.jsx filter section
- **Added**: Cognitive level filter dropdown with options:
  - 🧠 All Levels
  - LOTS (Lower Order)
  - HOTS (Higher Order)

#### Question Display
- **Added**: Cognitive level badges on each question
- **Styling**:
  - HOTS: Purple badge (`bg-purple-100 text-purple-800`)
  - LOTS: Blue badge (`bg-blue-100 text-blue-800`)

#### Add Question Form
- **Added**: Cognitive level selection field
- **Options**:
  - LOTS (Lower Order Thinking Skills)
  - HOTS (Higher Order Thinking Skills)
- **Helper text**: "LOTS: Remember, Understand, Apply | HOTS: Analyze, Evaluate, Create"

#### Filter Logic
- **Updated**: `filterQuestions` function to include cognitive level filtering
- **Priority**: Cognitive level filter applied first, then other filters
- **State management**: Added `selectedCognitiveLevel` state

## Features

### 1. Filtering
- Instructors can filter questions by cognitive level
- Filter works independently or combined with other filters (subject, quiz, search)
- Filter chips show active cognitive level filter
- Clear all filters includes cognitive level

### 2. Question Categorization
- Each question displays its cognitive level as a colored badge
- Visual distinction between HOTS (purple) and LOTS (blue)
- Badge appears next to quiz title and points

### 3. Question Creation
- New questions require cognitive level selection
- Default to LOTS for backward compatibility
- Clear explanation of what constitutes HOTS vs LOTS

## User Experience

### For Instructors
1. **Easy Filtering**: Quick dropdown to filter by HOTS/LOTS
2. **Visual Identification**: Color-coded badges for easy scanning
3. **Balanced Assessment**: Helps ensure mix of question types
4. **Reuse Efficiency**: Quickly find appropriate question types for different learning objectives

### Benefits
- **Educational Alignment**: Supports Bloom's taxonomy principles
- **Assessment Quality**: Encourages balanced question difficulty
- **Time Saving**: Quick categorization and filtering
- **Consistency**: Standardized cognitive level classification

## Technical Implementation

### State Management
```javascript
const [selectedCognitiveLevel, setSelectedCognitiveLevel] = useState(null);
```

### Filter Logic
```javascript
if (selectedCognitiveLevel) {
  filteredList = filteredList.filter(
    (q) => q.cognitive_level === selectedCognitiveLevel,
  );
}
```

### Badge Component
```javascript
<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
  question.cognitive_level === 'HOTS' 
    ? 'bg-purple-100 text-purple-800' 
    : 'bg-blue-100 text-blue-800'
}`}>
  {question.cognitive_level || 'LOTS'}
</span>
```

## Database Schema
```sql
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(20) DEFAULT 'LOTS' 
CHECK (cognitive_level IN ('HOTS', 'LOTS'));
```

## Next Steps
1. Apply database migration to production
2. Test with real data
3. Gather instructor feedback
4. Consider adding analytics on HOTS/LOTS usage
5. Potential for automatic classification using AI

## Testing Notes
- Frontend implementation is complete and functional
- Database migration created and ready to apply
- Web application runs successfully with new features
- All UI components properly integrated
