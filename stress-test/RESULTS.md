# EduQuest Performance and Stress Test Results

**Test date:** 11 November 2026 (UTC+8)
**Status:** Bloom's AI batch classification (the panel's objective) benchmarked on a laptop: stable up to 100 simultaneous analyses after the fixes, with response time growing with the number of simultaneous batches (section 5D). Exam taking: load test (1,000 concurrent students) **passed**; spike test first failed (Free-tier server out of memory) and, after cutting requests per student by ~46%, **all 1,000 students finished** (section 5B). Instructor results page fixed for large exams (section 5C). The **exam-day test (1,000 students + 100 instructors at once) failed** on the Free-tier test server: it stopped answering 6 minutes in (section 5E). Stress and soak tests are still to be run.

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
| Spike (before) | 1,000 students start within 30 s, answer every 2–6 s, and all submit in the same second | 1,000 | 76,511 | 3.20% (all timeouts) | 53.3 s | 52.5 s | 35.0 s | 1.3% (13/1,000) | ✗ Fail (server out of memory) |
| **Spike (after fewer requests)** | Same, with ~46% fewer requests per student and submissions spread over 15 s | 1,000 | 60,671 | **0.00%** | 969 ms | 18.7 s | 21.8 s | **100% (1,000/1,000)** | ◐ Completed, but start and submit too slow |
| Stress | Ramp from 0 to 2,000 students to find the breaking point | up to 2,000 | | | | | | | Not yet run |
| Soak | 400 students for 2 hours | 400 | | | | | | | Not yet run |
| Instructors (before) | 100 instructors for 8 min: each opens one class's results (50 students) and creates 50-question exams | 100 | 6,755 | 0.43% | — | — | — | results page 98.7% loaded, p95 77.7 s | ◐ Works for one class, slow under load |
| **Instructors (after)** | Same, with results loaded in one request each | 100 | 5,364 | 0.32% | — | — | — | results page 98.6% loaded, p95 66.3 s, **−64% data** | ◐ Works, still slow under load (Free tier) |
| **Bloom's: concurrency levels (before → after)** | 1 to 64 instructors analyzing 50-question batches back to back, 60 s per level (laptop) | 1–64 | 208 → 294 batches | 0% → 0% | — | — | — | median at 4 at once: 13.2 s → **8.4 s**; memory 6.1 GB → **1.4 GB** | ✓ Stable; faster with fixes |
| **Bloom's: 100 instructors click Analyze at once (before → after)** | 100 batches of 50 questions sent together (laptop) | 100 | 100 | **20% timed out → 0%** | — | — | — | median wait 243 s → **165 s**; 80/100 → **100/100** done | ✓ Fixed (still slow: CPU-bound) |
| **Bloom's: re-analysis after editing 5 of 50 questions (before → after)** | 20 instructors, each analyzes then re-analyzes 5 times (laptop) | 20 | 120 | 1.7% → **0%** | — | — | — | re-analysis median 42.5 s → **5.5 s** | ✓ Fixed |
| Results of a 1,000-taker exam (one instructor) | Opening the full results of the 1,000-taker exam | 1 | | | | | | before: **400 Bad Request**; after: **0.4 s + 1.8 s** | ✓ Fixed |
| **Exam day (run 1)** | 1,000 students take the exam while 100 instructors view class results, create 50-question exams and run Bloom's analysis, 52 min | 1,100 | 76,281 | **50.39%** (timeouts) | 60 s (timeout) | — (none reached submit) | 0.2 s median | **0% (0/1,000)** | ✗ Fail (database server stopped answering after 6 min) |

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

## 5B. Spike test: 1,000 students starting together and answering very fast

**Run:** 11 Nov 2026, 22:08–22:28 (UTC+8). Raw output: `results/spike.json`; charts: `results/spike.html`.

Pace: every student answered a question every 2–6 seconds (versus 15–45 s in the load
test), and all were set to submit at the same second, 565 s after the start. This creates
about **8 times the request rate** of the load test (roughly 460 requests per second
demanded, versus about 55).

### Overview

| Measure | Result |
|---|---|
| Duration | 20 min 0 s (stopped at the time limit) |
| Students who opened the exam | 1,000 |
| Students whose questions loaded | 808 (192 timed out) |
| Attempts created | 762 |
| Exams submitted and scored | **13** (749 students were still mid-exam at the time limit) |
| Total requests | 76,511 |
| Failed requests | 2,454 (3.20%), **all of them 60-second timeouts**; no error responses |
| Throughput actually served | 62.2 requests per second on average |

### Response time by request type

