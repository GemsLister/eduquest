# EduQuest stress test

Load tests for the panel's objective: **1,000+ students taking exams at the same
time while 100 instructors create exams and run Bloom's taxonomy analysis.**

The tests run against a **separate Supabase test project**, never the real one.
The scripts refuse to run if they're pointed at the production project.

| Script | What it simulates |
|---|---|
| `k6/student-exam.js` `SCENARIO=load` | 1,000 students arrive over 5 minutes and take a 50-question exam at a normal pace (~25 min) |
| `k6/student-exam.js` `SCENARIO=spike` | 1,000 students start within 30 seconds and all submit in the same second (timer runs out) |
| `k6/student-exam.js` `SCENARIO=stress` | Ramps from 0 to 2,000 students to find the breaking point |
| `k6/student-exam.js` `SCENARIO=soak` | 400 students for 2 hours, exam after exam, to catch slowdowns over time |
| `k6/instructors.js` | 100 instructors opening a results page with 1,000 takers, creating 50-question exams and running Bloom's analysis |
| `k6/exam-day.js` | **The headline test:** 1,000 students + 100 instructors at once |
| `k6/blooms.js` | The FastAPI Bloom's service on its own (works on localhost too) |

Each simulated student sends the same requests as `PublicQuizPage.jsx`: it opens
the exam link, loads the questions, creates the attempt, saves every answer and
the time spent on each question, then submits.

---

## Before you start

- **k6**: `winget install k6 --source winget` (then open a new terminal; `k6 version` should work). Tested with k6 v2.3.
- **Node.js 20+** (for the seed scripts)
- **Docker Desktop**, running (only for copying the database structure in step 2)

All commands below are for **PowerShell**.

## 1. Create the test project

In the Supabase dashboard, create a new project (for example `eduquest-loadtest`).
Pick the **same region** as the real project and **write down the database
password** you choose.

Use the same plan tier as production if you can. Results on the free tier only
describe the free tier, so write down which tier you tested.

## 2. Copy the database structure into it

This copies tables, functions, policies and triggers. **It copies no data.**

```powershell
# from the eduquest folder, with Docker Desktop running
cd C:\Users\milcky\OneDrive\Desktop\Capstone\eduquest
mkdir stress-test\data -Force
supabase db dump --linked -f stress-test\data\schema.sql
```

It asks for the **production** database password, because it reads the real
project's structure. `--linked` uses the project this repo is linked to.

Then load it into the **test** project. Get its connection string from the test
project's **Connect** button and use the **Session pooler** one (Docker on
Windows usually can't reach the direct IPv6 address). Put in the test project's
database password.

```powershell
cd stress-test
docker run --rm -v "${PWD}\data:/dump" postgres:17 psql "PASTE-TEST-SESSION-POOLER-CONNECTION-STRING" -f /dump/schema.sql *> data\schema-load.log
```

A few `already exists` or `must be owner` lines in `data\schema-load.log` are
normal (Supabase creates some objects itself). Then check the result:

```powershell
copy .env.example .env    # then fill in the TEST project's URL and keys
npm install
npm run check
```

`npm run check` must say **"Schema and exam functions look right."**

## 3. Test project settings

In the **test** project only:

- **Authentication → Rate Limits**: raise the sign-in limit (for example 1000 per
  5 minutes). The seed step signs in all 2,100 accounts once to collect their
  login tokens, and with the default limit that takes a long time.
- **Access token (JWT) expiry**: set it to **14400** seconds (4 hours) so tokens
  outlive the 2-hour soak test. It's in the project's JWT / Auth session
  settings; search the settings for "JWT expiry".

## 4. Create the test data

```powershell
npm run seed
```

This creates:
- 2,000 students and 100 approved instructors
- one section per instructor
- 10 published exams of 50 questions each, shared across 20 sections
- one exam with **1,000 completed attempts**, for the instructor results page

It then signs every account in and saves the tokens to `data\users.json`. That
file holds test passwords and tokens, and git ignores it.

It takes a while (account creation, then sign-ins at the rate limit). If it
stops, run it again and it continues where it left off. Change the amounts in
`.env` (`STUDENTS`, `QUESTIONS`, and so on) **before** the first seed.

## 5. Run the tests

Before **every** test:

```powershell
npm run reset    # removes attempts and exams left by the previous run
npm run tokens   # refreshes login tokens that are about to expire
```

Each command below also saves an HTML report and a JSON summary in `results\`:

```powershell
mkdir results -Force
$env:K6_WEB_DASHBOARD = "true"

# 1,000 students, realistic pace (~35 min)
$env:K6_WEB_DASHBOARD_EXPORT = "results\load.html"
k6 run -e SCENARIO=load k6/student-exam.js --summary-export results\load.json

# everyone starts at once and submits in the same second (~10 min)
$env:K6_WEB_DASHBOARD_EXPORT = "results\spike.html"
k6 run -e SCENARIO=spike k6/student-exam.js --summary-export results\spike.json

