# EduQuest - Project Documentation

> A production-grade educational quiz management platform with AI-powered Bloom's Taxonomy analysis, item response theory analytics, and role-based access control.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
  - [FastAPI Endpoints](#fastapi-endpoints-bloom-taxonomy-classifier)
  - [Supabase Edge Functions](#supabase-edge-functions)
  - [Supabase Database RPCs](#supabase-database-rpcs)
- [Frontend Routes](#frontend-routes)
- [Supabase Service Layer](#supabase-service-layer)
- [Third-Party APIs & Services](#third-party-apis--services)
- [Authentication & Authorization](#authentication--authorization)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend (Web)** | React | 19.1.0 |
| **Build Tool** | Vite | 6.x |
| **Routing** | React Router | v7 |
| **Styling** | Tailwind CSS | v4 |
| **Charts** | Recharts | 3.8 |
| **PDF Export** | jsPDF + html2canvas | - |
| **Frontend (Mobile)** | React Native (Expo) | 0.81.5 / Expo 54 |
| **Backend / BaaS** | Supabase (PostgreSQL 17) | - |
| **Serverless Functions** | Supabase Edge Functions (Deno v2) | - |
| **ML/AI Server** | Python FastAPI | 0.109+ |
| **ML Model** | DistilBERT (fine-tuned Bloom's Taxonomy) | - |
| **ML Framework** | PyTorch + HuggingFace Transformers | 2.1+ / 4.37+ |
| **AI Suggestions** | Google Generative AI (Gemini) | - |
| **CAPTCHA** | Cloudflare Turnstile | - |
| **Auth** | Supabase Auth (JWT) | - |
| **Monorepo** | npm workspaces | - |

---

## Project Structure

```
eduquest/
├── apps/
│   ├── web/                          # React web application (Vite)
│   │   ├── src/
│   │   │   ├── components/           # Reusable UI components
│   │   │   │   ├── admin/            # Admin-specific components
│   │   │   │   ├── container/        # Layout containers & item-analysis UI
│   │   │   │   ├── AdminProtectedRoute.jsx
│   │   │   │   ├── ProtectedRoute.jsx
│   │   │   │   ├── QuizAnalysisResults.jsx
│   │   │   │   ├── QuizSuggestions.jsx
│   │   │   │   └── Turnstile.jsx     # Cloudflare CAPTCHA widget
│   │   │   ├── hooks/
│   │   │   │   ├── analysisHook/     # useGeminiSuggest, analysis hooks
│   │   │   │   └── authHook/         # useLogin, auth hooks
│   │   │   ├── pages/
│   │   │   │   ├── auth/             # Login, Register, Password Recovery
│   │   │   │   ├── instructors/      # Instructor dashboard pages
│   │   │   │   ├── admin/            # Admin dashboard pages
│   │   │   │   ├── item-analysis/    # Item analysis pages
│   │   │   │   └── PublicQuizPage.jsx
│   │   │   ├── routes/
│   │   │   │   └── routes.jsx        # React Router configuration
│   │   │   ├── services/
│   │   │   │   ├── item-analysis/    # Item analysis service modules
│   │   │   │   ├── adminService.js   # Admin API calls
│   │   │   │   ├── authService.js    # Authentication calls
│   │   │   │   ├── quizService.js    # Quiz CRUD operations
│   │   │   │   ├── quizAnalysisService.js  # FastAPI communication
│   │   │   │   ├── sectionService.js # Section CRUD operations
│   │   │   │   └── studentService.js # Student profile operations
│   │   │   ├── supabase/
│   │   │   │   └── supabaseClient.js # Supabase client initialization
│   │   │   └── App.jsx
│   │   ├── index.html
│   │   └── vite.config.js
│   │
│   └── mobile/                       # React Native mobile app (Expo)
│       ├── app/                      # File-based routing (Expo Router)
│       │   ├── (tabs)/              # Tab navigation
│       │   └── _layout.tsx          # Root layout
│       ├── components/              # Mobile UI components
│       └── constants/               # Theme constants
│
├── fastapi_blooms/                   # Python FastAPI ML server
│   ├── main.py                      # FastAPI endpoints
│   ├── classifier.py                # DistilBERT Bloom's Taxonomy classifier
│   ├── model/                       # Fine-tuned model weights
│   └── requirements.txt
│
├── supabase/                         # Supabase configuration
│   ├── functions/                   # Edge Functions (Deno/TypeScript)
│   │   ├── create-instructor/
│   │   ├── delete-instructor/
│   │   ├── toggle-instructor-status/
│   │   └── change-instructor-password/
│   ├── migrations/                  # PostgreSQL migrations
│   └── config.toml                  # Local dev configuration
│
├── package.json                      # Root workspace config
└── package-lock.json
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                     │
│   ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐     │
│   │  React Web   │   │ React Native │   │  Public Quiz Page  │     │
│   │  (Vite SPA)  │   │  (Expo App)  │   │  (No Auth Needed)  │     │
│   └──────┬───────┘   └──────┬───────┘   └────────┬───────────┘     │
└──────────┼──────────────────┼────────────────────┼─────────────────┘
           │                  │                    │
           ▼                  ▼                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       SUPABASE (BaaS)                                │
│   ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│   │  PostgreSQL  │  │  Auth (JWT)  │  │  Edge Functions (Deno) │    │
│   │   Database   │  │  + OAuth     │  │  - create-instructor   │    │
│   │  (12 tables) │  │  + RBAC      │  │  - delete-instructor   │    │
│   │  + RLS       │  │              │  │  - toggle-status       │    │
│   │  + RPCs      │  │              │  │  - change-password     │    │
│   └──────────────┘  └──────────────┘  └────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                                  │
│   ┌────────────────┐  ┌─────────────────┐  ┌────────────────────┐   │
│   │ FastAPI Server │  │ Google Gemini   │  │ Cloudflare         │   │
│   │ (Bloom's AI)   │  │ (AI Suggestions)│  │ Turnstile (CAPTCHA)│   │
│   │ :8000          │  │                 │  │                    │   │
│   │ - DistilBERT   │  │ - Question      │  │ - Bot protection   │   │
│   │ - PyTorch      │  │   improvement   │  │ - Login/Register   │   │
│   └────────────────┘  │ - Distractor    │  └────────────────────┘   │
│                       │   analysis      │                           │
│                       └─────────────────┘                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tables (12 total)

#### `profiles`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | References auth.users |
| username | TEXT | Unique username |
| first_name | TEXT | First name |
| last_name | TEXT | Last name |
| email | TEXT | Email address |
| bio | TEXT | User biography |
| avatar_url | TEXT | Profile picture URL |
| is_instructor | BOOLEAN | Instructor role flag |
| is_admin | BOOLEAN | Admin role flag |
| is_student | BOOLEAN | Student role flag |
| is_approved | BOOLEAN | Account approval status |
| is_disabled | BOOLEAN | Account disabled status |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

#### `sections`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Section ID |
| instructor_id | UUID (FK) | References profiles.id |
| name | TEXT | Section name |
| description | TEXT | Section description |
| exam_code | TEXT | Exam code |
| color_scheme | TEXT | UI color scheme |
| is_archived | BOOLEAN | Archive status |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

#### `quizzes`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Quiz ID |
| instructor_id | UUID (FK) | References profiles.id |
| section_id | UUID (FK) | References sections.id |
| title | TEXT | Quiz title |
| description | TEXT | Quiz description |
| duration | INTEGER | Duration in minutes |
| share_token | TEXT | Unique public share token |
| is_published | BOOLEAN | Published status |
| is_open | BOOLEAN | Open for attempts |
| is_archived | BOOLEAN | Archive status |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

#### `questions`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Question ID |
| quiz_id | UUID (FK) | References quizzes.id |
| type | TEXT | Question type (multiple_choice, etc.) |
| text | TEXT | Question text |
| options | JSONB | Array of answer options |
| correct_answer | INTEGER | Index of correct answer |
| points | INTEGER | Points value |
| flag | TEXT | Review flag status |
| original_text | TEXT | Original question text (before AI revision) |
| original_options | JSONB | Original options |
| original_correct_answer | INTEGER | Original correct answer |
| previous_text | TEXT | Previous revision text |
| previous_options | JSONB | Previous revision options |
| previous_correct_answer | INTEGER | Previous correct answer |
| revised_content | TEXT | AI-suggested revision (draft) |
| revised_options | JSONB | AI-suggested options (draft) |
| revision_history | JSONB | Array of revision records |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

#### `quiz_attempts`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Attempt ID |
| quiz_id | UUID (FK) | References quizzes.id |
| user_id | UUID (FK) | References profiles.id (nullable for guests) |
| guest_name | TEXT | Guest student name |
| guest_email | TEXT | Guest student email |
| score | NUMERIC | Total score |
| status | TEXT | Attempt status (in_progress, completed) |
| section_id | UUID (FK) | References sections.id |
| started_at | TIMESTAMPTZ | Start timestamp |
| completed_at | TIMESTAMPTZ | Completion timestamp |

#### `quiz_responses`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Response ID |
| attempt_id | UUID (FK) | References quiz_attempts.id |
| question_id | UUID (FK) | References questions.id |
| answer | INTEGER | Student's selected answer index |
| is_correct | BOOLEAN | Whether answer is correct |
| points_earned | NUMERIC | Points awarded |
| created_at | TIMESTAMPTZ | Created timestamp |

#### `student_profile`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Student profile ID |
| student_email | TEXT | Student email |
| student_id | TEXT | Student ID number |
| avg_score | NUMERIC | Average quiz score |

#### `student_sections`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Enrollment ID |
| student_id | UUID (FK) | References student_profile.id |
| section_id | UUID (FK) | References sections.id |
| enrolled_at | TIMESTAMPTZ | Enrollment timestamp |

#### `item_analysis`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Analysis ID |
| quiz_id | UUID (FK) | References quizzes.id |
| question_id | UUID (FK) | References questions.id |
| difficulty_index | NUMERIC | P-value (0-1) |
| difficulty_status | TEXT | Easy / Moderate / Difficult |
| discrimination_index | NUMERIC | Discrimination value |
| discrimination_status | TEXT | Discrimination label |
| total_takers | INTEGER | Total quiz takers |
| correct_takers | INTEGER | Number who answered correctly |
| auto_flag | TEXT | Auto-generated flag (approved/needs_revision) |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

#### `item_distractor_analysis`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Distractor analysis ID |
| item_analysis_id | UUID (FK) | References item_analysis.id (CASCADE) |
| option_identifier | TEXT | Option label (A, B, C, D) |
| taker_count | INTEGER | Number who chose this option |
| taker_percentage | NUMERIC | Percentage who chose this option |
| is_correct_answer | BOOLEAN | Whether this is the correct option |
| created_at | TIMESTAMPTZ | Created timestamp |

#### `quiz_analysis_submissions`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Submission ID |
| quiz_id | UUID (FK) | References quizzes.id |
| instructor_id | UUID (FK) | References profiles.id |
| analysis_results | JSONB | Full analysis results |
| instructor_message | TEXT | Instructor notes to admin |
| status | TEXT | pending / reviewed / approved |
| admin_feedback | TEXT | Admin feedback |
| reviewed_by | UUID (FK) | Admin who reviewed |
| reviewed_at | TIMESTAMPTZ | Review timestamp |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

#### `notifications`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Notification ID |
| user_id | UUID (FK) | References profiles.id |
| title | TEXT | Notification title |
| message | TEXT | Notification message |
| type | TEXT | Notification type |
| link | TEXT | Related link |
| is_read | BOOLEAN | Read status |
| created_at | TIMESTAMPTZ | Created timestamp |

### Database Functions (PL/pgSQL)

| Function | Description |
|----------|-------------|
| `save_quiz_response(attempt_id, question_id, answer)` | Server-side grading - students never see correct answers |
| `submit_quiz_attempt(attempt_id, answers JSONB)` | Grade entire quiz attempt and return total score |
| `get_instructor_profiles()` | RPC to fetch all instructor profiles (admin use) |
| `update_updated_at_column()` | Trigger function for auto-updating timestamps |

### Row-Level Security (RLS)

All tables have RLS enabled with policies:

- **Quizzes** - Instructors view/update own; anyone can view published quizzes
- **Questions** - View questions in published quizzes or own quizzes; instructors insert/update own
- **Quiz Attempts** - Users view own attempts or instructor views their quiz attempts
- **Profiles** - Everyone can view; users update own
- **Sections** - Instructors full CRUD on own sections
- **Item Analysis** - Instructors full CRUD on their quiz analyses
- **Quiz Analysis Submissions** - Instructors insert/view own; admins view/update all
- **Notifications** - Users full CRUD on own notifications

---

## API Endpoints

### FastAPI Endpoints (Bloom's Taxonomy Classifier)

**Base URL:** `http://localhost:8000`

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| `GET` | `/` | API status check | - | `{ status, message }` |
| `GET` | `/health` | Model health check | - | `{ status, model_loaded }` |
| `POST` | `/api/quiz/analyze` | Classify questions by Bloom's level | `{ quizId, questions[] }` | `{ quizId, results[] }` |
| `POST` | `/api/quiz/forward-to-admin` | Forward analysis results to admin | `{ quizId, instructorId, analysisResults, message }` | `{ success }` |

**Bloom's Taxonomy Levels Classified:**
1. Remember
2. Understand
3. Apply
4. Analyze
5. Evaluate
6. Create

### Supabase Edge Functions

**Base URL:** `{SUPABASE_URL}/functions/v1`

| Function | Method | Description | Auth | Request Body |
|----------|--------|-------------|------|-------------|
| `create-instructor` | POST | Create new instructor account | Admin Bearer Token | `{ email, password, firstName, lastName, username }` |
| `delete-instructor` | POST | Delete instructor and cascade all data | Admin Bearer Token | `{ userId }` |
| `toggle-instructor-status` | POST | Enable/disable instructor account | Admin Bearer Token | `{ userId, disabled }` |
| `change-instructor-password` | POST | Change instructor password | Admin Bearer Token | `{ userId, newPassword }` |

### Supabase Database RPCs

| RPC Name | Description | Parameters |
|----------|-------------|------------|
| `get_instructor_profiles` | Fetch all instructor profiles | None |
| `save_quiz_response` | Server-side answer grading | `attempt_id, question_id, answer` |
| `submit_quiz_attempt` | Grade and submit entire quiz | `attempt_id, answers (JSONB)` |

---

## Frontend Routes

### Public Routes (No Auth Required)

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Login` | Login page |
| `/register` | `Register` | Registration page |
| `/recover-password` | `RecoverPassword` | Password recovery |
| `/change-password` | `ChangePassword` | Password change (from email link) |
| `/quiz/:shareToken` | `PublicQuizPage` | Public quiz taking page |

### Instructor Routes (Auth + Instructor Role Required)

| Path | Component | Description |
|------|-----------|-------------|
| `/instructor-dashboard` | `InstructorDashboard` | Main dashboard |
| `/instructor-dashboard/section/:sectionId` | `SectionDetail` | Section detail view |
| `/instructor-dashboard/quizzes` | `QuizzesPageMain` | All quizzes list |
| `/instructor-dashboard/instructor-quiz` | `InstructorQuiz` | Create new quiz |
| `/instructor-dashboard/instructor-quiz/:quizId` | `InstructorQuiz` | Edit existing quiz |
| `/instructor-dashboard/quiz-results/:quizId` | `QuizResults` | Quiz results overview |
| `/instructor-dashboard/quiz-results/:quizId/attempt/:attemptId` | `QuizResultDetail` | Individual attempt detail |
| `/instructor-dashboard/instructor-questions` | `InstructorQuestions` | Question management |
| `/instructor-dashboard/question-bank` | `QuestionBank` | Question bank |
| `/instructor-dashboard/question-bank/:quizId` | `QuestionBank` | Quiz-specific question bank |
| `/instructor-dashboard/instructor-profile` | `InstructorProfile` | Profile settings |
| `/instructor-dashboard/item-difficulty-analysis` | `ItemAnalysisPage` | Item difficulty analysis |
| `/instructor-dashboard/my-submissions` | `MySubmissions` | Analysis submissions to admin |

### Admin Routes (Auth + Admin Role Required)

| Path | Component | Description |
|------|-----------|-------------|
| `/admin-dashboard` | `AdminDashboard` | Admin main dashboard |
| `/admin-dashboard/instructors` | `AdminInstructors` | Manage instructors |
| `/admin-dashboard/create-instructor` | `AdminCreateInstructor` | Create new instructor |
| `/admin-dashboard/registration-requests` | `AdminRegistrationRequests` | Approve/reject registrations |
| `/admin-dashboard/quiz-reviews` | `AdminQuizReviews` | Review quiz analysis submissions |
| `/admin-dashboard/quiz-reviews/:submissionId` | `AdminQuizReviewDetail` | Individual submission review |

---

## Supabase Service Layer

### authService.js

| Function | Supabase Method | Description |
|----------|----------------|-------------|
| `signInWithPassword(email, password)` | `auth.signInWithPassword()` | Email/password login |
| `signUp(userData)` | `auth.signUp()` | New user registration |
| `signOut()` | `auth.signOut()` | Sign out user |
| `getUser()` | `auth.getUser()` | Get current user |
| `signInWithOAuth(provider)` | `auth.signInWithOAuth()` | OAuth login (Google) |
| `resetPasswordForEmail(email)` | `auth.resetPasswordForEmail()` | Send password reset email |
| `updateUser(password)` | `auth.updateUser()` | Update user password |

### quizService.js

| Function | Table | Operation | Description |
|----------|-------|-----------|-------------|
| `getQuizById(quizId)` | `quizzes` | SELECT | Fetch quiz by ID |
| `getQuizByShareToken(shareToken)` | `quizzes` | SELECT | Fetch published quiz by share token |
| `getQuizzesByInstructor(instructorId)` | `quizzes` | SELECT | All quizzes by instructor (with attempt count) |
| `getQuizzesBySection(sectionId)` | `quizzes` | SELECT | All quizzes in section (with attempt count) |
| `createQuiz(quizData)` | `quizzes` | INSERT | Create new quiz |
| `updateQuiz(quizId, updates)` | `quizzes` | UPDATE | Update quiz metadata |
| `deleteQuiz(quizId)` | `quizzes` | DELETE | Delete quiz |
| `getQuestionsByQuiz(quizId)` | `questions` | SELECT | All questions for a quiz |
| `getQuestionCount(quizId)` | `questions` | COUNT | Count questions in quiz |
| `createQuestions(questions)` | `questions` | INSERT (batch) | Batch create questions |
| `deleteQuestion(questionId)` | `questions` | DELETE | Delete single question |
| `updateQuestion(questionId, updates)` | `questions` | UPDATE | Update question |
| `deleteQuestionsByQuiz(quizId)` | `questions` | DELETE | Delete all questions in quiz |
| `createAttempt(attemptData)` | `quiz_attempts` | INSERT | Start quiz attempt |
| `getAttemptsByQuiz(quizId)` | `quiz_attempts` | SELECT | All attempts for quiz |
| `getAttemptById(attemptId)` | `quiz_attempts` | SELECT | Fetch single attempt |
| `updateAttempt(attemptId, updates)` | `quiz_attempts` | UPDATE | Update attempt (score, status) |
| `saveResponse(responseData)` | `quiz_responses` | INSERT | Save individual response |
| `getResponsesByAttempt(attemptId)` | `quiz_responses` | SELECT | Get responses for attempt |
| `getResponsesDetailsByAttempt(attemptId)` | `quiz_responses` | SELECT | Detailed responses for attempt |
| `upsertResponse(responseData)` | `quiz_responses` | UPSERT | Auto-save response |
| `deleteResponsesByAttempt(attemptId)` | `quiz_responses` | DELETE | Delete all responses for attempt |

### adminService.js

| Function | Table/Service | Operation | Description |
|----------|--------------|-----------|-------------|
| `getInstructors()` | RPC | `get_instructor_profiles` | Fetch all instructors |
| `createInstructor(data)` | Edge Function | `create-instructor` | Create instructor account |
| `toggleInstructorStatus(userId, disabled)` | Edge Function | `toggle-instructor-status` | Enable/disable instructor |
| `getRegistrationRequests()` | `profiles` | SELECT | Get pending registrations |
| `approveRegistration(userId)` | `profiles` | UPDATE | Approve instructor registration |
| `rejectRegistration(userId)` | Edge Function | `delete-instructor` | Reject and delete registration |
| `changeInstructorPassword(userId, password)` | Edge Function | `change-instructor-password` | Admin password reset |

### sectionService.js

| Function | Table | Operation | Description |
|----------|-------|-----------|-------------|
| `getSectionsByInstructor(instructorId)` | `sections` | SELECT | Non-archived sections |
| `getSectionById(sectionId)` | `sections` | SELECT | Single section |
| `createSection(sectionData)` | `sections` | INSERT | Create section |
| `updateSection(sectionId, updates)` | `sections` | UPDATE | Update section |
| `deleteSection(sectionId)` | `sections` | DELETE | Delete section |
| `archiveSection(sectionId)` | `sections` | UPDATE | Archive section |

### studentService.js

| Function | Table | Operation | Description |
|----------|-------|-----------|-------------|
| `getStudentByEmail(email)` | `student_profile` | SELECT | Find student by email |
| `getStudentById(studentId)` | `student_profile` | SELECT | Find student by ID |
| `createStudent(studentData)` | `student_profile` | INSERT | Create student profile |
| `updateStudent(studentId, updates)` | `student_profile` | UPDATE | Update student |
| `deleteStudent(studentId)` | `student_profile` | DELETE | Delete student |

### Item Analysis Services

| Function | Table | Operation | Description |
|----------|-------|-----------|-------------|
| `saveItemAnalysis(quizId, results)` | `item_analysis`, `item_distractor_analysis`, `questions`, `quiz_analysis_submissions` | INSERT/UPDATE/DELETE | Full analysis save with flag sync |
| `syncAnalysisToDatabase(data, quizId)` | `item_analysis`, `item_distractor_analysis` | UPSERT | Sync analysis data |
| `getItemAnalysis(quizId)` | `item_analysis` | SELECT | Fetch analysis for quiz |
| `getItemAnalysisWithDistractors(quizId)` | `item_analysis` + `item_distractor_analysis` | SELECT (JOIN) | Analysis with distractor details |
| `hasItemAnalysis(quizId)` | `item_analysis` | SELECT (EXISTS) | Check if analysis exists |
| `deleteItemAnalysis(quizId)` | `item_analysis` | DELETE (CASCADE) | Delete analysis data |
| `updateQuestionFlag(questionId, flag)` | `questions` | UPDATE | Update question flag |
| `fetchProfiles(userIds)` | `profiles` | SELECT | Batch fetch profiles |
| `getInstructorsSection(instructorId)` | `sections` | SELECT | Instructor's sections |
| `getQuizAttempts(quizId)` | `quiz_attempts` | SELECT | Quiz attempt data |
| `getQuizResponse(questionIds)` | `quiz_responses` | SELECT | Responses for questions |
| `getQuizzes(sectionId)` | `quizzes` | SELECT | Quizzes in section |

---

## Third-Party APIs & Services

### 1. Supabase
- **Purpose:** Backend-as-a-Service (Database, Auth, Real-time, Edge Functions, Storage)
- **Database:** PostgreSQL 17 with Row-Level Security
- **Auth:** JWT-based with email/password and OAuth (Google)
- **Edge Functions:** Deno v2 serverless functions for admin operations
- **SDK:** `@supabase/supabase-js v2.90.1`

### 2. Google Generative AI (Gemini)
- **Purpose:** AI-powered question improvement suggestions
- **SDK:** `@google/generative-ai`
- **Models Used (fallback order):**
  1. `gemini-2.0-flash`
  2. `gemini-flash-latest`
  3. `gemini-pro-latest`
  4. `gemini-1.5-flash`
  5. `gemini-1.5-pro`
- **Features:**
  - Generate improved question text for moderate difficulty (P-value 0.25-0.75)
  - Suggest better multiple-choice distractors
  - Question revision with history tracking
- **Hook:** `useGeminiSuggest.jsx`

### 3. Cloudflare Turnstile
- **Purpose:** CAPTCHA/bot protection on login and registration
- **Component:** `Turnstile.jsx`
- **Integration:** Client-side widget rendering with token callback
- **Theme:** Light, flexible sizing

### 4. FastAPI + DistilBERT (Self-hosted ML)
- **Purpose:** Bloom's Taxonomy question classification
- **Model:** Fine-tuned DistilBERT
- **Framework:** PyTorch 2.1+ / HuggingFace Transformers 4.37+
- **Server:** FastAPI with Uvicorn
- **Port:** 8000
- **Classifies into 6 cognitive levels:** Remember, Understand, Apply, Analyze, Evaluate, Create

---

## Authentication & Authorization

### Method
- **Type:** JWT-based via Supabase Auth
- **Token Expiry:** 3600 seconds (1 hour)
- **Token Refresh:** Auto-refresh every 5 minutes with rotation enabled
- **Session Storage:** `sessionStorage` (not `localStorage`)
- **OAuth:** Google provider configured

### Roles (stored in `profiles` table)

| Role | Flag | Access |
|------|------|--------|
| **Admin** | `is_admin = true` | Full platform management, instructor CRUD, quiz review |
| **Instructor** | `is_instructor = true` | Quiz creation, section management, item analysis |
| **Student** | `is_student = true` | Default role, quiz taking |

### Route Protection

- **`<ProtectedRoute>`** - Requires authentication + instructor role
- **`<AdminProtectedRoute>`** - Requires authentication + admin role
- **Public routes** - No authentication required (login, register, public quiz)

### Approval Flow
1. User registers with `@student.buksu.edu.ph` email
2. Account created with `is_approved = false`
3. Admin reviews and approves/rejects via registration requests
4. On approval: `is_approved = true`, `is_instructor = true`

---

## Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://ycebpvxbvlztyoysjwvx.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<supabase_anon_key>

# Auth
VITE_REDIRECT_URI=http://localhost:5173/auth/callback

# Google Gemini AI
VITE_GEMINI_API_KEY=<gemini_api_key>

# Cloudflare Turnstile
VITE_TURNSTILE_SITE_KEY=0x4AAAAAACus2J8DKC1y7hnS

# Account Domain Restrictions
VITE_INSTRUCTOR_ACCOUNT_EXTENSION=@student.buksu.edu.ph
VITE_STUDENT_ACCOUNT_EXTENSION=@gmail.com
```

---

## Local Development

### Prerequisites
- Node.js (LTS)
- Python 3.10+
- Supabase CLI

### Ports

| Service | Port |
|---------|------|
| Vite Dev Server (Web) | 5173 |
| FastAPI ML Server | 8000 |
| Supabase Local (API) | 54321 |
| Supabase Local (DB) | 54322 |
| Supabase Studio | 54323 |

### Starting the Project

```bash
# Install dependencies (from root)
npm install

# Start web app
cd apps/web
npm run dev

# Start FastAPI server
cd fastapi_blooms
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Start Supabase local (optional)
supabase start
```

### Key Dependencies

**Web App:**
- `react` ^19.1.0
- `react-router-dom` ^7.x
- `@supabase/supabase-js` ^2.90.1
- `@google/generative-ai`
- `tailwindcss` ^4.x
- `recharts` ^3.8
- `jspdf` + `html2canvas`
- `react-toastify`

**FastAPI Server:**
- `fastapi` ^0.109
- `uvicorn`
- `torch` ^2.1
- `transformers` ^4.37
- `pydantic`
- `safetensors`

**Mobile App:**
- `expo` ^54
- `react-native` ^0.81.5
- `expo-router` ^6