| Request | Average | Median | p90 | p95 | Max | Target (p95) | Result |
|---|---|---|---|---|---|---|---|
| Open exam link | 17.7 s | 17.7 s | 33.6 s | 35.0 s | 36.3 s | < 1,500 ms | ✗ |
| Load questions | 24.6 s | 18.1 s | 60 s | 60 s | 60 s (timeout) | < 1,500 ms | ✗ |
| Create attempt | 17.5 s | 7.9 s | 49.3 s | 60 s | 60 s (timeout) | < 1,500 ms | ✗ |
| Save answer | 10.1 s | 536 ms | 45.0 s | 53.3 s | 60 s (timeout) | < 500 ms | ✗ |
| Save time spent | 7.9 s | 490 ms | 32.0 s | 52.6 s | 60 s (timeout) | < 500 ms | ✗ |
| Submit exam | 22.8 s | 9.6 s | 51.7 s | 52.5 s | 52.7 s | < 2,000 ms | ✗ |

### Diagnosis: the server ran out of memory

- **Not a network or client problem.** Connecting and TLS setup took almost no time; all of
  the delay was the server taking time to answer.
- **Not slow queries.** Database statistics show the exam functions need about 4.8 ms of
  database time per call on average.
- **Requests queued instead of failing.** The server accepted the requests but could not
  keep up, so they waited until the 60 s client timeout.
- **Cause: memory exhaustion on the Free-tier server.** Supabase dashboard (Reports), read
  at 22:36, just after the test:

| Resource | Reading | Limit | Status |
|---|---|---|---|
| Memory (RAM) | 232 MB used + 175 MB cache | 434 MB total | full |
| Swap (disk used as extra memory) | **544 MB (125% of RAM)** | | heavy swapping |
| Memory commitment | **1.46 GB** | 1.42 GB capacity | **SEVERE** (over capacity) |
| CPU | 36.7% busy, of which **24.3% waiting on disk (IOwait)** | 100% | waiting, not computing |
| Disk operations | 22 IOPS | 3,000 IOPS | not a limit |
| Database connections | 15 | 60 | not a limit |

  The database, API and login service share about 0.5 GB of RAM on the Free plan. Under
  this load the server ran out of memory and swapped to disk, so every request waited on
  the disk and the queue grew until requests timed out. The load test had already raised
  swap from about 200 MB to 380 MB; it passed, but with little memory headroom left.

### What this means

- At a **normal answering pace**, 1,000 students worked perfectly (section 5).
- The Free-tier server has a **capacity ceiling** somewhere between the load test's
  ~55 requests per second (passed) and this test's ~460 (failed).
- The moment when 1,000 students **open the exam together** is realistic, and it was slow
  here (open exam link p95 35 s). Reducing the number of requests and writes per student,
  and/or using a larger server, are the two ways to raise the ceiling.

### After the fix: same spike test with fewer requests per student

**Run:** 11 Nov 2026, 23:09–23:19 (UTC+8). Raw output: `results/spike-v2.json`; charts:
`results/spike-v2.html`.

**What changed in the system** (commit `acc62a9`, migration `20261112_fewer_exam_requests.sql`):

| | Before | After |
|---|---|---|
| Starting or resuming an exam | 5–7 requests | **1 request** (`start_exam_attempt`) |
| Saving time spent per question | 1 extra request per question (50 per exam) | **1 batch per minute**, the rest sent with the submission |
| Requests per student per 50-question exam | about 111 | **about 60 (−46%)** |
| Failed answer saves | silently lost | retried automatically (1 s → 30 s), status shown to the student |
| Timer runs out for everyone | all submit in the same second | submissions spread over 15 s; submit retried if the server is busy |

**Results, before vs after:**

| Measure | Before | After | Change |
|---|---|---|---|
| Exams completed and scored | 13 / 1,000 (1.3%) | **1,000 / 1,000 (100%)** | ✓ |
| Failed requests | 2,454 (3.20%), all timeouts | **0 (0.00%)** | ✓ |
| Total requests | 76,511 (test cut off at 20 min) | 60,671 (finished in 9 min 50 s) | |
| Throughput served | 62 per second | **103 per second** | +66% |
| Checks passed | 97.15% | **100% (61,671 / 61,671)** | ✓ |
| Open exam link, p95 | 35.0 s | 21.8 s | better, still over the 1.5 s target |
| Load questions, p95 | 60 s (timeouts) | 20.4 s | better, still over target |
| Start / create attempt, p95 | 60 s (timeouts) | 21.3 s | better, still over target |
| Save answer, median / p95 | 536 ms / 53.3 s | **170 ms / 969 ms** | ✓ median back to normal |
| Save time, p95 | 52.6 s (per question) | **529 ms** (per batch) | ✓ |
| Submit, p95 | 52.5 s | 18.7 s | better, still over the 2 s target |

**Checked in the database afterwards:** 1,000 / 1,000 attempts completed; 50,000 / 50,000
answer rows (48,501 answered, the rest skipped on purpose); every row has its time
recorded; average score 14.1 / 50 (random answers, as expected); the 1,000 submissions
arrived spread over 22.4 s instead of one second.

**What is still slow:** the **first 30 seconds**, when 1,000 students open the exam,
load 50 questions and start their attempt at the same time (p95 about 21 s), and the
**submission burst** at the end (p95 18.7 s). Answering in between was fast (median
170 ms). These two bursts are the next targets: loading the exam with fewer, lighter
requests, and a larger server for production.

