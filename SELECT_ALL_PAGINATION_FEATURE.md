# Select All and Pagination Features

## Feature Overview
Added "Select All" functionality and pagination (10 items per page) to the QuestionBankImport component for better user experience when managing large numbers of questions.

## Features Implemented

### 1. Select All Functionality
**Controls added above question list:**
- **"Select All (X)" button** - Selects all questions on current page
- **"Deselect All" button** - Appears when all current page questions are selected
- Smart state management - tracks selections across all pages
- Page-specific selection - Select All only affects current page questions

### 2. Pagination (10 items per page)
**Pagination controls:**
- **Previous/Next buttons** - Navigate between pages
- **Page numbers** - Direct page navigation (1, 2, 3, etc.)
- **Page info display** - Shows "Showing 1-10 of 25 questions"
- **Auto-reset** - Page resets to 1 when filters change

## Technical Implementation

### State Management
```javascript
// Pagination state
const ITEMS_PER_PAGE = 10;
const [currentPage, setCurrentPage] = useState(1);

// Pagination logic
const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE));
const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
const endIndex = startIndex + ITEMS_PER_PAGE;
const paginatedQuestions = filteredQuestions.slice(startIndex, endIndex);
```

### Select All Logic
```javascript
const handleSelectAll = () => {
  const allCurrentPageQuestions = paginatedQuestions;
  const newSelectedQuestions = [...selectedQuestions];
  
  allCurrentPageQuestions.forEach(question => {
    if (!selectedQuestions.some(q => q.id === question.id)) {
      newSelectedQuestions.push(question);
    }
  });
  
  setSelectedQuestions(newSelectedQuestions);
};

const isAllCurrentPageSelected = paginatedQuestions.length > 0 && 
  paginatedQuestions.every(q => selectedQuestions.some(sq => sq.id === q.id));
```

### UI Components
- **Select All button** - Shows count of current page questions
- **Deselect All button** - Appears when all current page questions are selected
- **Pagination controls** - Previous/Next buttons + numbered pages
- **Page info** - "Showing 1-10 of 25 questions" display

## User Experience

### Before:
- Had to select questions individually
- Long scrolling lists for many questions
- No way to quickly select multiple questions

### After:
- **Quick selection** - Select All button for current page
- **Easy navigation** - Pagination by 10 items
- **Clear feedback** - Shows current page and total questions
- **Smart behavior** - Maintains selections across pages

## Files Modified
- `src/components/QuestionBankImport.jsx` - Main implementation

## Usage Instructions

1. **Select All:**
   - Click "Select All (X)" to select all questions on current page
   - Click "Deselect All" to clear selections on current page
   - Selections persist when navigating between pages

2. **Pagination:**
   - Use Previous/Next buttons to navigate
   - Click page numbers for direct navigation
   - Page automatically resets when changing filters

## Benefits
- **Faster selection** - Select All saves time
- **Better performance** - Pagination loads 10 items at a time
- **Improved UX** - Clear navigation and selection controls
- **Scalable** - Works well with large question banks
