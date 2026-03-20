# DistilBERT Bloom's Taxonomy Classifier

## Overview

This module integrates a fine-tuned DistilBERT model to automatically classify quiz questions according to **Bloom's Taxonomy** cognitive levels. The model analyzes questions created by instructors and categorizes them to help ensure balanced cognitive assessment.

## Tech Stack

| Component           | Technology                          |
| ------------------- | ----------------------------------- |
| **ML Backend**      | FastAPI (Python)                    |
| **ML Model**        | DistilBERT (fine-tuned)             |
| **Model Framework** | Hugging Face Transformers + PyTorch |
| **Frontend**        | React (EduQuest App)                |
| **Dataset**         | 3,600 IT exam questions (custom)    |
| **Training Rounds** | 3 rounds of continual learning      |

---

## Model Performance

| Round | Dataset Size | Accuracy | F1 Score | Avg Confidence |
| ----- | ------------ | -------- | -------- | -------------- |
| 1     | 1,200        | 100%     | 1.0000   | ~50%           |
| 2     | 2,400        | 100%     | 1.0000   | ~98%           |
| **3** | **3,600**    | **100%** | **1.0000** | **~99.6%** ✅ |

---

## Bloom's Taxonomy Levels

The model classifies questions into six cognitive levels:

| Level             | Label (Exact)    | Description                            | Thinking Order |
| ----------------- | ---------------- | -------------------------------------- | -------------- |
| 0 — Remembering   | `Remembering`    | Recall facts and basic concepts        | LOTS           |
| 1 — Understanding | `Understanding`  | Explain ideas or concepts              | LOTS           |
| 2 — Applying      | `Applying`       | Use information in new situations      | LOTS           |
| 3 — Analyzing     | `Analyzing`      | Draw connections among ideas           | HOTS           |
| 4 — Evaluating    | `Evaluating`     | Justify a decision or course of action | HOTS           |
| 5 — Creating      | `Creating`       | Produce new or original work           | HOTS           |

> ⚠️ **Important:** Label names must match exactly as shown above. The model was trained using these exact strings. Using shortened versions like `Remember` or `Analyze` will cause incorrect label mapping.

### Thinking Order Classification

- **LOTS (Lower Order Thinking Skills)**: Remembering, Understanding, Applying (Labels 0–2)
- **HOTS (Higher Order Thinking Skills)**: Analyzing, Evaluating, Creating (Labels 3–5)

```python
# Correct label mapping in code
BLOOM_LABELS = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
LOTS_LEVELS  = {"Remembering", "Understanding", "Applying"}

category = "LOTS" if predicted_label in LOTS_LEVELS else "HOTS"
```

---

## Model Files

```
distilbert_blooms_taxonomy/
├── config.json              # Model architecture configuration
├── model.safetensors        # Fine-tuned model weights (~267MB)
├── tokenizer.json           # Tokenizer vocabulary and rules
├── tokenizer_config.json    # Tokenizer settings
└── README.md                # This documentation
```

> ⚠️ **Never modify any of these files.** They are loaded as-is by the FastAPI backend.

---

## Integration Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                      INSTRUCTOR SIDE                        │
│                                                             │
│  1. Create Quiz → Add Questions → Click "Analyze with AI"  │
│                        ↓                                    │
│  2. POST /api/quiz/analyze                                  │
│                        ↓                                    │
│  3. View Results: Bloom's Level + HOTS/LOTS + Confidence    │
│                        ↓                                    │
│  4. Click "Forward to Admin"                                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                        ADMIN SIDE                           │
│                                                             │
│  5. Review Quiz + AI Analysis Results                       │
│                        ↓                                    │
│  6. Check against School TOS                               │
│                        ↓                                    │
│  7. Approve / Request Revision / Reject                    │
│                        ↓                                    │
│  8. Forward back to Instructor                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
fastapi_blooms/
├── main.py                          # FastAPI application entry point
├── models.py                        # Pydantic request/response models
├── classifier.py                    # DistilBERT inference logic
├── requirements.txt                 # Python dependencies
└── distilbert_blooms_taxonomy/      # Trained model files
    ├── config.json
    ├── model.safetensors
    ├── tokenizer.json
    └── tokenizer_config.json