## 5C. Instructor results page

**Runs:** 13 Nov 2026, 22:47–22:56 (after) and 22:57–23:06 (before), UTC+8, on a freshly
restarted test project. Raw output: `results/instructors-after.json`,
`results/instructors-before.json`.

### The problem

The results page (`QuizResults.jsx`) and item analysis page (`ItemAnalysisPage.jsx`)
loaded results with:

- **attempts:** one request with no paging. Supabase returns at most 1,000 rows, so
  attempts beyond 1,000 would be silently left out.
- **answers:** every attempt ID written into the request URL, 1,000 answers per page.

Measured on the test project with the 1,000-taker exam:

| Completed attempts | Answers URL length | Server reply |
|---|---|---|
| 100 | 3,805 characters | ✓ 200 OK |
| 200 | 7,505 | ✓ 200 OK |
| 300 | 11,205 | ✓ 200 OK |
| 400 | about 15,000 | ✗ error reply too large to read |
| 1,000 | 37,105 | ✗ **400 Bad Request** |

**So the original page could not show the results of an exam taken by more than about
300–400 students.** In the first instructor test, where every instructor opened the
1,000-taker exam, the page loaded **0 times out of 241**.

Item analysis had a second problem: for every question and every student it searched
the full list of answers, about 2.5 billion comparisons at 1,000 students × 50 questions,
enough to freeze the browser.

### The fix (commit `47f9e44`, migration `20261113_exam_results_in_one_request.sql`)

- Two database functions return **all attempts** and **all answers** as one request each
  (answers packed compactly; no URL limit; no 1,000-row cap).
- Access is checked **once per request**: the exam's owner, Senior Faculty and Department
  Heads. A first version checked access row by row with the existing security rules and
  took 7–7.5 s for 1,000 students, close to Supabase's 8 s limit.
- Item analysis groups answers by student once.

### Results

**Full results of the 1,000-taker exam, one instructor, idle server:**

| | Before | After |
|---|---|---|
| Attempts (1,000) | loaded, but capped at exactly 1,000 rows | **0.4–0.5 s**, no cap (tested with 1,202) |
| Answers (50,000) | **400 Bad Request** | **1.8 s** (1.2 MB) |

**100 instructors for 8 minutes**, each opening one class's results (one of 20 sections,
50 students) and creating 50-question exams:

| Measure | Before | After |
|---|---|---|
| Results page loaded | 456 / 462 (98.7%) | 417 / 423 (98.6%) |
| Results page time, median | 4.7 s | **2.8 s** |
| Results page time, p95 | 77.7 s | 66.3 s |
| Answer requests | 1,380 (3 pages per view) | **423 (1 per view)** |
| Data downloaded | 234 MB | **85 MB (−64%)** |
| Failed requests* | 0.43% | 0.32% |
| Creating a 50-question exam, median / p95 | 1.7 s / 79.0 s | 1.7 s / 87.1 s |

\* Excluding the `auto_share_quiz_with_subject_sections` call, which answers 400 in the test
project because the seeded sections have no subject (the app ignores this error).

### What this means

- **For a normal class (about 50 students), the original page worked**; the new one loads
  faster at the median with 64% less data.
- **For a large exam (300–400+ takers), the original page could not load at all**; the new
  one loads 1,000 takers in about 2 seconds.
- **With 100 instructors active at the same moment**, both versions slow down badly in the
  worst cases (p95 over a minute), and creating exams slows too. This is the same Free-tier
  server limit seen in the spike test, not the results page itself.

## 5D. Bloom's taxonomy AI classification (the panel's objective)

> Objective: *conduct stress testing and performance benchmarking to determine the system's
> stability, response time, and concurrency limits during simultaneous batch AI text
> classification.*

When an instructor clicks **Analyze**, the web app sends all of the exam's questions (with
their answer choices) in one batch to the FastAPI service (`fastapi_blooms/`), which classifies
each question with the fine-tuned DistilBERT model (`distilbert_blooms_mcq`) into one of the six
Bloom's levels. These tests send many such batches at the same time.

### Test environment

| Item | Value |
|---|---|
| Machine | Acer Aspire A315-44P laptop, plugged in |
| CPU | AMD Ryzen 7 5700U, 8 cores / 16 threads, 1.8 GHz base |
| RAM | 15.3 GB (Windows 11 Home) |
| Model | DistilBERT fine-tuned for Bloom's MCQs, 268 MB, PyTorch 2.10 (CPU only), max 256 tokens |
| Service | FastAPI + uvicorn, one process, on the same laptop (`localhost:8000`) |
| Load generator | k6 v2.3.0 on the same laptop (`stress-test/k6/blooms.js`) |
| Batch | 50 generated multiple-choice questions across all six Bloom's levels |

Because k6 and the service share the laptop, and the laptop is not a server, the numbers describe
**this machine**; a server with more CPU cores would be faster. Repeated runs varied by about
±15%.

