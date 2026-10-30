import json
import logging
import os
import re
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

# needsReview rules: the model is often confident even when wrong, so a single
# probability cutoff is not enough. A question is flagged if ANY rule is true.
CONFIDENCE_THRESHOLD = 0.90   # flag if top probability < 0.90
MARGIN_THRESHOLD     = 0.30   # flag if (top1 prob - top2 prob) < 0.30
SHORT_QUESTION_WORDS = 6      # flag if the question has fewer than 6 words

MODEL_PATH = os.getenv("BLOOMS_MODEL_PATH", "./distilbert_blooms_mcq")

BLOOM_LABELS = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
LOTS_LEVELS = {"Remembering", "Understanding", "Applying"}

# Letter prefix the frontend may already include: "A)", "A.", "a)", "(A)".
# "A." / "A)" must be followed by whitespace so choices like "U.S. Navy" are kept.
CHOICE_PREFIX_RE = re.compile(r"^(?:\([A-Za-z]\)|[A-Za-z][.)](?=\s))\s*")

# Keyword dictionary for Bloom's Taxonomy Action Verbs & phrases
KEYWORDS_BY_LEVEL = {
    "Remembering": [
        "define", "list", "state", "name", "recall", "identify", "label", "match", "select",
        "what is", "who", "when", "where", "which of the following", "recite", "locate",
        "find", "mention", "repeat", "memorize", "recognize", "duplicate", "tabulate"
    ],
    "Understanding": [
        "describe", "explain", "summarize", "interpret", "classify", "contrast", "discuss",
        "distinguish", "express", "indicate", "paraphrase", "rewrite", "translate", "illustrate",
        "why does", "what does it mean", "give an example", "compare", "clarify", "summarise"
    ],
    "Applying": [
        "apply", "calculate", "compute", "solve", "demonstrate", "determine", "execute",
        "implement", "modify", "operate", "prepare", "produce", "show how", "use", "find the value",
        "calculate the", "solve the", "derive", "simulate", "complete", "run"
    ],
    "Analyzing": [
        "analyze", "analyse", "compare and contrast", "differentiate", "examine", "investigate",
        "categorize", "deconstruct", "outline", "separate", "inspect", "relationship between",
        "cause of", "break down", "discriminate", "simplify", "subdivide"
    ],
    "Evaluating": [
        "evaluate", "assess", "critique", "judge", "justify", "defend", "rate", "recommend",
        "value", "appraise", "choose the best", "which is most effective", "argue", "validate",
        "prioritize", "estimate", "measure", "conclude", "deduce", "support"
    ],
    "Creating": [
        "create", "design", "develop", "construct", "formulate", "compose", "devise", "plan",
        "produce", "invent", "generate", "propose", "assemble", "synthesize", "build", "draft",
        "write a", "author", "formulate", "setup", "integrate", "modify code"
    ]
}

# Load the fine-tuned DistilBERT model once at startup
USE_ML_MODEL = False
model = None
tokenizer = None
MAX_LENGTH = 256
TEMPERATURE = 1.0

try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    # Only temperature, max_length and label_names are used. "confidence_threshold"
    # in this file is wrong (training notebook bug) and must be ignored.
    with open(os.path.join(MODEL_PATH, "blooms_config.json"), encoding="utf-8") as f:
        blooms_config = json.load(f)
    TEMPERATURE = float(blooms_config["temperature"])
    MAX_LENGTH = int(blooms_config["max_length"])
    BLOOM_LABELS = list(blooms_config["label_names"])

    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
    model.eval()
    USE_ML_MODEL = True
    logger.info("Bloom's Taxonomy Classifier: loaded DistilBERT model from %s", MODEL_PATH)
except Exception as err:
    logger.warning(
        "Bloom's Taxonomy Classifier: could not load model from %s (%s). "
        "Using the FALLBACK keyword classifier; all results will be flagged for review.",
        MODEL_PATH, err,
    )
    USE_ML_MODEL = False


def _format_choices(choices: Optional[List[str]]) -> str:
    """Build the model's text_b, e.g. "A) 443 | B) 80 | C) 21 | D) 25", or "" if no choices."""
    cleaned = []
    for choice in choices or []:
        text = CHOICE_PREFIX_RE.sub("", str(choice).strip()).strip()
        if text:
            cleaned.append(text)
    return " | ".join(f"{chr(ord('A') + i)}) {text}" for i, text in enumerate(cleaned))


