# EduQuest Performance and Stress Test Results

**Test date:** 11 November 2026 (UTC+8)
**Status:** Load test (1,000 concurrent students) **passed**. Spike, stress, soak, instructor and exam-day tests are still to be run.

---

## 1. Objective

The panel's objective: show that EduQuest can handle **1,000+ students taking exams at
the same time**, while about **100 instructors** create exams and run Bloom's
taxonomy analysis.

## 2. Test environment

| Item | Value |
|---|---|
| Backend | Supabase: PostgreSQL 17, PostgREST API, Supabase Auth |
| Supabase plan | Free |
| Test project | A separate project, not the production one. It has the same database structure (tables, functions, security policies, triggers), copied from production on 11 Nov 2026 after the latest fixes were applied. |
| Region | Northeast Asia (Seoul), the same as production |
| Load generator | k6 v2.3.0 on one Windows 11 laptop (15.3 GB RAM) |
| Network round trip to the server | about 150 ms per request (the minimum possible response time from this laptop) |
| Production data used | None. All test accounts and exams were generated. |

### Test data

| Data | Amount |
|---|---|
| Student accounts | 2,000 |
| Instructor accounts (approved) | 100 |
| Sections | 100 (one per instructor) |
| Exam-day exams | 10 published exams × 50 questions (MCQ and true/false), each shared with 20 sections |
| Results-page exam | 1 exam with 1,000 completed attempts (50,000 saved answers), for the instructor test |

## 3. Method

Each simulated student (k6 "virtual user") sends exactly the requests the real exam page
(`PublicQuizPage.jsx`) sends:

| Step | Requests per student |
|---|---|
| 1. Open the exam link | 1 (exam lookup by share link) + 1 (load questions) |
| 2. Start the exam | 1 student-profile lookup, 1 profile create/update, 1 attempt lookup, 1 create attempt, 1 save question order |
| 3. Answer 50 questions | 1 save per answer click (10% of students change an answer, about 3% skip one), plus 1 time-spent save when moving to the next question |
| 4. Submit | 1 (graded on the server) |

**Pass criteria (set before testing):**

| Measure | Target |
|---|---|
| Failed requests | under 1% |
| Students who finish and receive a score | over 99% |
| Saving an answer / time spent, 95th percentile | under 500 ms |
| Submitting the exam, 95th percentile | under 2,000 ms |
| Opening the exam, loading questions, creating the attempt, 95th percentile | under 1,500 ms |
| Instructor results page loaded, 95th percentile | under 5 s |
| Creating an exam with 50 questions, 95th percentile | under 5 s |
| Bloom's analysis of 50 questions, 95th percentile | under 15 s |

*"95th percentile" (p95) means 95% of requests were faster than this value.*

## 4. Results summary

| Test | What it simulates | Users | Requests | Failed | Save answer p95 | Submit p95 | Exam start p95 | Completed | Result |
|---|---|---|---|---|---|---|---|---|---|
| Dry run | Small check of the full flow | 20 | 2,228 | 0.00% | 169 ms | 168 ms | 490 ms | 100% (20/20) | ✓ Pass |
| **Load** | **1,000 students arrive over 5 min, answer at a normal pace (15–45 s per question)** | **1,000** | **111,252** | **0.00%** | **169 ms** | **183 ms** | **229 ms** | **100% (1,000/1,000)** | **✓ Pass** |
| Spike | 1,000 students start within 30 s and all submit in the same second | 1,000 | | | | | | | Not yet run |
| Stress | Ramp from 0 to 2,000 students to find the breaking point | up to 2,000 | | | | | | | Not yet run |
| Soak | 400 students for 2 hours | 400 | | | | | | | Not yet run |
| Instructors | 100 instructors: results page, exam creation, Bloom's analysis | 100 | | | | | | | Not yet run |
| Exam day | 1,000 students + 100 instructors together | 1,100 | | | | | | | Not yet run |

## 5. Load test: 1,000 concurrent students

**Run:** 11 Nov 2026, 04:21–04:54 (UTC+8). Raw output: `results/load.json`; charts: `results/load.html`.

