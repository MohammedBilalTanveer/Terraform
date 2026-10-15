"""v1.2: troubleshooting, planting calendar relative to rain, soil-builder crops, field FAQ search."""
import re

import pytest

from .conftest import plan
from .test_scenario_variations import FLAT_POOLING, STANDARD, assert_ids_valid

MONTHS = ("january", "february", "march", "april", "june", "july", "august", "september", "october",
          "november", "december", "jan ", "feb ", "mar ", "apr ", "jun ", "jul ", "aug ", "sep ", "oct ", "nov ", "dec ")
DATE_PATTERN = re.compile(r"\b\d{1,2}\s*[/.\-]\s*\d{1,2}\b|\b\d{1,2}(st|nd|rd|th)\b|\b(19|20)\d{2}\b")


def test_troubleshooting_cards(client, kb):
    if not kb.records("troubleshooting"):
        pytest.skip("KB has no troubleshooting yet")
    for obs in ({"description": STANDARD}, {"description": FLAT_POOLING, "slope": "flat", "pooling": "widespread"}):
        p = plan(client, obs)
        tr = p["workflow"]["ongoing_care"]["troubleshooting"]
        assert tr
        for card in tr:
            rec = kb.get(card["id"])
            assert kb.collection_of(card["id"]) == "troubleshooting"
            assert card["symptom"] == (rec.get("symptom") or rec.get("title"))
            assert card["likely_causes"] == rec.get("likely_causes", [])
            assert card["evidence"]["kb_ids"][0] == card["id"]
            for rid in rec.get("related_kb_ids") or []:
                if kb.has(rid):
                    assert rid in card["evidence"]["kb_ids"]
        assert_ids_valid(kb, p)


def test_calendar_relative_to_rain(client, kb):
    rec = kb.get("time_calendar_relative_to_rain")
    if not rec:
        pytest.skip("KB has no planting calendar yet")
    cal = plan(client, {"description": STANDARD})["workflow"]["timeframe"]["calendar"]
    assert cal and cal["kb_id"] == "time_calendar_relative_to_rain"
    assert len(cal["phases"]) == len([p for p in rec["phases"] if p.get("when")]) >= 2
    for ph in cal["phases"]:
        assert ph["when"] and ph["actions"]
        blob = (ph["when"] + " " + " ".join(ph["actions"])).lower()
        assert not any(m in blob + " " for m in MONTHS), ph["when"]
        assert not DATE_PATTERN.search(blob), ph["when"]


def test_soil_builders_never_ranked_as_food(client, kb):
    builders = {c["id"] for c in kb.records("crop_profiles") if c.get("category") == "soil_builder"}
    if not builders:
        pytest.skip("KB has no soil_builder crops yet")
    for obs in ({"description": STANDARD}, {"description": STANDARD, "wet_season_weeks_remaining": 16}):
        p = plan(client, obs)
        cs = p["workflow"]["crop_suggestions"]
        assert not builders & {c["crop_id"] for c in cs["field_crops"]}
        shown = {c["crop_id"]: c for c in cs["tree_options"]}
        for b in builders - {c["crop_id"] for c in cs["excluded"]}:
            assert b in shown
            assert shown[b]["category"] == "soil_builder"
            assert not [e for e in shown[b]["score_breakdown"] if e["factor"].startswith("season_fit")]
        assert p["workflow"]["ongoing_care"]["crop_id"] not in builders
        assert not builders & {r["crop_id"] for r in p["workflow"]["timeframe"]["rows"]}


def test_assistant_answers_faq(client, kb):
    faqs = kb.records("field_faq")
    if not faqs:
        pytest.skip("KB has no field_faq yet")
    hits = 0
    for f in faqs:
        r = client.post("/api/assistant/ask", json={"question": f["question"]}).json()
        if not r["refused"] and r["matched"] and r["matched"][0]["kb_id"].startswith("faq_"):
            hits += 1
            top = kb.get(r["matched"][0]["kb_id"])
            assert top["answer"] in r["answer"], "FAQ answer must be returned verbatim"
            assert r["matched"][0]["collection"] == "field_faq"
            assert all(kb.has(i) for i in r["evidence"]["kb_ids"])
    assert hits >= max(1, int(0.6 * len(faqs))), f"only {hits}/{len(faqs)} FAQ questions answered from the FAQ"


def test_assistant_still_refuses_off_topic(client):
    for q in ("can I grow wheat here", "What is the stock price of Tesla?"):
        r = client.post("/api/assistant/ask", json={"question": q}).json()
        assert r["refused"] is True and r["matched"] == [], q
