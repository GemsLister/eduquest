# Google Sign-In for Public Quiz

## Step 1: DB Migration ✅
- Created `supabase/migrations/20241025_add_student_id_to_student_profile.sql`
- User needs to run migration: `supabase migration up` or apply in Supabase dashboard.

## Step 2: Update Auth Hook ✅
- Added `handleGoogleQuizLogin` to `apps/web/src/hooks/authHook/useGoogleLogin.jsx`

## Step 3: Update PublicQuizPage ⏳
- Edit `apps/web/src/pages/PublicQuizPage.jsx`

## Step 4: Test ⏳
- `cd apps/web && npm run dev`

