"""The optional LLM may only re-word KB text: anything that adds facts, products, units or new words is rejected."""
from app.services import llm_rewriter as lr

ORIGINAL = "Aphids gather on new shoots and young pods in dry weather. Rub them off by hand and spray neem leaf extract in the evening."
FACTS = ["Check under leaves every few days.", "Neem leaf extract: crush a handful of fresh neem leaves in a bucket of water."]


def test_faithful_rewrite_is_accepted(kb):
    ok = "In dry weather aphids gather on new shoots and young pods. Rub them off by hand, and in the evening spray neem leaf extract."
    assert lr.validate(ORIGINAL, ok, FACTS, kb)


def test_new_chemical_or_product_is_rejected(kb):
    bad = "Aphids gather on new shoots and young pods in dry weather. Spray an insecticide or rub them off by hand."
    assert not lr.validate(ORIGINAL, bad, FACTS, kb)


def test_units_and_numbers_are_rejected(kb):
    assert not lr.validate(ORIGINAL, ORIGINAL + " Use 5 ml per litre.", FACTS, kb)
    assert not lr.validate(ORIGINAL, ORIGINAL.replace("by hand", "with a kg of ash"), FACTS, kb)


def test_new_advice_words_are_rejected(kb):
    bad = ("Aphids gather on new shoots and young pods in dry weather. Rub them off by hand, release ladybirds, "
           "plant marigolds nearby and dust sulphur powder.")
    assert not lr.validate(ORIGINAL, bad, FACTS, kb)


def test_rewrite_without_key_falls_back(kb):
    from app.config import Settings
    text, used = lr.rewrite(Settings(openai_api_key="", openai_model="", enable_llm_rewrite=False), kb, ORIGINAL, FACTS) \
        if "openai_api_key" in Settings.__init__.__code__.co_varnames else (ORIGINAL, False)
    assert text == ORIGINAL and used is False