def _classify_rule_based(question_text: str) -> dict:
    """Fallback rule-based classifier based on Bloom's Taxonomy keywords."""
    text_lower = question_text.lower()
    scores = {level: 0 for level in BLOOM_LABELS}

    for level, keywords in KEYWORDS_BY_LEVEL.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', text_lower):
                scores[level] += 1

    max_score = max(scores.values())
    if max_score > 0:
        predicted_class = max(scores, key=scores.get)
        confidence = min(0.85, 0.70 + (max_score * 0.05))
    else:
        if any(w in text_lower for w in ["what", "who", "where", "when", "which"]):
            predicted_class = "Remembering"
            confidence = 0.78
        elif any(w in text_lower for w in ["why", "how", "explain"]):
            predicted_class = "Understanding"
            confidence = 0.78
        else:
            predicted_class = "Understanding"
            confidence = 0.72

    thinking_order = "LOTS" if predicted_class in LOTS_LEVELS else "HOTS"

    return {
        "bloomsLevel": predicted_class,
        "thinkingOrder": thinking_order,
        "confidence": round(confidence, 4),
        "needsReview": True,
        "reviewReasons": ["fallback_classifier"]
    }


def _classify_all_rule_based(questions: List[str], reason: str) -> List[dict]:
    logger.warning(
        "Bloom's Taxonomy Classifier: using FALLBACK keyword classifier for %d question(s) (%s).",
        len(questions), reason,
    )
    return [_classify_rule_based(q) for q in questions]


def classify_questions(items: List[Tuple[str, Optional[List[str]]]]) -> List[dict]:
    """
    Classify a batch of questions in one forward pass.

    Args:
        items: (question_text, choices) pairs; choices may be None or empty

    Returns:
        list of dicts with bloomsLevel, thinkingOrder, confidence, needsReview, reviewReasons
    """
    questions = []
    choices_texts = []
    for question_text, choices in items:
        question_text = (question_text or "").strip()
        if not question_text:
            raise ValueError("Question text cannot be empty.")
        questions.append(question_text)
        choices_texts.append(_format_choices(choices))

    if not questions:
        return []

    if not USE_ML_MODEL:
        return _classify_all_rule_based(questions, "model not loaded")

    try:
        inputs = tokenizer(
            questions,
            choices_texts,
            truncation=True,
            max_length=MAX_LENGTH,
            padding=True,
            return_tensors="pt"
        )

        with torch.inference_mode():
            logits = model(**inputs).logits

        # Temperature-scaled (calibrated) probabilities
        probabilities = torch.softmax(logits / TEMPERATURE, dim=-1)
        top2 = torch.topk(probabilities, k=2, dim=-1)

        results = []
        for question_text, top_probs, top_idx in zip(questions, top2.values.tolist(), top2.indices.tolist()):
            bloom_level = BLOOM_LABELS[top_idx[0]]
            confidence = top_probs[0]

            review_reasons = []
            if confidence < CONFIDENCE_THRESHOLD:
                review_reasons.append("low_confidence")
            if confidence - top_probs[1] < MARGIN_THRESHOLD:
                review_reasons.append("close_second_choice")
            if len(question_text.split()) < SHORT_QUESTION_WORDS:
                review_reasons.append("short_question")

            results.append({
                "bloomsLevel": bloom_level,
                "thinkingOrder": "LOTS" if bloom_level in LOTS_LEVELS else "HOTS",
                "confidence": round(confidence, 4),
                "needsReview": bool(review_reasons),
                "reviewReasons": review_reasons
            })
        return results
    except Exception as err:
        return _classify_all_rule_based(questions, f"prediction failed: {err}")


def classify_question(question_text: str, choices: Optional[List[str]] = None) -> dict:
    """
    Classify a single question according to Bloom's Taxonomy levels.

    Args:
        question_text: The question text to classify
        choices: Optional answer choices (option texts only, no answer key)

    Returns:
        dict with bloomsLevel, thinkingOrder, confidence, needsReview, and reviewReasons
    """
    return classify_questions([(question_text, choices)])[0]