### 5.1 Overview

| Measure | Result |
|---|---|
| Duration | 33 min 29 s |
| Simulated students | 1,000 |
| Exams completed and scored | **1,000 / 1,000 (100%)** |
| Total requests | 111,252 |
| Failed requests | **0 (0.00%)** |
| Average throughput | 55.4 requests per second |
| Data sent / received | 57.0 MB / 72.9 MB |
| Time per student to finish the exam | average 25 min 40 s, longest 29 min 39 s |

### 5.2 Response time by request type

| Request | Count | Average | Median | p90 | p95 | p99 | Max | Target (p95) | Result |
|---|---|---|---|---|---|---|---|---|---|
| Open exam link | 1,000 | 212 ms | 182 ms | 210 ms | **229 ms** | 510 ms | 3.28 s | < 1,500 ms | ✓ |
| Load questions | 1,000 | 162 ms | 152 ms | 167 ms | **177 ms** | 350 ms | 2.63 s | < 1,500 ms | ✓ |
| Create attempt | 1,000 | 167 ms | 150 ms | 168 ms | **190 ms** | 836 ms | 1.29 s | < 1,500 ms | ✓ |
| Save answer | 53,252 | 158 ms | 150 ms | 161 ms | **169 ms** | 216 ms | 3.92 s | < 500 ms | ✓ |
| Save time spent | 50,000 | 153 ms | 149 ms | 160 ms | **167 ms** | 202 ms | 2.87 s | < 500 ms | ✓ |
| Submit exam | 1,000 | 165 ms | 161 ms | 175 ms | **183 ms** | 299 ms | 556 ms | < 2,000 ms | ✓ |
| Other start-up requests (profile, attempt lookup, question order) | 4,000 | | | | | | | | |
| **All requests** | **111,252** | **157 ms** | **150 ms** | **162 ms** | **171 ms** | **221 ms** | **3.92 s** | | |

### 5.3 Functional checks during the test

| Check | Passed | Failed |
|---|---|---|
| Exam link found | 1,000 | 0 |
| All 50 questions loaded | 1,000 | 0 |
| **Answer key not sent to the student** | **1,000** | **0** |
| Student profile created | 1,000 | 0 |
| Attempt created | 1,000 | 0 |
| Question order saved | 1,000 | 0 |
| Answer saved | 53,252 | 0 |
| Time spent saved | 50,000 | 0 |
| Exam submitted and scored | 1,000 | 0 |
| **Total** | **110,252 (100%)** | **0** |

### 5.4 Data integrity (checked directly in the database afterwards)

| Check | Expected | Found | Result |
|---|---|---|---|
| Attempts created | 1,000 | 1,000 | ✓ |
| Attempts marked completed | 1,000 | 1,000 | ✓ |
| Saved answers (1 per question per student) | 50,000 | 50,000 | ✓ No answers lost |
| Questions answered (about 3% skipped on purpose) | about 48,500 | 48,444 (96.9%) | ✓ |
| Answers with time spent recorded | 50,000 | 50,000 (none at 0) | ✓ |
| Average score with random answers | about 14.6 / 50 | 14.0 / 50 (min 5, max 25) | ✓ Grading correct under load |

### 5.5 Interpretation

- With 1,000 students taking a 50-question exam at the same time, **every student finished
  and every answer was saved**, with no failed requests.
- Response times under load (p95: 167–229 ms) were **almost the same as with 20 students**
  in the dry run (p95: 166–490 ms). About 150 ms of each request is network travel between
  the test laptop and the Seoul servers, so the system added very little delay at this load.
- A handful of requests took 2–4 s (the "Max" column), but 99% of answer saves finished
  within 216 ms.
- The exam's answer key was never sent to a student's browser (checked on all 1,000 exams).

## 6. Dry run: 20 students

| Measure | Result |
|---|---|
| Requests | 2,228, 0 failed |
| Exams completed | 20 / 20 |
| p95: save answer / save time / submit | 169 ms / 166 ms / 168 ms |
| p95: open exam link / load questions / create attempt | 490 ms / 189 ms / 187 ms |
| Checks passed | 2,208 / 2,208 |

