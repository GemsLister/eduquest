import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_PATH = "./distilbert_blooms_taxonomy"
BLOOM_LABELS = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
LOTS_LEVELS = {"Remembering", "Understanding", "Applying"}

# Confidence threshold - questions below this are flagged for manual review
CONFIDENCE_THRESHOLD = 0.75

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()


def classify_question(question_text: str) -> dict:
    """
    Classify a question according to Bloom's Taxonomy levels.

    Args:
        question_text: The question text to classify

    Returns:
        dict with bloomsLevel, thinkingOrder, confidence, and needsReview
    """
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

    probabilities = torch.softmax(outputs.logits, dim=-1)
    predicted_class = probabilities.argmax(-1).item()
    confidence = round(probabilities.max().item(), 4)

    bloom_level = BLOOM_LABELS[predicted_class]
    thinking_order = "LOTS" if bloom_level in LOTS_LEVELS else "HOTS"
    needs_review = confidence < CONFIDENCE_THRESHOLD

    return {
        "bloomsLevel": bloom_level,
        "thinkingOrder": thinking_order,
        "confidence": confidence,
        "needsReview": needs_review
    }