```

---

## Requirements

```txt
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
transformers>=4.37.0
torch>=2.1.0
safetensors>=0.4.0
pydantic>=2.5.0
python-multipart>=0.0.6
```

---

## Implementation

### classifier.py

```python
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_PATH   = "./distilbert_blooms_taxonomy"
BLOOM_LABELS = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
LOTS_LEVELS  = {"Remembering", "Understanding", "Applying"}

# Confidence threshold — questions below this are flagged for manual review
CONFIDENCE_THRESHOLD = 0.75

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model     = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()


def classify_question(question_text: str) -> dict:
    # Input validation
    question_text = question_text.strip()
    if not question_text:
        raise ValueError("Question text cannot be empty.")
    if len(question_text) > 512:
        question_text = question_text[:512]

    inputs = tokenizer(
        question_text,
        return_tensors="pt",
        truncation=True,
        max_length=128,
        padding=True
    )

    with torch.no_grad():
        outputs = model(**inputs)

    probabilities    = torch.softmax(outputs.logits, dim=-1)
    predicted_class  = probabilities.argmax(-1).item()
    confidence       = round(probabilities.max().item(), 4)

    bloom_level      = BLOOM_LABELS[predicted_class]
    thinking_order   = "LOTS" if bloom_level in LOTS_LEVELS else "HOTS"
    needs_review     = confidence < CONFIDENCE_THRESHOLD

    return {
        "bloomsLevel"   : bloom_level,
        "thinkingOrder" : thinking_order,
        "confidence"    : confidence,
        "needsReview"   : needs_review   # flag low-confidence predictions
    }
```

### main.py

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from classifier import classify_question, BLOOM_LABELS

app = FastAPI(
    title="Bloom's Taxonomy Classifier API",
    description="Classifies quiz questions using fine-tuned DistilBERT",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Models ──────────────────────────────────────────

class Question(BaseModel):
    id: str
    text: str

class AnalyzeRequest(BaseModel):
    quizId: str
    questions: List[Question]

class QuestionAnalysis(BaseModel):
    questionId    : str
    questionText  : str
    bloomsLevel   : str
    thinkingOrder : str
    confidence    : float
    needsReview   : bool   # True if confidence < threshold

class AnalysisSummary(BaseModel):
    totalQuestions   : int
    distribution     : dict
    lotsCount        : int
    hotsCount        : int
    lotsPercentage   : float
    hotsPercentage   : float
    flaggedCount     : int   # questions needing manual review

class AnalyzeResponse(BaseModel):
    quizId   : str
    analysis : List[QuestionAnalysis]
    summary  : AnalysisSummary

class ForwardToAdminRequest(BaseModel):
    quizId          : str
    instructorId    : str
    analysisResults : dict
    message         : Optional[str] = ""

class ForwardToAdminResponse(BaseModel):
    success : bool
    message : str
    quizId  : str


# ── Endpoints ────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Bloom's Taxonomy Classifier API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "model": "distilbert_blooms_taxonomy"}


@app.post("/api/quiz/analyze", response_model=AnalyzeResponse)
def analyze_quiz(request: AnalyzeRequest):
    if not request.questions:
        raise HTTPException(status_code=400, detail="No questions provided.")

    analysis_results = []
    distribution     = {level: 0 for level in BLOOM_LABELS}
    lots_count       = 0
    hots_count       = 0
    flagged_count    = 0

    for question in request.questions:
        try:
            result = classify_question(question.text)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        analysis_results.append(QuestionAnalysis(
            questionId    = question.id,
            questionText  = question.text,
            bloomsLevel   = result["bloomsLevel"],
            thinkingOrder = result["thinkingOrder"],
            confidence    = result["confidence"],
            needsReview   = result["needsReview"]
        ))

        distribution[result["bloomsLevel"]] += 1

        if result["thinkingOrder"] == "LOTS":
            lots_count += 1
        else:
            hots_count += 1

        if result["needsReview"]:
            flagged_count += 1

    total = len(request.questions)

    return AnalyzeResponse(
        quizId   = request.quizId,
        analysis = analysis_results,
        summary  = AnalysisSummary(
            totalQuestions = total,
            distribution   = distribution,
            lotsCount      = lots_count,
            hotsCount      = hots_count,
            lotsPercentage = round(lots_count / total * 100, 1) if total > 0 else 0,
            hotsPercentage = round(hots_count / total * 100, 1) if total > 0 else 0,
            flaggedCount   = flagged_count
        )
    )


@app.post("/api/quiz/forward-to-admin", response_model=ForwardToAdminResponse)
def forward_to_admin(request: ForwardToAdminRequest):
    # TODO: Save to database and notify admin
    return ForwardToAdminResponse(
        success = True,
        message = "Quiz analysis successfully forwarded to admin for review.",
        quizId  = request.quizId
    )
```