**Note on the question texts:** to stop one test from pre-filling the cache for the next, every
test question carries a unique tag, which makes it about 15 tokens longer. That alone makes a
50-question batch take ~3.2 s instead of ~2.4 s. All before/after pairs below use the tagged
questions, so they compare like with like.

### Single batch, one instructor

| Batch size | Time | Per question |
|---|---|---|
| 1 question | 0.16 s | 162 ms |
| 10 questions | 0.60 s | 60 ms |
| 50 questions | **2.4–2.5 s** (median of 15) | 49 ms |
| 100 questions | 5.3 s | 53 ms |
| 50 questions, all already classified (cache, after the fix) | **0.006 s** | — |

### What limits it: the CPU

The model runs on the CPU and needs about 50 ms per question. Measured directly (no web
server), the most this laptop gets through is about **47 batches of 50 questions a minute**
(≈ 39 questions per second), with 8 PyTorch threads and 4 batches running at a time:

| PyTorch threads | Batches at a time | Batches per minute |
|---|---|---|
| 8 (default) | 1 | 31 |
| 8 | 2 | 42 |
| **8** | **4** | **47** |
| 4 | 8 | 46 |
| 2 | 8 | 36 |
| 16 | 1 | 29 |

So no setting makes it dramatically faster: beyond ~47 batches a minute, more simultaneous
requests can only wait. The fixes therefore aim at **doing less work** (cache), **waiting
fairly** (queue) and **staying stable** (bounded memory, quick "busy" reply), not at raw speed.

### The fixes (commit `b776719`)

| Problem found | Fix |
|---|---|
| Every request ran at the same time. With 100 at once the service grew to **5.5–6.1 GB of memory** (the laptop dropped to 80 MB free), all of them finished late, and **20 of 100 timed out** after 5 minutes. | At most **4 batches run at a time** (the fastest setting measured); the rest **wait in arrival order** |
| Nothing stopped an unlimited backlog | When **60 batches are already waiting**, new requests get **503 "busy" with Retry-After** immediately; the web app **retries automatically** (up to 5 times) and tells the instructor |
| Re-analyzing an exam re-classified every question, even unchanged ones | **Result cache** (by question text and choices, 20,000 entries): only new or edited questions go through the model; a fully cached batch skips the queue |

The cache returns the same classification as the model (tested); the model and its outputs are
unchanged. 8 new tests (`fastapi_blooms/test_load_handling.py`); the existing smoke tests still
pass 8/8.

### Result 1: response time at each concurrency level

Each level runs for 60 s, with every simulated instructor sending a new 50-question batch as
soon as the previous one returns.

| Instructors analyzing at once | Before: median / p95 | After: median / p95 | Batches done (before → after) | Succeeded |
|---|---|---|---|---|
| 1 | 3.8 s / 4.2 s | **3.1 s / 3.4 s** | 16 → 19 | 100% / 100% |
| 2 | 6.3 s / 6.8 s | **4.6 s / 5.1 s** | 20 → 26 | 100% / 100% |
| 4 | 13.2 s / 14.0 s | **8.4 s / 10.6 s** | 20 → 29 | 100% / 100% |
| 8 | 25.5 s / 29.2 s | **16.0 s / 19.5 s** | 24 → 35 | 100% / 100% |
| 16 | 49.1 s / 55.1 s | **32.5 s / 37.6 s** | 32 → 42 | 100% / 100% |
| 32 | 105.0 s / 105.8 s | **65.1 s / 70.2 s** | 32 → 58 | 100% / 100% |
| 64 | 133.5 s / 209.2 s | **120.7 s / 181.1 s** | 64 → 85 | 100% / 100% |
| **Service memory, peak** | **6,135 MB** | **1,385 MB** | | |
| **Laptop free memory, lowest** | **391 MB** | **3,262 MB** | | |

### Result 2: 100 instructors click Analyze at the same moment

| Measure | Before | After |
|---|---|---|
| Batches classified | **80 / 100** (20 timed out after 5 min) | **100 / 100** |
| Wait, median | 243 s | **165 s** |
| Wait, p95 / max | 256 s / 259 s (of those that finished) | 312 s / 321 s |
| "Busy" replies (retried automatically) | — | 56 |
| Service memory, peak | **5,502 MB** (laptop down to 80 MB free) | **1,411 MB** |

### Result 3: re-analysis after editing (normal use)

20 instructors each analyze their 50-question exam, then five times: edit 5 questions and
analyze again.

| Measure | Before | After |
|---|---|---|
| First analysis, median / p95 | 64.8 s / 65.2 s | 40.2 s / 64.9 s |
| **Re-analysis, median / p95** | **42.5 s / 56.9 s** | **5.5 s / 33.9 s** |
| Batches classified | 118 / 120 (2 connections dropped) | **120 / 120** |
| Questions answered from the cache | — | 4,500 (45 of 50 per re-analysis) |
| Service memory, peak | 3,954 MB | 1,340 MB |

### Answers to the objective (this laptop)