# find the breaking point: up to 2,000 students (~25 min)
$env:K6_WEB_DASHBOARD_EXPORT = "results\stress.html"
k6 run -e SCENARIO=stress k6/student-exam.js --summary-export results\stress.json

# 400 students for 2 hours
$env:K6_WEB_DASHBOARD_EXPORT = "results\soak.html"
k6 run -e SCENARIO=soak k6/student-exam.js --summary-export results\soak.json

# 100 instructors (add -e BLOOMS_API_URL=... once the Bloom's service is deployed)
$env:K6_WEB_DASHBOARD_EXPORT = "results\instructors.html"
k6 run k6/instructors.js --summary-export results\instructors.json

# the panel's objective: 1,000 students + 100 instructors together (~40 min)
$env:K6_WEB_DASHBOARD_EXPORT = "results\exam-day.html"
k6 run k6/exam-day.js --summary-export results\exam-day.json
```

To test only the Bloom's service, start it in another terminal
(`cd fastapi_blooms; uvicorn main:app --port 8000`) and run:

```powershell
$env:K6_WEB_DASHBOARD_EXPORT = "results\blooms.html"
k6 run -e BLOOMS_API_URL=http://localhost:8000 k6/blooms.js --summary-export results\blooms.json
```

A quick dry run first is a good idea. This one uses 20 students answering fast
and takes about 2 minutes:

```powershell
k6 run -e SCENARIO=load -e VUS=20 -e THINK_MIN=1 -e THINK_MAX=2 -e ARRIVAL_SECONDS=10 k6/student-exam.js
```

Useful options: `-e VUS=...`, `-e THINK_MIN=... -e THINK_MAX=...` (seconds per
question), `-e ARRIVAL_SECONDS=...`, `-e DURATION=...` (soak and instructors),
`-e SUBMIT_JITTER=...` (spike: spread the submits over N seconds).

## 6. Reading the results

k6 prints a ✓ or ✗ next to each target at the end:

| Target | Meaning |
|---|---|
| `http_req_failed rate<0.01` | fewer than 1% of requests failed |
| `exam_completed rate>0.99` | more than 99% of students finished and got a score |
| `save_answer` / `save_time p(95)<500` | 95% of answer saves took under 0.5 s |
| `submit_exam p(95)<2000` | 95% of submissions took under 2 s |
| `open_exam_link`, `load_questions`, `create_attempt p(95)<1500` | starting the exam took under 1.5 s |
| `results_page_loaded rate>0.99`, `results_page_seconds p(95)<5` | the instructor results page loaded, in under 5 s |
| `create_exam_seconds p(95)<5` | creating an exam with 50 questions took under 5 s |
| `blooms_analyze_seconds p(95)<15` | Bloom's analysis of 50 questions took under 15 s |

**p(95)** means 95% of requests were faster than that number. It's a better
measure than the average, because a few very slow requests can hide inside an
average.

While a test runs, keep the test project's **Reports** page open in the
Supabase dashboard (database CPU, memory, connections, API requests) and take
screenshots at the peak. They show *why* a target failed.

**Expected in the first run:** the instructor results page will probably fail
once an exam has about 1,000 takers. It puts every attempt ID into the request
URL, and that's the next fix. Supabase also returns at most 1,000 rows per
request by default, so attempts beyond 1,000 are silently cut off. Record these
as findings: a failing "before" result is useful evidence when you compare it
with the "after" run.

### Table for the defense

| Test | Users | Requests | Failed % | Save answer p95 | Submit p95 | Exam start p95 | Completed % | Result |
|---|---|---|---|---|---|---|---|---|
| Load | 1,000 | | | | | | | ✓ / ✗ |
| Spike | 1,000 | | | | | | | |
| Stress (breaking point) | up to 2,000 | | | | | | | breaks at ___ users |
| Soak (2 h) | 400 | | | | | | | |
| Exam day | 1,000 + 100 | | | | | | | |

Fill it in once before the remaining fixes and once after.

## Limits of this setup

- **One laptop.** k6 can simulate 1,000+ users, but it needs a few GB of RAM at
  that size, and your internet upload speed caps the traffic. If k6 itself maxes
  out the CPU, the numbers say more about the laptop than about EduQuest.
- **All traffic comes from one IP**, while real students come from many.
  Supabase's per-IP limits matter less here because the tokens were collected in
  advance.
- **It tests the backend, not the browser.** The React app is static files, so
  its performance depends on the hosting provider, not on EduQuest's code.
- **Bloom's analysis is skipped** unless `BLOOMS_API_URL` points at a running
  service.
- These are real requests to your own Supabase project. Keep runs reasonable
  and check Supabase's guidance on load testing for your plan.

## Clean up

When you're done, delete the test project in the Supabase dashboard. That
removes every test account and all test data.
