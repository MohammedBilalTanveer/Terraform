"""Assistant answers only from the KB: on-topic questions return KB records, off-topic ones are refused."""
import pytest





def _ask(client, q):
    r = client.post("/api/assistant/ask", json={"question": q})
    assert r.status_code == 200
    return r.json()


def test_off_topic_questions_are_refused(client):
    for q in ["What is the stock price of Tesla?", "who won the cricket match", "can I grow wheat here"]:
        a = _ask(client, q)
        assert a["refused"] is True, q
        assert a["matched"] == []
        assert "knowledge base does not contain enough information" in a["answer"]


def test_on_topic_answers_cite_existing_kb_records(client, kb):
    a = _ask(client, "how do I store rainwater")
    assert a["refused"] is False
    assert a["matched"], "expected KB matches"
    for m in a["matched"]:
        assert kb.has(m["kb_id"])
    for kid in a["evidence"]["kb_ids"]:
        assert kb.has(kid)
