# Admin Dashboard TODO

## Features to Build

### 1. Create Instructor Account (via Admin Dashboard)

- Add a nav item in the admin dashboard: **"Create Instructor"**
- Build a form with fields:
  - Email
  - Password
  - Full Name (or display name)
- On submit, use Supabase's **service role key** (server-side only) to call `supabase.auth.admin.createUser()` so the admin can create accounts without needing to go into the Supabase dashboard manually
- auto-confirm the email so the instructor doesn't need to verify
- After creation, insert a row into the `profiles` (or equivalent) table with the `role = 'instructor'`

### 2. View All Instructor Accounts (via Admin Dashboard)

- Add a nav item: **"Instructors"**
- Fetch and display a list of all users where `role = 'instructor'` from the profiles table
- Show columns like: Name, Email, Date Created, Status (active/inactive)
- Optional actions per row: Disable account, Delete account, Reset password

---

## How to Create an Admin Account

There are a few approaches — here's the best recommendation:

### Recommended: Role-based approach using Supabase

1. **Create a normal account** through the existing signup flow (or directly in the Supabase Auth dashboard).
2. In the Supabase dashboard, go to **Table Editor → profiles** (or whatever table stores user roles).
3. Find the newly created user's row and **manually set `role = 'admin'`** (or add a boolean `is_admin = true` column).
4. In your app, protect the `/admin` route by checking the user's role from the profile — if `role !== 'admin'`, redirect them away.
5. For the **admin API calls** (like creating users), use a **Supabase Edge Function** with the `SERVICE_ROLE_KEY` so that the secret key is never exposed on the frontend.

### Why not just use Supabase's built-in roles?

Supabase doesn't natively support custom app-level roles out of the box — the cleanest pattern is to store roles in your own `profiles` table and enforce access control in both RLS policies and your frontend route guards.

### Summary of steps:

- [ ] Add a `role` column to the `profiles` table (values: `'admin'`, `'instructor'`, `'student'`)
- [ ] Manually set the first admin user's role via the Supabase dashboard
- [ ] Create a protected `/admin` route in the web app that checks `role === 'admin'`
- [ ] Create a Supabase Edge Function to handle `createUser` using the service role key (never expose the service role key on the frontend)
- [ ] Build the Admin Dashboard UI with the nav items described above
