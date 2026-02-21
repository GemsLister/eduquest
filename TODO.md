# Question Bank Page Implementation

## Tasks
- [ ] 1. Add Question Bank navigation link to InstructorLayout sidebar
- [ ] 2. Fix InstructorQuestions.jsx to save questions to Supabase
- [ ] 3. Fix InstructorQuestions.jsx to delete questions from Supabase
- [ ] 4. Add update question functionality to quizService.js
- [ ] 5. Test the implementation

## Implementation Details

### Step 1: Add Navigation to Sidebar (InstructorLayout.jsx)
- Add a new nav item for "Question Bank" with an icon (📝 or ❓)
- Path: `/instructor-dashboard/instructor-questions`

### Step 2: Fix Save Functionality (InstructorQuestions.jsx)
- Import quizService
- Implement handleSaveQuestion to:
  - For new questions: create using quizService.createQuestions
  - For existing questions: update using Supabase directly
  
### Step 3: Fix Delete Functionality (InstructorQuestions.jsx)
- Implement handleDeleteQuestion to:
  - Delete from Supabase using quizService.deleteQuestion
  
### Step 4: Add Update Function to quizService.js
- Add updateQuestion function to quizService