- **Stability:** after the fixes, **every batch was classified in every test, including 100
  instructors at once**, and the service's memory stayed at about **1.4 GB** instead of growing
  past 5.5 GB. Overload produces a quick "busy, retrying" message instead of timeouts.
- **Response time:** one 50-question batch takes about **2.4 s** (3.1 s with the longer test
  texts); re-analyzing an edited exam takes about **5.5 s** at the median with 20 instructors
  working at once.
- **Concurrency limits:** throughput tops out at about **40–47 batches a minute** (~39 questions
  per second). Waiting time grows in proportion to the number of simultaneous batches:
  **up to about 4 simultaneous analyses stay under 15 s** (p95 10.6 s), 8 take about 16–20 s,
  and 100 at once take about 3–5 minutes for the last instructor. Beyond 64 waiting, new
  requests are told to retry.
- **To go further:** more CPU cores (a server, or several service copies behind a load
  balancer) raise the ceiling roughly in proportion; each extra copy needs ~1.4 GB of memory.

## 5E. Exam day: 1,000 students and 100 instructors at the same time

Run 1, 15 Nov 22:14–23:17 (UTC+8), `k6/exam-day.js`, with the Bloom's service on the laptop
(`localhost:8000`, the improved version from section 5D).

### What it simulates

| Group | Count | What each one does |
|---|---|---|
| Students | 1,000 | Arrive over 5 minutes, open the exam, answer 50 questions at a normal pace (15–45 s each), save time every 60 s, submit |
| Instructors | 100 | For 52 minutes, repeat: open one class's results (50 students), create a 50-question exam and assign it to a section, run Bloom's analysis on it; 20–60 s pause between steps |

This is the load test that passed (section 5) **plus** the instructor test (section 5C)
**plus** Bloom's analysis, all at once. Note that the instructor part is heavy: each instructor
creates a new 50-question exam every one to two minutes.

### Result

