"""
Smoke tests for the distilbert_blooms_mcq classifier and the /api/quiz/analyze endpoint.

Run from this folder:  python test_blooms_model.py
"""
import asyncio

import httpx

import classifier
from classifier import classify_question, classify_questions, _format_choices
from main import app


class _Client:
    """Minimal sync client over httpx's ASGI transport (fastapi.testclient breaks with httpx>=0.28)."""

    def _request(self, method, url, **kwargs):
        async def run():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
                return await c.request(method, url, **kwargs)
        return asyncio.run(run())

    def get(self, url, **kwargs):
        return self._request("GET", url, **kwargs)

    def post(self, url, **kwargs):
        return self._request("POST", url, **kwargs)


client = _Client()

MICROSERVICES_CHOICES = [
    "No, a modular monolith is simpler to build and run",
    "Yes, always",
    "Only with blockchain",
    "Only on mainframes",
]


def show(label, result):
    print(f"{label}\n    -> {result}")


def test_model_loaded():
    assert classifier.USE_ML_MODEL, "ML model did not load; results would come from the fallback classifier"
    resp = client.get("/health")
    print("GET /health ->", resp.status_code, resp.json())
    assert resp.json() == {"status": "healthy", "model": "distilbert_blooms_mcq", "mlModelLoaded": True}


def test_1_https_port_remembering():
    r = classify_question("Which port does HTTPS use by default?", ["443", "80", "21", "25"])
    show("1. HTTPS port (with choices)", r)
    assert (r["bloomsLevel"], r["thinkingOrder"]) == ("Remembering", "LOTS")


def test_2_subnet_applying():
    r = classify_question("How many usable host addresses does a /26 subnet provide?")
    show("2. /26 subnet (no choices)", r)
    assert (r["bloomsLevel"], r["thinkingOrder"]) == ("Applying", "LOTS")


def test_3_microservices_evaluating():
    r = classify_question(
        "A 3-person team has 8 weeks to launch. Is a microservices architecture a good choice?",
        MICROSERVICES_CHOICES,
    )
    show("3. Microservices (with choices)", r)
    assert (r["bloomsLevel"], r["thinkingOrder"]) == ("Evaluating", "HOTS")


def test_4_prefixed_choices_match_plain():
    question = "A 3-person team has 8 weeks to launch. Is a microservices architecture a good choice?"
    variants = {
        "plain": MICROSERVICES_CHOICES,
        "A.": [f"{l}. {c}" for l, c in zip("ABCD", MICROSERVICES_CHOICES)],
        "a)": [f"{l}) {c}" for l, c in zip("abcd", MICROSERVICES_CHOICES)],
        "(A)": [f"({l}) {c}" for l, c in zip("ABCD", MICROSERVICES_CHOICES)],
    }
    texts = {name: _format_choices(ch) for name, ch in variants.items()}
    results = {name: classify_question(question, ch) for name, ch in variants.items()}
    print("4. Prefixed choices")
    for name in variants:
        print(f"    {name:>5}: text_b={texts[name]!r}\n           -> {results[name]}")
    assert len(set(texts.values())) == 1
    assert all(r == results["plain"] for r in results.values())
    # Empty / whitespace-only choices are dropped and the rest re-lettered
    assert _format_choices([" 443 ", "", "   ", "80"]) == "A) 443 | B) 80"
    # Not a letter prefix, so it is kept as-is
    assert _format_choices(["U.S. Navy"]) == "A) U.S. Navy"


def test_5_empty_question_422():
    for text in ["", "   "]:
        resp = client.post("/api/quiz/analyze", json={"quizId": "q", "questions": [{"id": "1", "text": text}]})
        print(f"5. Empty question {text!r} -> HTTP {resp.status_code} {resp.json()}")
        assert resp.status_code == 422


def test_6_full_quiz_endpoint():
    payload = {
        "quizId": "quiz-123",
        "questions": [
            {"id": "1", "text": "Which port does HTTPS use by default?", "choices": ["A) 443", "B) 80", "C) 21", "D) 25"]},
            {"id": "2", "text": "How many usable host addresses does a /26 subnet provide?"},
            {"id": "3", "text": "A 3-person team has 8 weeks to launch. Is a microservices architecture a good choice?",
             "choices": MICROSERVICES_CHOICES},
            {"id": "4", "text": "Define TCP.", "choices": None},
            {"id": "5", "text": "Explain why TCP uses a three-way handshake before sending data.", "choices": []},
        ],
    }
    resp = client.post("/api/quiz/analyze", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    print("6. POST /api/quiz/analyze")
    for a in data["analysis"]:
        print(f"    {a}")
    print(f"    summary: {data['summary']}")

    assert set(data) == {"quizId", "analysis", "summary"}
    assert data["quizId"] == "quiz-123"
    assert set(data["summary"]) == {
        "totalQuestions", "distribution", "lotsCount", "hotsCount",
        "lotsPercentage", "hotsPercentage", "flaggedCount",
    }
    expected_item_keys = {
        "questionId", "questionText", "bloomsLevel", "thinkingOrder",
        "confidence", "needsReview", "reviewReasons",
    }
    assert all(set(a) == expected_item_keys for a in data["analysis"])
    assert [a["questionId"] for a in data["analysis"]] == ["1", "2", "3", "4", "5"]

    s = data["summary"]
    assert s["totalQuestions"] == 5
    assert set(s["distribution"]) == set(classifier.BLOOM_LABELS)
    assert sum(s["distribution"].values()) == 5
    assert s["lotsCount"] + s["hotsCount"] == 5
    assert s["flaggedCount"] == sum(a["needsReview"] for a in data["analysis"])
    assert all(a["needsReview"] == bool(a["reviewReasons"]) for a in data["analysis"])
    # "Define TCP." has 2 words
    assert "short_question" in data["analysis"][3]["reviewReasons"]

    # Batched results match single-question results
    singles = [classify_question(q["text"], q.get("choices")) for q in payload["questions"]]
    batch = classify_questions([(q["text"], q.get("choices")) for q in payload["questions"]])
    assert [r["bloomsLevel"] for r in singles] == [r["bloomsLevel"] for r in batch]
    assert all(abs(a["confidence"] - b["confidence"]) < 1e-3 for a, b in zip(singles, batch))


def test_7_fallback_classifier():
    original = classifier.USE_ML_MODEL
    classifier.USE_ML_MODEL = False
    try:
        r = classify_question("Which port does HTTPS use by default?", ["443", "80"])
    finally:
        classifier.USE_ML_MODEL = original
    show("7. Fallback classifier (model disabled)", r)
    assert r["needsReview"] is True and r["reviewReasons"] == ["fallback_classifier"]


if __name__ == "__main__":
    tests = [(name, fn) for name, fn in globals().items() if name.startswith("test_") and callable(fn)]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}\n")
        except AssertionError as err:
            failed += 1
            print(f"FAIL {name}: {err}\n")
    print(f"{len(tests) - failed}/{len(tests)} passed")
    raise SystemExit(1 if failed else 0)