## 7. Automated database correctness tests

The exam database functions are covered by 44 automated tests
(`supabase/tests/exam_grading.test.mjs`). They run the real migration files on an
in-memory PostgreSQL database and act as different users (the student, another student, a
logged-out visitor, instructors, Senior Faculty, Department Head).

| Area tested | Checks | Result |
|---|---|---|
| Setup (old unsafe function removed) | 1 | ✓ 1 / 1 |
| Who may save or submit an attempt | 5 | ✓ 5 / 5 |
| Saving answers (atomic save, re-grading, time tracking) | 7 | ✓ 7 / 7 |
| Students can't change score, status or start time | 3 | ✓ 3 / 3 |
| Submitting (grading, no lost answers, safe retries, auto-answer credit) | 7 | ✓ 7 / 7 |
| Closed and re-opened attempts | 5 | ✓ 5 / 5 |
| Question loader without the answer key | 5 | ✓ 5 / 5 |
| Answer key hidden from logged-out users | 3 | ✓ 3 / 3 |
| Only staff can read the questions table | 8 | ✓ 8 / 8 |
| **Total** | **44** | **✓ 44 / 44** |

## 8. Problems found and fixed during this testing

| # | Problem found | Impact | Fix | Verified by |
|---|---|---|---|---|
| 1 | Two saves for the same question arriving together could collide, and one was silently dropped | Lost answers or lost time under load | Saving is a single atomic database operation | DB tests; load test (50,000 / 50,000 answers saved) |
| 2 | The time-tracking save overwrote the student's answer with "no answer" | Lost answers | A time-only save never changes the stored answer | DB tests |
| 3 | Time on a question was counted twice when a student changed their answer | Inflated time-per-question statistics | The answer save no longer re-sends the running time | Code change; load test (all 50,000 rows have time) |
| 4 | Submitting ran about 2 database queries per question in a loop, and an empty answer in the submission could erase an answer that was already saved | Slow submissions when many students finish together; possible lost answers | Submission writes and grades everything in 3 statements and never erases a saved answer | DB tests; load test (submit p95 183 ms) |
| 5 | Any logged-in user could save into or submit someone else's attempt, or re-submit a finished one | Cheating, tampering | Save and submit check the owner and that the attempt is still open; retrying a submit is safe | DB tests |
| 6 | Students could set their own score, status or exam start time through the API | Cheating, extra exam time | These columns can only be changed by the server's grading function | DB tests |
| 7 | The exam's answer key was sent to students' browsers, and the question-loading function had never worked | Students could read the answers in the browser's developer tools | Rewrote the loader so it works and never returns the answer key; the exam page no longer requests it | DB tests; load test (1,000 / 1,000 checks) |
| 8 | Any signed-in user could read every published exam's questions with answers directly from the database API | Answer key exposed to students | Only staff (approved instructors, Department Heads, Senior Faculty) can read the questions table directly | DB tests |
| 9 | "Auto-answer" questions were never credited (the browser filled in the wrong answer format) | Students lost points they should have received | Auto-answer questions are credited on the server at submission | DB tests |

## 9. Known limitations and open issues

| Item | Details | Plan |
|---|---|---|
| Instructor results page with large exams | The page puts every attempt ID into one request URL and loads attempts without paging; Supabase returns at most 1,000 rows per request. Expected to fail at about 1,000 takers. | Measure in the instructor test, then move the counting into the database |
| Bloom's analysis service | Runs only on a local machine (`localhost:8000`); not deployed, so not yet load-tested | Deploy it, run the Bloom's test |
| One load-generating laptop | All traffic came from one computer and one internet address, while real students use many devices | Results are a lower bound for network effects; note in the report |
| Free tier | Results describe Supabase's Free plan | A paid plan would have more capacity |
| Browser rendering | The test measures the server and API, not how fast the page draws in the browser | The front end is static files served by a hosting provider |

## 10. How to reproduce

All scripts are in `stress-test/`. See `stress-test/README.md` for the full steps: create
a test project, copy the database structure, seed the test data, then run each scenario
with k6.