| Measure | Result |
|---|---|
| First 6 minutes (22:14–22:20) | Normal: requests answered in ~0.2 s |
| From 22:20 | The Supabase test server stopped answering most requests; they waited the full 60 s and timed out, until the end of the test |
| Requests | 76,281, of which **38,440 (50.39%) failed**, almost all 60 s timeouts |
| Students who finished the exam | **0 of 1,000** (978 still stuck retrying saves when the test ended; 22 gave up earlier) |
| Answer saves that succeeded (as seen by the student) | 21,792 of 40,840 (53%) |
| Answers actually stored in the database | 38,254 of the 50,000 needed |
| Exam attempts stored / completed | 915 / **0** |
| Instructors: class results page loaded | **252 of 1,500 (16.8%)**, median 6.0 s, p95 75.8 s |
| Instructors: "exam created" succeeded (as seen by the instructor) | 324 of 1,469; yet the database holds **944** new exams |
| Bloom's analysis | **223 of 223 (100%)** classified; median 2.2 s, p95 43.9 s; 0 "busy" replies; 103 batches answered from the cache |
| Laptop (Bloom's service + k6) | CPU average 43%, peak 100%; service memory peak 1,247 MB; lowest free memory 1,495 MB |

Raw output: `results/exam-day.json`, `exam-day.html`, `exam-day-console.txt`,
`exam-day-resources.csv`, `exam-day-blooms-stats.json`.

### What this shows

- **The failure was the database server, not the AI service.** The Bloom's service on the
  laptop classified every batch and stayed within memory; the requests that failed were all to
  Supabase.
- **Each part passes alone but not together on the Free tier.** 1,000 students alone passed
  (section 5); 100 instructors alone mostly worked (section 5C); both at once overloaded the
  Free-tier server (~0.5 GB of memory) within 6 minutes. The suspected cause is the same as the
  first spike test (memory exhausted, swapping); to be confirmed with the server's charts.
- **Timeouts made it worse.** A timed-out request is abandoned by the browser but still runs on
  the server: 944 exams were stored although instructors saw only 324 succeed, and 38,254
  answers were stored although students saw only 21,792 succeed. Every retry added more work to
  an already overloaded server, so it never recovered while the test ran.
- **Nothing was lost or corrupted that students saw as saved**, but no one could submit, so on
  a real exam day on this server size the exam would have to be extended or retaken.

## 6. Dry run: 20 students

| Measure | Result |
|---|---|
| Requests | 2,228, 0 failed |
| Exams completed | 20 / 20 |
| p95: save answer / save time / submit | 169 ms / 166 ms / 168 ms |
| p95: open exam link / load questions / create attempt | 490 ms / 189 ms / 187 ms |
| Checks passed | 2,208 / 2,208 |

## 7. Automated database correctness tests

The exam database functions are covered by 113 automated tests
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
| Starting an exam with one request, batched time, submit with time | 23 | ✓ 23 / 23 |
| Instructor results in one request (1,202 attempts, access rules) | 18 | ✓ 18 / 18 |
| Student data protected (who can read or change attempts, answers, profiles) | 28 | ✓ 28 / 28 |
| **Total** | **113** | **✓ 113 / 113** |

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
| 10 | Each student sent about 111 requests per 50-question exam (5–7 to start, plus a separate time save for every question); 1,000 fast students exhausted the server's memory | Spike test: only 13 of 1,000 exams completed | One request to start or resume; time sent in one batch per minute; about 60 requests per student | DB tests; spike test re-run (1,000 / 1,000 completed, 0 failed) |
| 11 | A failed answer save was silently lost, and the student had no way to know | Lost answers when the server or connection is slow | Saves retry automatically and in order; the page shows Saving / Saved / Retrying | Code change; spike test re-run (56,671 / 56,671 saves succeeded) |
| 12 | When the timer ran out for a whole class, every browser submitted in the same second, and a failed submit was not retried | Submission burst overloads the server | Auto-submit spread over 15 s; submit retried up to 4 times (safe, since submitting twice changes nothing) | Spike test re-run (submissions spread over 22 s, all scored) |
| 13 | The results and item analysis pages put every attempt ID in the request URL and loaded attempts without paging | Results of exams with more than ~300–400 takers could not be opened (400 Bad Request at 1,000) | All attempts and answers in one request each, access checked once per request | DB tests (1,202 attempts); 1,000-taker exam loads in ~2 s |
| 14 | Item analysis searched every answer for every student and question | About 2.5 billion comparisons at 1,000 students; browser freezes | Answers grouped by student once | Code change |
| 15 | Live security rules let anyone see an attempt or its answers when `student_name` is set (always); anyone could update attempts and insert answers; `student_profile` had row-level security off; two views exposed the same data to logged-out visitors | Any visitor with the site's public key could read (and change) every student's name, email, score and answers | Attempts and answers visible only to the student, exam owner, section instructor, Senior Faculty and Department Heads; no direct writes; profiles staff/student only; views closed (migration `20261114_protect_student_data.sql`, commit `f935b77`) | 28 DB tests; checked on the test project with real logins (logged-out: denied; student: own row only; section instructor: own 50 of 1,000) |
| 16 | The Bloom's service ran every request at once with no limit | 100 simultaneous analyses: memory 5.5–6.1 GB, 20 of 100 timed out after 5 min | At most 4 batches at a time, the rest wait in arrival order; 503 "busy" + Retry-After past 60 waiting; the web app retries | Burst test: 100/100 classified, memory 1.4 GB |
| 17 | Re-analyzing an exam re-classified unchanged questions | Re-analysis after editing 5 of 50 questions took a median 42.5 s with 20 instructors | Result cache by question text and choices | Re-analysis median 5.5 s; 4,500 cache hits |
| 18 | The web app always called `http://localhost:8000`, and the service only allowed localhost origins | The Bloom's feature could not work once deployed | Service URL (`VITE_BLOOMS_API_URL`) and allowed origins (`BLOOMS_ALLOWED_ORIGINS`) come from settings | Code change |

## 9. Known limitations and open issues

| Item | Details | Plan |
|---|---|---|
| Free-tier memory ceiling | The first spike test exhausted the Free-tier server's ~0.5 GB of RAM. After cutting requests per student by ~46%, all 1,000 students finished with no failures, but opening the exam (p95 ~21 s) and the submission burst (p95 18.7 s) are still slow when 1,000 students do them within seconds | Make opening the exam lighter (fewer, smaller requests); use a larger compute size (more RAM) for production |
| Many instructors at once on the Free tier | With 100 instructors viewing results and creating exams at the same time, p95 response times exceed a minute | Larger compute size for production; lighter exam-creation requests |
| Exam day on the Free tier | 1,000 students plus 100 instructors at the same time overloaded the Free-tier database within 6 minutes; no student could submit (section 5E) | Use a larger compute size for real exam days; keep heavy instructor work (creating exams) out of exam hours; retry with a back-off instead of immediately |
| Bloom's analysis on one laptop | Benchmarked on a laptop CPU with k6 running on the same machine; throughput is limited to ~40–47 batches of 50 questions a minute, so 100 simultaneous analyses take minutes. The trained model (`distilbert_blooms_mcq`, 268 MB) is not in git (GitHub's 100 MB file limit) | Deploy on a server with more CPU (e.g. Oracle Always Free) and re-run `k6/blooms.js`; store the model with Git LFS or upload it separately | Deploy it, run the Bloom's test |
| One load-generating laptop | All traffic came from one computer and one internet address, while real students use many devices | Results are a lower bound for network effects; note in the report |
| Free tier | Results describe Supabase's Free plan | A paid plan would have more capacity |
| Browser rendering | The test measures the server and API, not how fast the page draws in the browser | The front end is static files served by a hosting provider |

## 10. How to reproduce

All scripts are in `stress-test/`. See `stress-test/README.md` for the full steps: create
a test project, copy the database structure, seed the test data, then run each scenario
with k6.

---

## Appendix A. Complete test log

