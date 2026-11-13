import asyncio
import math
import os
import time

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from models import (
    AnalyzeRequest,
    AnalyzeResponse,
    QuestionAnalysis,
    AnalysisSummary,
    ForwardToAdminRequest,
    ForwardToAdminResponse,
)
import classifier
from classifier import classify_questions, BLOOM_LABELS, USE_ML_MODEL

# ------------------------------------------------------------------
# Load handling (see stress-test/RESULTS.md, Bloom's benchmark)
#
# The model is CPU-bound: on the benchmark laptop (8-core Ryzen 7 5700U) the
# most it gets through is ~47 batches of 50 questions a minute, best with 4
# batches running at a time. Letting every request run at once only makes
# them all finish late, so:
#   - at most INFERENCE_SLOTS batches run at a time; the rest wait in arrival
#     order (asyncio.Semaphore wakes waiters first-in, first-out)
#   - when MAX_WAITING batches are already waiting, new ones get
#     503 + Retry-After at once instead of waiting minutes (the web app retries)
#   - batches whose questions are all cached skip the queue entirely
# ------------------------------------------------------------------
INFERENCE_SLOTS = int(os.getenv("BLOOMS_INFERENCE_SLOTS", "4"))
MAX_WAITING = int(os.getenv("BLOOMS_MAX_WAITING", "60"))
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("BLOOMS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    if o.strip()
]

_slots = None  # created on first use, inside the running event loop
_waiting = 0
_running = 0
_avg_batch_seconds = 2.5  # updated as batches finish
_stats = {"served": 0, "busy_rejected": 0, "cache_only": 0}


def _get_slots():
    global _slots
    if _slots is None:
        _slots = asyncio.Semaphore(INFERENCE_SLOTS)
    return _slots


def _retry_after_seconds() -> int:
    """Rough time until a slot frees up for a new request."""
    ahead = _waiting + _running
    return max(1, math.ceil(ahead * _avg_batch_seconds / max(1, INFERENCE_SLOTS)))

app = FastAPI(
    title="Bloom's Taxonomy Classifier API",
    description="Classifies quiz questions using fine-tuned DistilBERT",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    # the web app reads Retry-After from 503 "busy" replies
    expose_headers=["Retry-After"],
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
    return {"status": "healthy", "model": "distilbert_blooms_mcq", "mlModelLoaded": USE_ML_MODEL}


@app.get("/stats")
def stats():
    """Load and cache counters, for monitoring and benchmarks."""
    hits, misses = classifier.cache_stats["hits"], classifier.cache_stats["misses"]
    return {
        "inferenceSlots": INFERENCE_SLOTS,
        "maxWaiting": MAX_WAITING,
        "running": _running,
        "waiting": _waiting,
        "avgBatchSeconds": round(_avg_batch_seconds, 2),
        "served": _stats["served"],
        "busyRejected": _stats["busy_rejected"],
        "cacheOnlyBatches": _stats["cache_only"],
        "cache": {"size": classifier.cache_size(), "maxSize": classifier.CACHE_SIZE, "hits": hits, "misses": misses},
    }


async def _classify_with_queue(items):
    """Classify a batch, waiting for an inference slot if the model is needed."""
    global _waiting, _running, _avg_batch_seconds
    if not classifier.needs_model(items):
        _stats["cache_only"] += 1
        return classify_questions(items)

    slots = _get_slots()
    if slots.locked() and _waiting >= MAX_WAITING:
        _stats["busy_rejected"] += 1
        retry_after = _retry_after_seconds()
        raise HTTPException(
            status_code=503,
            detail=f"The Bloom's analysis service is busy. Please try again in about {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    _waiting += 1
    try:
        await slots.acquire()
    finally:
        _waiting -= 1
    _running += 1
    started = time.perf_counter()
    try:
        return await run_in_threadpool(classify_questions, items)
    finally:
        _running -= 1
        slots.release()
        _avg_batch_seconds = 0.8 * _avg_batch_seconds + 0.2 * (time.perf_counter() - started)


@app.post("/api/quiz/analyze", response_model=AnalyzeResponse)
async def analyze_quiz(request: AnalyzeRequest):
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

    try:
        results = await _classify_with_queue([(q.text, q.choices) for q in request.questions])
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    for question, result in zip(request.questions, results):
        analysis_results.append(QuestionAnalysis(
            questionId=question.id,
            questionText=question.text,
            bloomsLevel=result["bloomsLevel"],
            thinkingOrder=result["thinkingOrder"],
            confidence=result["confidence"],
            needsReview=result["needsReview"],
            reviewReasons=result["reviewReasons"]
        ))

        distribution[result["bloomsLevel"]] += 1

        if result["thinkingOrder"] == "LOTS":
            lots_count += 1
        else:
            hots_count += 1

        if result["needsReview"]:
            flagged_count += 1

    total = len(request.questions)
    _stats["served"] += 1

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
