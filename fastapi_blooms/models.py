from pydantic import BaseModel
from typing import List, Optional


class Question(BaseModel):
    """Single question for analysis."""
    id: str
    text: str


class AnalyzeRequest(BaseModel):
    """Request body for quiz analysis."""
    quizId: str
    questions: List[Question]


class QuestionAnalysis(BaseModel):
    """Analysis result for a single question."""
    questionId: str
    questionText: str
    bloomsLevel: str
    thinkingOrder: str
    confidence: float
    needsReview: bool


class AnalysisSummary(BaseModel):
    """Summary statistics for the quiz analysis."""
    totalQuestions: int
    distribution: dict
    lotsCount: int
    hotsCount: int
    lotsPercentage: float
    hotsPercentage: float
    flaggedCount: int


class AnalyzeResponse(BaseModel):
    """Response body for quiz analysis."""
    quizId: str
    analysis: List[QuestionAnalysis]
    summary: AnalysisSummary


class ForwardToAdminRequest(BaseModel):
    """Request body for forwarding quiz to admin."""
    quizId: str
    instructorId: str
    analysisResults: dict
    message: Optional[str] = ""


class ForwardToAdminResponse(BaseModel):
    """Response body for forward to admin action."""
    success: bool
    message: str
    quizId: str
