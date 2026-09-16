import re

BLOOM_LABELS = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
LOTS_LEVELS = {"Remembering", "Understanding", "Applying"}
CONFIDENCE_THRESHOLD = 0.75

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

# Attempt PyTorch model import
USE_ML_MODEL = False
model = None
tokenizer = None

try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    MODEL_PATH = "./distilbert_blooms_taxonomy"
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
    model.eval()
    USE_ML_MODEL = True
    print("Bloom's Taxonomy Classifier: PyTorch DistilBERT model loaded successfully.")
except Exception as err:
    print(f"Bloom's Taxonomy Classifier: PyTorch model unavailable ({err}). Using fallback heuristic classifier.")
    USE_ML_MODEL = False


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
    needs_review = confidence < CONFIDENCE_THRESHOLD

    return {
        "bloomsLevel": predicted_class,
        "thinkingOrder": thinking_order,
        "confidence": round(confidence, 4),
        "needsReview": needs_review
    }


def classify_question(question_text: str) -> dict:
    """
    Classify a question according to Bloom's Taxonomy levels.

    Args:
        question_text: The question text to classify

    Returns:
        dict with bloomsLevel, thinkingOrder, confidence, and needsReview
    """
    question_text = question_text.strip()
    if not question_text:
        raise ValueError("Question text cannot be empty.")
    if len(question_text) > 512:
        question_text = question_text[:512]

    if not USE_ML_MODEL:
        return _classify_rule_based(question_text)

    try:
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
        predicted_class_idx = probabilities.argmax(-1).item()
        confidence = round(probabilities.max().item(), 4)

        bloom_level = BLOOM_LABELS[predicted_class_idx]
        thinking_order = "LOTS" if bloom_level in LOTS_LEVELS else "HOTS"
        needs_review = confidence < CONFIDENCE_THRESHOLD

        return {
            "bloomsLevel": bloom_level,
            "thinkingOrder": thinking_order,
            "confidence": confidence,
            "needsReview": needs_review
        }
    except Exception as err:
        print(f"Error during ML prediction ({err}), using fallback classifier.")
        return _classify_rule_based(question_text)

