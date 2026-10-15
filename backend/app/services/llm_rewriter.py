"""Optional LLM re-wording of already-assembled summary strings. OFF by default.

Enabled only if ENABLE_LLM_REWRITE=true AND OPENAI_API_KEY AND OPENAI_MODEL are set AND the `openai`
package imports. The model receives ONLY the assembled text plus the KB fact text it came from, and
must return JSON {"text": "..."}. The output is rejected (deterministic text kept) if it:
  * does not parse, or is empty / more than 2x longer (or < 0.4x) than the input,
  * contains any number not present in the input or facts,
  * names a crop (from crop_profiles names/local names) not present in the input or facts,
  * uses a blocked agronomy/chemical/unit term (pesticide, NPK, lime, kg, pH, ...) not present in the input/facts,
  * introduces new content words: every meaningful word (4+ letters, not plain connective English) must
    already appear in the KB text it was given — so the model can re-order and simplify, never add facts.
Any exception or the timeout (default 8 s) falls back to the deterministic text. A missing key never crashes.
"""
from __future__ import annotations

import json
import re
from typing import Iterable, List, Tuple

from ..config import Settings
from .kb_loader import KnowledgeBase

SYSTEM_PROMPT = (
    "You rewrite short farm-advice summaries in friendlier, plain words for a smallholder farmer. "
    "Use ONLY the information in the given text and facts, and reuse their words wherever possible. "
    "Never add advice, steps, numbers, crops, products, chemicals, causes or claims, and never fill gaps "
    "with your own knowledge: if something is not in the text, leave it out. "
    "Keep it about the same length. Reply as JSON: {\"text\": \"...\"}."
)

# Terms that signal outside agronomy knowledge. Rejected unless the KB text itself contains them.
BLOCKED_TERMS = {
    "pesticide", "insecticide", "herbicide", "fungicide", "chemical", "chemicals", "fertiliser", "fertilizer",
    "npk", "urea", "dap", "potash", "lime", "limestone", "dolomite", "gypsum", "sulphur", "sulfur", "nitrogen",
    "phosphorus", "potassium", "ph", "kg", "kilogram", "gram", "grams", "litre", "litres", "liter", "liters",
    "ml", "cm", "mm", "metre", "metres", "meter", "meters", "hectare", "acre", "percent", "ppm", "glyphosate",
    "malathion", "chlorpyrifos", "imidacloprid", "cypermethrin", "brand", "buy", "shop", "store-bought",
}

# Plain connective words a friendly rewrite may use even if the KB text did not.
PLAIN_WORDS = set("""
about above after again also always another around away back because been before being below best better
between both bring careful carefully come comes could does doing done down each easy easier either else
enough even every first from give gives going good great have having help helps here into just keep keeps
know known kind last later least less like little look looks made make makes many maybe more most much must
need needs next often once only other over part really right same should show shows simple since small some
something soon start still such sure take takes than that their them then there these they thing things
this those though through time times today together too under unless until upon very want ways well were
what when where whether which while will with within without would your yours yourself also already able
""".split())

MAX_NEW_WORDS = 2  # tolerate at most a couple of harmless paraphrase words


def _stem(w: str) -> str:
    for suf in ("ing", "edly", "ed", "es", "s", "ly"):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def _content_words(s: str) -> List[str]:
    return [w for w in re.findall(r"[a-z]+", (s or "").lower()) if len(w) >= 4 and w not in PLAIN_WORDS]


def new_content_words(candidate: str, reference: str) -> List[str]:
    ref = {_stem(w) for w in re.findall(r"[a-z]+", reference.lower())}
    return [w for w in _content_words(candidate) if _stem(w) not in ref]


def llm_available(settings: Settings) -> bool:
    if not settings.llm_configured:
        return False
    try:
        import openai  # noqa: F401
    except Exception:
        return False
    return True


def _numbers(s: str) -> set:
    return set(re.findall(r"\d+(?:\.\d+)?", s or ""))


def _crop_names(kb: KnowledgeBase) -> List[str]:
    names = []
    for c in kb.records("crop_profiles"):
        for n in [c.get("name")] + list(c.get("local_names") or []):
            if isinstance(n, str) and len(n) >= 3:
                names.append(n.lower())
    return names


def validate(original: str, candidate: str, facts: Iterable[str], kb: KnowledgeBase) -> bool:
    if not isinstance(candidate, str) or not candidate.strip():
        return False
    ref = " ".join([original, *facts])
    if len(candidate) > 2 * max(len(original), 40) or len(candidate) < 0.4 * len(original):
        return False
    if _numbers(candidate) - _numbers(ref):
        return False
    low_c, low_ref = candidate.lower(), ref.lower()
    ref_words = set(re.findall(r"[a-z-]+", low_ref))
    for term in BLOCKED_TERMS:
        if re.search(r"(?<![a-z])" + re.escape(term) + r"(?![a-z])", low_c) and term not in ref_words:
            return False
    if len(set(new_content_words(candidate, ref))) > MAX_NEW_WORDS:
        return False
    for name in _crop_names(kb):
        pat = r"(?<![a-z])" + re.escape(name) + r"(?![a-z])"
        if re.search(pat, low_c) and not re.search(pat, low_ref):
            return False
    return True


def rewrite(settings: Settings, kb: KnowledgeBase, original: str, facts: List[str]) -> Tuple[str, bool]:
    """Returns (text, llm_used). Never raises."""
    if not original or not llm_available(settings):
        return original, False
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key, timeout=settings.llm_timeout_seconds, max_retries=0)
        payload = json.dumps({"text": original, "facts": facts[:12]}, ensure_ascii=False)
        resp = client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": payload}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        content = resp.choices[0].message.content or ""
        data = json.loads(content)
        candidate = data.get("text") if isinstance(data, dict) else None
        if validate(original, candidate, facts, kb):
            return candidate.strip(), True
    except Exception:
        pass
    return original, False