Every test run during this work, in order, including runs that failed or were judged invalid.
Times are UTC+8. Raw outputs are in `stress-test/results/` (`*.json` = k6 summary,
`*.html` = charts, `*-console.txt` = full k6 output, `*-resources.csv` = CPU / memory every 2 s).
Where a later run reused a file name, the earlier run's numbers are taken from the notes made
at the time and are marked "not kept".

### A1. Exam taking (Supabase test project, Free plan, Seoul)

| # | Date / time | Test | Settings | Result | Verdict | Raw output |
|---|---|---|---|---|---|---|
| 1 | 11 Nov 04:06 | Dry run, original exam flow | 20 students, 1–2 s per question | 2,228 requests, 0 failed; 20/20 completed; save p95 169 ms | ✓ Pass | `dry-run.json` |
| 2 | 11 Nov 04:21–04:54 | **Load**, original flow | 1,000 students, 15–45 s per question, 50 questions | 111,252 requests, 0 failed; 1,000/1,000 completed; save p95 169 ms, submit p95 183 ms; DB: 50,000/50,000 answers | ✓ Pass | `load.json`, `load.html` |
| 3 | 11 Nov 22:08–22:28 | **Spike**, original flow | 1,000 students start within 30 s, 2–6 s per question, all submit together | 76,511 requests, 2,454 timeouts (3.2%); 13 of 1,000 completed (251 reached the end within 20 min); Supabase memory: swap 125% of RAM, "SEVERE" | ✗ Fail (server out of memory) | `spike.json`, `spike.html` |
| 4 | 11 Nov 23:00 | Dry run, "fewer requests" flow | 20 students, 2–4 s per question | 1,191 requests (was 2,228), 0 failed; 20/20; DB: 1,000/1,000 answers with time | ✓ Pass | `dry-run-v2.json` |
| 5 | 11 Nov 23:09–23:19 | **Spike**, "fewer requests" flow | same as #3, submits spread over 15 s | 60,671 requests, 0 failed; 1,000/1,000 completed; open exam p95 21.8 s, submit p95 18.7 s | ◐ Completed, start and submit too slow | `spike-v2.json`, `spike-v2.html` |
| 6 | 14 Nov 00:0x | Dry run after privacy rules | 20 students | 1,150 requests, 0 failed; 20/20 | ✓ Pass (rules don't break exams) | not kept |

### A2. Instructor pages (Supabase test project)

| # | Date / time | Test | Settings | Result | Verdict | Raw output |
|---|---|---|---|---|---|---|
| 7 | 13 Nov 22:09–22:18 | Instructors, original results page | 100 instructors, all open the full 1,000-taker results, 8 min | results page loaded 0/241; 19.9% of requests failed | ✗ Fail (URL too long) | not kept |
| 8 | 13 Nov 22:19 | URL length probe | one instructor, answers request for 100–1,000 attempts | 100–300 attempts OK; ~400 fails; 1,000 (37 KB URL) → 400 Bad Request | Finding | — |
| 9 | 13 Nov 22:19–22:27 | Instructors, first fix (row-by-row access check) | as #7 | loaded 1/253 (0.4%); 17.9% failed; idle timing: attempts 7.1 s, answers 7.5 s | ✗ Fail (too slow, near 8 s limit) | not kept |
| 10 | 13 Nov 22:31–22:40 | Instructors, final fix | as #7 | loaded 0/142; 35.8% failed; a simple request took 0.7–8.9 s with no load | ✗ Invalid (server still degraded; restarted after) | not kept |
| 11 | 13 Nov 22:45 | Results functions, idle server | one instructor, 1,000-taker exam | attempts 0.4–0.5 s, answers 1.8 s (1.2 MB) | ✓ Fixed | — |
| 12 | 13 Nov 22:47–22:56 | **Instructors, new page** | 100 instructors, each opens one class (50 students) + creates exams, 8 min | results 417/423 (98.6%), median 2.8 s, p95 66.3 s; 85 MB downloaded; 0.32% failed* | ◐ Works, slow under load | `instructors-after.json` |
| 13 | 13 Nov 22:57–23:06 | **Instructors, original page** | as #12 | results 456/462 (98.7%), median 4.7 s, p95 77.7 s; 234 MB downloaded; 0.43% failed | ◐ Works for one class, slow under load | `instructors-before.json` |
| 14 | 14 Nov 00:0x | Privacy rules, real logins | anon, student, owner, section instructor, unrelated instructor | anon denied; student sees own row; owner 1,000; section instructor 50; unrelated 0; student writes blocked | ✓ Pass | — |
| 15 | 14 Nov 00:0x | Instructors after privacy rules | 10 instructors, 2 min | results 71/71; 0 of 923 requests failed | ✓ Pass | not kept |

\* Excluding a test-data-only error (`auto_share_quiz_with_subject_sections` → 400 because the
seeded sections have no subject); the app ignores this error.

### A3. Bloom's AI classification (laptop: Ryzen 7 5700U, 8 cores, 15.3 GB)

| # | Date / time | Test | Settings | Result | Verdict | Raw output |
|---|---|---|---|---|---|---|
| 16 | 13–14 Nov | Baseline on your running dev server | 1 batch at a time | 50 questions: median 2.46 s | Superseded by #17 | — |
| 17 | 14 Nov 00:09 | Baseline, clean original service | 15 single batches; 4 at once | 50 questions: median 2.47 s; 4 at once: 7.15 s for all; 1 / 10 / 100 questions: 0.16 / 0.60 / 5.26 s | Reference | — |
| 18 | 14 Nov 00:12–00:24 | Levels, original service, untagged questions | 1→64 at once, 60 s each | medians 2.7 / 3.9 / 7.4 / 13.5 / 28.2 / 61.9 / 80.2 s; all 100% OK | Superseded by #25 (not comparable: shorter texts) | `blooms-levels-before-untagged.json` |
| 19 | 14 Nov 00:26 | CPU tuning experiment | threads 2–16 × 1–8 batches at once | best 47 batches/min (8 threads, 4 at once) | Finding | — |
| 20 | 14 Nov 00:38–00:43 | **Burst, original** | 100 at once | 80/100 classified, 20 timed out (5 min); median 243 s; memory 5.5 GB, 80 MB free | ✗ Fail (timeouts, memory) | `blooms-burst-before.json` |
| 21 | 14 Nov 00:44–00:49 | **Re-analysis, original** | 20 instructors × 6 analyses | 118/120 (2 dropped); re-analysis median 42.5 s | ◐ Slow | `blooms-reanalyze-before.json` |
| 22 | 14 Nov 00:50–01:05 | **Levels, improved** | 1→64 at once | 294/294 OK; medians 3.1 / 4.6 / 8.4 / 16.0 / 32.5 / 65.1 / 120.7 s; memory 1.4 GB | ✓ Stable | `blooms-levels-after.json` |
| 23 | 14 Nov 01:05–01:10 | **Burst, improved** | 100 at once | 100/100; median 165 s; 56 busy replies retried; memory 1.4 GB | ✓ Stable (slow: CPU-bound) | `blooms-burst-after.json` |
| 24 | 14 Nov 01:10–01:12 | **Re-analysis, improved** | 20 × 6 | 120/120; re-analysis median 5.5 s; 4,500 cache hits | ✓ Pass | `blooms-reanalyze-after.json` |
| 25 | 14 Nov 01:14–01:29 | **Levels, original, tagged questions** (fair "before" for #22) | 1→64 at once | 208/208 OK; medians 3.8 / 6.3 / 13.2 / 25.5 / 49.1 / 105.0 / 133.5 s; memory 6.1 GB | Reference ("before") | `blooms-levels-before.json` |
| 26 | 14 Nov 01:13 | Tag effect check, improved service | untagged vs tagged 50-question batch | untagged median 2.36 s (original 2.47 s); tagged 3.18 s; fully cached 6 ms | Finding | — |

### A4. Automated test suites (no network)

| # | When | Suite | Checks | Result |
|---|---|---|---|---|
| 27 | 11 Nov | Exam database functions, migration 1 (`supabase/tests`) | 23 | ✓ all pass |
| 28 | 11 Nov | + attempt column lock, question loader, anon column lock | 37 | ✓ all pass |
| 29 | 12 Nov | + staff-only questions policy | 44 | ✓ all pass |
| 30 | 12 Nov | + one-request start, batched time | 67 | ✓ all pass |
| 31 | 13 Nov | + results in one request, access rules | 85 | ✓ all pass |
| 32 | 14 Nov | + student data protection | **113** | ✓ all pass |
| 33 | 11 Nov | k6 scripts against a mock Supabase server (all scenarios, small scale) | — | ✓ found and fixed a retry-loop bug in the test script |
| 34 | 14 Nov | Bloom's smoke tests (`fastapi_blooms/test_blooms_model.py`) | 8 | ✓ 8/8 |
| 35 | 14 Nov | Bloom's load handling (`fastapi_blooms/test_load_handling.py`) | 8 | ✓ 8/8 |

### A5. Exam day (students + instructors + Bloom's together)

| # | Date / time | Test | Settings | Result | Verdict | Raw output |
|---|---|---|---|---|---|---|
| 36 | 15 Nov 22:14–23:17 | **Exam day, run 1** | 1,000 students (arrive over 5 min, 15–45 s per question) + 100 instructors (class results, create 50-question exam, Bloom's analysis; 20–60 s pauses) for 52 min; Bloom's service on the laptop | Normal for 6 min, then Supabase stopped answering; 76,281 requests, 50.39% failed (60 s timeouts); **0/1,000 students submitted**; results page 252/1,500; Bloom's 223/223 OK (median 2.2 s, p95 43.9 s) | ✗ Fail (database server overloaded) | `exam-day.json`, `exam-day.html`, `exam-day-console.txt`, `exam-day-resources.csv`, `exam-day-blooms-stats.json` |
