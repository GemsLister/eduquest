# EduQuest Web-Based Examination & Item Analysis System
## Test Case Results Matrix

**Project:** EduQuest  
**Evaluation Scope:** Login $\rightarrow$ Class & Question Bank Management $\rightarrow$ Quiz Assembly $\rightarrow$ Student Exam Taking $\rightarrow$ Exam Summary Reports $\rightarrow$ Item Analysis & Expert System Recommendations

---

| Test Case ID | Test Case Description | Expected Result | Actual Result | Status | Comments |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **TC_01** | **User Login** | Instructor logs in successfully and opens the main dashboard. | User logged in successfully and opened the instructor dashboard. | **Pass** | User credentials verified. |
| **TC_02** | **Student Access Control** | Student cannot access instructor-only pages. | Student was blocked from opening instructor pages. | **Pass** | Access permissions working properly. |
| **TC_03** | **Class Section Setup** | Instructor can create a new class section for a subject. | New class section was created and listed under the subject. | **Pass** | Class section saved successfully. |
| **TC_04** | **Question Creation** | Instructor can add a multiple-choice question with options and set the correct answer. | Question text, options, and correct answer saved in the question bank. | **Pass** | Question created without errors. |
| **TC_05** | **Question Bank Filtering** | Filtering by subject shows only questions belonging to that subject. | Displayed only questions belonging to the selected subject. | **Pass** | Subject filter working accurately. |
| **TC_06** | **Question Editing & History** | Instructor can edit a question and view previous versions. | Question was updated and previous version was kept in history. | **Pass** | Question edits saved with revision history. |
| **TC_07** | **Quiz Creation** | Instructor can create a new quiz for a class section. | Quiz title, description, and class section were saved. | **Pass** | Quiz created successfully. |
| **TC_08** | **Importing Questions into Quiz** | Instructor can import questions from the question bank into a quiz. | Questions were imported into the quiz with complete choices and correct answers. | **Pass** | Questions imported successfully. |
| **TC_09** | **Quiz Publishing & Timer Setup** | Instructor can set quiz time limit and publish it for students. | Quiz was published and became visible to enrolled students. | **Pass** | Quiz opened for student attempts. |
| **TC_10** | **Student Taking Quiz** | Student can view questions, select answer choices, and see remaining time. | Questions displayed properly with working timer and choice selection. | **Pass** | Quiz interface working smoothly. |
| **TC_11** | **Quiz Submission & Scoring** | Student submits answers and system automatically calculates total score. | Student responses submitted and score computed automatically. | **Pass** | Automatic scoring completed instantly. |
| **TC_12** | **Student Score Review** | Student can view total score and test result summary. | Displayed total points earned, score percentage, and attempt summary. | **Pass** | Results displayed to student correctly. |
| **TC_13** | **Exam Summary Statistics** | System displays number of examinees, mean score, highest/lowest scores, and passing rate. | Calculated examinee count, mean score, highest score, lowest score, and passing rate correctly. | **Pass** | Summary calculations accurate. |
| **TC_14** | **Item Difficulty Index Analysis** | System computes item difficulty index and labels items as Easy, Moderate, or Difficult. | Difficulty indexes calculated correctly and categorized as Easy, Moderate, or Difficult. | **Pass** | Difficulty classification verified. |
| **TC_15** | **Item Discrimination Index Analysis** | System computes item discrimination index using top and bottom student groups. | Discrimination indexes calculated correctly and categorized into performance levels. | **Pass** | Discrimination classification verified. |
| **TC_16** | **Distractor Performance Analysis** | System analyzes student choice distribution and flags unused options. | Unchosen options were identified and flagged for review. | **Pass** | Option performance analysis accurate. |
| **TC_17** | **Expert System: Retain Good Questions** | System recommends retaining questions with balanced difficulty and high discrimination. | Displayed "Retain" status with recommendation to keep question in bank. | **Pass** | High-quality items identified correctly. |
| **TC_18** | **Expert System: Flag Questions for Revision** | System flags questions with weak options or low discrimination for revision. | Displayed "Flag for Revision" status with suggestion to improve unchosen choices. | **Pass** | Actionable revision advice provided. |
| **TC_19** | **Expert System: Reject Flawed Questions** | System flags questions where low scorers performed better than high scorers for rejection. | Displayed "Reject" status with warning about potential question flaw or wrong answer key. | **Pass** | Flawed items flagged accurately. |
| **TC_20** | **Complete System Workflow** | Complete process runs smoothly from question creation to quiz taking, scoring, and item analysis reports. | Entire process completed without errors across all features. | **Pass** | Full system workflow verified. |

---

## Summary
- **Total Test Cases:** 20  
- **Passed:** 20  
- **Failed:** 0  