---

## API Endpoints

### POST `/api/quiz/analyze`

Analyzes all questions in a quiz and returns Bloom's classification for each.

**Request:**
```json
{
  "quizId": "uuid",
  "questions": [
    { "id": "q1", "text": "What does SQL stand for?" },
    { "id": "q2", "text": "Design a database schema for a hospital system." }
  ]
}
```

**Response:**
```json
{
  "quizId": "uuid",
  "analysis": [
    {
      "questionId"    : "q1",
      "questionText"  : "What does SQL stand for?",
      "bloomsLevel"   : "Remembering",
      "thinkingOrder" : "LOTS",
      "confidence"    : 0.9954,
      "needsReview"   : false
    },
    {
      "questionId"    : "q2",
      "questionText"  : "Design a database schema for a hospital system.",
      "bloomsLevel"   : "Creating",
      "thinkingOrder" : "HOTS",
      "confidence"    : 0.9968,
      "needsReview"   : false
    }
  ],
  "summary": {
    "totalQuestions" : 2,
    "distribution"   : {
      "Remembering"  : 1,
      "Understanding": 0,
      "Applying"     : 0,
      "Analyzing"    : 0,
      "Evaluating"   : 0,
      "Creating"     : 1
    },
    "lotsCount"      : 1,
    "hotsCount"      : 1,
    "lotsPercentage" : 50.0,
    "hotsPercentage" : 50.0,
    "flaggedCount"   : 0
  }
}
```

---

### POST `/api/quiz/forward-to-admin`

Forwards the quiz and its analysis results to the admin for review.

**Request:**
```json
{
  "quizId"          : "uuid",
  "instructorId"    : "uuid",
  "analysisResults" : { "...analysis response..." },
  "message"         : "Optional instructor notes"
}
```

**Response:**
```json
{
  "success" : true,
  "message" : "Quiz analysis successfully forwarded to admin for review.",
  "quizId"  : "uuid"
}
```

---

### GET `/health`

```json
{ "status": "healthy", "model": "distilbert_blooms_taxonomy" }
```

---

## Running the Server

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# API docs (auto-generated by FastAPI)
# Swagger UI : http://localhost:8000/docs
# ReDoc      : http://localhost:8000/redoc
```

---

## Frontend Integration (React + TypeScript)

```typescript
// types.ts
interface QuestionAnalysis {
  questionId    : string;
  questionText  : string;
  bloomsLevel   : "Remembering" | "Understanding" | "Applying" | "Analyzing" | "Evaluating" | "Creating";
  thinkingOrder : "LOTS" | "HOTS";
  confidence    : number;
  needsReview   : boolean;
}

interface AnalysisSummary {
  totalQuestions : number;
  distribution   : Record<string, number>;
  lotsCount      : number;
  hotsCount      : number;
  lotsPercentage : number;
  hotsPercentage : number;
  flaggedCount   : number;
}

interface AnalyzeResponse {
  quizId   : string;
  analysis : QuestionAnalysis[];
  summary  : AnalysisSummary;
}
```

```typescript
// api/quizAnalysis.ts
const API_URL = "http://localhost:8000";

export const analyzeQuiz = async (
  quizId: string,
  questions: { id: string; text: string }[]
): Promise<AnalyzeResponse> => {
  const response = await fetch(`${API_URL}/api/quiz/analyze`, {
    method  : "POST",
    headers : { "Content-Type": "application/json" },
    body    : JSON.stringify({ quizId, questions })
  });
  if (!response.ok) throw new Error("Failed to analyze quiz.");
  return response.json();
};

export const forwardToAdmin = async (
  quizId       : string,
  instructorId : string,
  analysisResults : AnalyzeResponse,
  message?     : string
) => {
  const response = await fetch(`${API_URL}/api/quiz/forward-to-admin`, {
    method  : "POST",
    headers : { "Content-Type": "application/json" },
    body    : JSON.stringify({ quizId, instructorId, analysisResults, message })
  });
  if (!response.ok) throw new Error("Failed to forward to admin.");
  return response.json();
};
```

```tsx
// QuizAnalysisResults.tsx
import { analyzeQuiz, forwardToAdmin } from "./api/quizAnalysis";

