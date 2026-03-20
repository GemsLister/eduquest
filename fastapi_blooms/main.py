from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    AnalyzeRequest,
    AnalyzeResponse,
    QuestionAnalysis,
    AnalysisSummary,
    ForwardToAdminRequest,
    ForwardToAdminResponse,
)
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


@app.get("/")
def root():
    """Root endpoint returning API status."""
    return {"message": "Bloom's Taxonomy Classifier API", "status": "running"}


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "model": "distilbert_blooms_taxonomy"}


@app.post("/api/quiz/analyze", response_model=AnalyzeResponse)
def analyze_quiz(request: AnalyzeRequest):
    """
    Analyze all questions in a quiz and return Bloom's classification for each.
    """
    if not request.questions:
        raise HTTPException(status_code=400, detail="No questions provided.")

    analysis_results = []
    distribution = {level: 0 for level in BLOOM_LABELS}
    lots_count = 0
    hots_count = 0
    flagged_count = 0

    for question in request.questions:
        try:
            result = classify_question(question.text)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        analysis_results.append(QuestionAnalysis(
            questionId=question.id,
            questionText=question.text,
            bloomsLevel=result["bloomsLevel"],
            thinkingOrder=result["thinkingOrder"],
            confidence=result["confidence"],
            needsReview=result["needsReview"]
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
        quizId=request.quizId,
        analysis=analysis_results,
        summary=AnalysisSummary(
            totalQuestions=total,
            distribution=distribution,
            lotsCount=lots_count,
            hotsCount=hots_count,
            lotsPercentage=round(lots_count / total * 100, 1) if total > 0 else 0,
            hotsPercentage=round(hots_count / total * 100, 1) if total > 0 else 0,
            flaggedCount=flagged_count
        )
    )


@app.post("/api/quiz/forward-to-admin", response_model=ForwardToAdminResponse)
def forward_to_admin(request: ForwardToAdminRequest):
    """
    Forward the quiz and its analysis results to admin for review.
    TODO: Save to database and notify admin.
    """
    return ForwardToAdminResponse(
        success=True,
        message="Quiz analysis successfully forwarded to admin for review.",
        quizId=request.quizId
    )
