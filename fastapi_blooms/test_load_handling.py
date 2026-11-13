"""
Tests for the load handling added after the stress test: result cache, fair
queue (first come, first served) and the "busy" reply.

Run from this folder:  python test_load_handling.py
"""
import asyncio
import time

import httpx

import classifier
import main


def _questions(prefix, n):
    return [
        (f"{prefix}: explain how a stack differs from a queue in example {i}.", ["LIFO order", "FIFO order", "Random order", "No order"])
        for i in range(n)
    ]


def _payload(items, quiz_id="t"):
    return {"quizId": quiz_id, "questions": [{"id": str(i), "text": t, "choices": c} for i, (t, c) in enumerate(items)]}


def _reset_queue(slots, max_waiting):
    main.INFERENCE_SLOTS = slots
    main.MAX_WAITING = max_waiting
    main._slots = None
    main._waiting = 0
    main._running = 0


def test_1_cache_gives_same_classification():
    classifier._cache.clear()
    items = _questions("cache", 8)
    first = classifier.classify_questions(items)            # computed by the model
    second = classifier.classify_questions(items)           # from the cache
    assert first == second
    # Compared with classifying each question alone (different batch padding):
    for (text, choices), cached in zip(items, second):
        alone = classifier._predict([text], [classifier._format_choices(choices)])[0]
        assert alone["bloomsLevel"] == cached["bloomsLevel"]
        assert abs(alone["confidence"] - cached["confidence"]) < 1e-3
    print("PASS cached results match the model's classification")


def test_2_only_new_questions_reach_the_model():
    classifier._cache.clear()
    old = _questions("reanalyze", 45)
    classifier.classify_questions(old)
    sizes = []
    original = classifier._predict

    def counting(questions, choices):
        sizes.append(len(questions))
        return original(questions, choices)

    classifier._predict = counting
    try:
        edited = old[:40] + _questions("edited", 5) + old[40:45]
        results = classifier.classify_questions(edited)
    finally:
        classifier._predict = original
    assert sizes == [5], sizes
    assert len(results) == 50
    print("PASS re-analyzing 50 questions after editing 5: only those 5 go through the model")


def test_3_duplicates_in_a_batch_are_classified_once():
    classifier._cache.clear()
    sizes = []
    original = classifier._predict
    classifier._predict = lambda q, c: (sizes.append(len(q)), original(q, c))[1]
    try:
        items = _questions("dup", 3) * 4
        results = classifier.classify_questions(items)
    finally:
        classifier._predict = original
    assert sizes == [3] and len(results) == 12
    print("PASS repeated questions in one batch are classified once")


def test_4_cache_size_is_bounded():
    saved = classifier.CACHE_SIZE
    classifier.CACHE_SIZE = 10
    classifier._cache.clear()
    try:
        classifier.classify_questions(_questions("bounded", 25))
        assert classifier.cache_size() == 10
    finally:
        classifier.CACHE_SIZE = saved
    print("PASS the cache never grows past its size limit")


def test_5_needs_model():
    classifier._cache.clear()
    items = _questions("needs", 3)
    assert classifier.needs_model(items)
    classifier.classify_questions(items)
    assert not classifier.needs_model(items)
    assert classifier.needs_model(items + _questions("needs-new", 1))
    print("PASS a batch skips the model only when every question is cached")


async def _run_concurrently(payloads, delays, slow_seconds):
    """Send payloads with start delays; the model takes slow_seconds per batch."""
    original = classifier._predict

    def slow(questions, choices):
        time.sleep(slow_seconds)
        return original(questions, choices)

    classifier._predict = slow
    finished = []
    try:
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=60) as client:
            async def one(i, payload, delay):
                await asyncio.sleep(delay)
                r = await client.post("/api/quiz/analyze", json=payload)
                finished.append(i)
                return r
            responses = await asyncio.gather(*(one(i, p, d) for i, (p, d) in enumerate(zip(payloads, delays))))
    finally:
        classifier._predict = original
    return responses, finished


def test_6_busy_reply_when_the_queue_is_full():
    classifier._cache.clear()
    _reset_queue(slots=1, max_waiting=1)
    payloads = [_payload(_questions(f"busy{i}", 2)) for i in range(3)]
    responses, _ = asyncio.run(_run_concurrently(payloads, [0, 0.1, 0.2], slow_seconds=1.0))
    codes = [r.status_code for r in responses]
    assert codes == [200, 200, 503], codes
    busy = responses[2]
    assert int(busy.headers["Retry-After"]) >= 1
    assert "busy" in busy.json()["detail"]
    print(f"PASS 1 running + 1 waiting, the 3rd gets 503 at once (Retry-After {busy.headers['Retry-After']} s)")


def test_7_queue_is_first_come_first_served():
    classifier._cache.clear()
    _reset_queue(slots=1, max_waiting=10)
    payloads = [_payload(_questions(f"fifo{i}", 2)) for i in range(4)]
    responses, finished = asyncio.run(_run_concurrently(payloads, [0, 0.1, 0.2, 0.3], slow_seconds=0.4))
    assert all(r.status_code == 200 for r in responses)
    assert finished == [0, 1, 2, 3], finished
    print("PASS waiting batches are served in the order they arrived")


def test_8_cached_batches_skip_the_queue():
    classifier._cache.clear()
    _reset_queue(slots=1, max_waiting=0)
    cached = _questions("skip", 3)
    classifier.classify_questions(cached)
    payloads = [_payload(_questions("blocker", 2)), _payload(cached)]
    responses, finished = asyncio.run(_run_concurrently(payloads, [0, 0.1], slow_seconds=1.0))
    assert [r.status_code for r in responses] == [200, 200]
    assert finished == [1, 0], finished
    print("PASS a fully cached batch is answered while the model is busy")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    passed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
    _reset_queue(slots=4, max_waiting=60)
    print(f"\n{passed}/{len(tests)} passed")