export default function QuizAnalysisResults({ quizId, questions }) {
  const [results, setResults]   = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [forwarded, setForwarded] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const data = await analyzeQuiz(quizId, questions);
      setResults(data);
    } catch {
      alert("Error: Could not connect to AI backend.");
    }
    setLoading(false);
  };

  const handleForward = async () => {
    if (!results) return;
    await forwardToAdmin(quizId, instructorId, results);
    setForwarded(true);
    alert("✅ Quiz forwarded to admin for review!");
  };

  return (
    <div>
      <button onClick={handleAnalyze} disabled={loading}>
        {loading ? "Analyzing..." : "🧠 Analyze with AI"}
      </button>

      {results && (
        <>
          {/* Summary */}
          <div>
            <h3>Summary</h3>
            <p>Total: {results.summary.totalQuestions}</p>
            <p>HOTS: {results.summary.hotsCount} ({results.summary.hotsPercentage}%)</p>
            <p>LOTS: {results.summary.lotsCount} ({results.summary.lotsPercentage}%)</p>
            {results.summary.flaggedCount > 0 && (
              <p>⚠️ {results.summary.flaggedCount} question(s) flagged for manual review</p>
            )}
          </div>

          {/* Per Question */}
          {results.analysis.map((r, i) => (
            <div key={i} style={{
              border: `2px solid ${r.thinkingOrder === "HOTS" ? "#f59e0b" : "#10b981"}`
            }}>
              <p><strong>Q{i + 1}:</strong> {r.questionText}</p>
              <p>{r.thinkingOrder} — {r.bloomsLevel}</p>
              <p>Confidence: {(r.confidence * 100).toFixed(2)}%</p>
              {r.needsReview && <p>⚠️ Low confidence — manual review suggested</p>}
            </div>
          ))}

          {/* Forward Button */}
          <button onClick={handleForward} disabled={forwarded}>
            {forwarded ? "✅ Forwarded to Admin" : "📤 Forward to Admin"}
          </button>
        </>
      )}
    </div>
  );
}
```

---

## UI Components Needed

| Component                    | Description                                          | Status |
| ---------------------------- | ---------------------------------------------------- | ------ |
| **Analyze Button**           | Triggers AI analysis after quiz creation             | Needed |
| **Analysis Results View**    | Displays Bloom's level per question with confidence  | Needed |
| **Summary Statistics Panel** | Shows HOTS/LOTS ratio and Bloom's distribution       | Needed |
| **Flagged Questions Badge**  | Highlights low-confidence questions for manual check | Needed |
| **Forward to Admin Button**  | Sends quiz + analysis to admin dashboard             | Needed |
| **Admin Review Dashboard**   | Lists pending quiz analyses for admin approval       | Needed |
| **Admin Feedback Form**      | Allows admin to approve, revise, or reject           | Needed |

---

## Key Improvements Over Initial Version

| Issue | Fix Applied |
|-------|-------------|
| Label name mismatch (`Remember` vs `Remembering`) | Fixed to match trained model exactly |
| No confidence threshold | Added `CONFIDENCE_THRESHOLD = 0.75` with `needsReview` flag |
| No input validation | Added empty string and length checks |
| Missing HOTS/LOTS percentage in summary | Added `lotsPercentage` and `hotsPercentage` |
| No flagged question count | Added `flaggedCount` to summary |
| No error handling in API | Added `HTTPException` for bad requests |
| Forward-to-admin had no response model | Added `ForwardToAdminResponse` Pydantic model |
| Classifier mixed with API logic | Separated into `classifier.py` and `main.py` |

---

## Future Enhancements

- [ ] Batch processing for large quizzes (async processing)
- [ ] Suggestions for improving HOTS/LOTS balance per quiz
- [ ] Historical analysis tracking per instructor
- [ ] Auto re-classification when a question is edited
- [ ] Export analysis report as PDF or CSV
- [ ] Admin feedback stored and visible to instructor
- [ ] Email notification when admin approves or rejects
- [ ] Dashboard analytics showing HOTS/LOTS trends over time
