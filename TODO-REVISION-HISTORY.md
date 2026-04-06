# Revision History Implementation TODO

## Steps to Complete:

- [x] Step 1: Create `apps/web/src/components/RevisionHistoryModal.jsx` - Modal to display revision history list with dates/text.
- [x] Step 2: Update `apps/web/src/hooks/questionHook/useFetchQuestions.jsx` - Add `revision_history, revised_options, updated_at` to Supabase select.
- [x] Step 3: Update `apps/web/src/hooks/questionHook/useAddSaveQuestion.jsx` - On edit: fetch current, push OLD version to revision_history, update with new values.

- [x] Step 4: Update `apps/web/src/components/QuestionList.jsx` - Add '🔄 Revised' badge if revision_history.length > 0; 'View History' button opens modal; add local modal state/use.
- [x] Step 5: Test: Edit question → see badge → click history → see dates; dispatch refresh.
- [x] Step 6: attempt_completion.

Progress will be updated after each step.

