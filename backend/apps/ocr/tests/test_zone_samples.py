"""Пробы извлекаются строго из зон типа sample (6e-2-web-7-backend)."""
from apps.ocr.services.mapping import extract_fields
from apps.ocr.services.zone_samples import sample_tokens


def _word(text, x, y):
    return {
        "text": text,
        "confidence": 0.9,
        "bbox": [[x, y], [x + 60, y], [x + 60, y + 20], [x, y + 20]],
    }


def _zone(ztype, x, y, w, h):
    return {
        "type": ztype,
        "bbox": [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
        "source": "manual",
    }


WORDS = [
    _word("TST13209", 100, 40),
    _word("TST13209001", 100, 200),
    _word("TST13209002", 300, 200),
]
OCR = {"text": "TST13209 TST13209001 TST13209002", "words": WORDS}

ZONES = [
    _zone("work_order_coded", 90, 30, 90, 40),
    _zone("sample", 90, 190, 90, 40),
]


def test_samples_only_from_sample_zones():
    res = extract_fields(ZONES, OCR)
    assert res["samples"] == ["TST13209001"]


def test_work_order_not_leaks_into_samples():
    res = extract_fields(ZONES, OCR)
    assert res["work_order_coded"] == "TST13209"
    assert "TST13209" not in res["samples"]


def test_fallback_without_zones_keeps_old_contract():
    res = extract_fields([], OCR)
    assert "TST13209001" in res["samples"]
    assert "TST13209002" in res["samples"]


def test_helper_excludes_scalars():
    toks = sample_tokens([], WORDS, OCR["text"], {"work_order_coded": "TST13209"})
    assert "TST13209" not in toks
    assert "TST13209001" in toks
