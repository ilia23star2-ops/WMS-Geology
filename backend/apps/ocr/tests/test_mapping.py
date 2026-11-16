"""Тесты apps.ocr.services.mapping.

c-3.x-migration-5e-2: базовые.
c-3.x-migration-6a-fix3: реальный формат TST1234501 + fallback work_order.
c-3.x-migration-6a-fix4: дефис перед цифрами (TST-1234501).
"""
import pytest

from apps.ocr.services.mapping import (
    bbox_intersects,
    extract_fields,
)


def _word(text: str, bbox: list) -> dict:
    return {"text": text, "confidence": 0.9, "bbox": bbox}


def _ocr(words: list, text: str) -> dict:
    return {"words": words, "text": text}


# -------------------- bbox_intersects --------------------

def test_bbox_intersects_true():
    a = [[0, 0], [100, 0], [100, 50], [0, 50]]
    b = [[50, 25], [150, 25], [150, 75], [50, 75]]
    assert bbox_intersects(a, b) is True


def test_bbox_intersects_false():
    a = [[0, 0], [50, 0], [50, 50], [0, 50]]
    b = [[100, 100], [150, 100], [150, 150], [100, 150]]
    assert bbox_intersects(a, b) is False


def test_bbox_intersects_edge_touching():
    a = [[0, 0], [100, 0], [100, 100], [0, 100]]
    b = [[100, 0], [200, 0], [200, 100], [100, 100]]
    assert bbox_intersects(a, b) is True


# -------------------- старый формат (TAA-A...) --------------------

def test_extract_work_order_from_zone():
    words = [
        _word("TST0001", [[10, 20], [100, 20], [100, 50], [10, 50]]),
        _word("шум", [[200, 200], [300, 200], [300, 220], [200, 220]]),
    ]
    zones = [
        {
            "type": "work_order_coded",
            "bbox": [[5, 15], [110, 15], [110, 55], [5, 55]],
        }
    ]
    result = extract_fields(zones, _ocr(words, "TST0001 шум"))

    assert result["work_order_coded"] == "TST0001"
    assert "шум" not in (result["work_order_coded"] or "")
    assert result["source"] in ("zones", "mixed")


def test_extract_multiple_scalars():
    words = [
        _word("TST0001", [[10, 20], [100, 20], [100, 50], [10, 50]]),
        _word("T-001", [[10, 100], [100, 100], [100, 130], [10, 130]]),
        _word("02-Тест001", [[10, 200], [150, 200], [150, 230], [10, 230]]),
    ]
    zones = [
        {"type": "work_order_coded", "bbox": [[5, 15], [110, 15], [110, 55], [5, 55]]},
        {"type": "container_number", "bbox": [[5, 95], [110, 95], [110, 135], [5, 135]]},
        {"type": "work_order_incoming", "bbox": [[5, 195], [160, 195], [160, 235], [5, 235]]},
    ]
    result = extract_fields(zones, _ocr(words, "TST0001 T-001 02-Тест001"))

    assert result["work_order_coded"] == "TST0001"
    assert result["container_number"] == "T-001"
    assert result["work_order_incoming"] == "02-Тест001"


def test_extract_empty_zone_returns_none():
    zones = [
        {"type": "work_order_coded", "bbox": [[500, 500], [600, 500], [600, 600], [500, 600]]}
    ]
    result = extract_fields(zones, _ocr([], ""))

    assert result["work_order_coded"] is None
    assert result["source"] == "none"


def test_extract_samples_fallback_old_format():
    text = "TST0001 TAA-A34076001 TAA-A34076002 шум TAA-B12345"
    result = extract_fields([], _ocr([], text))

    assert "TAA-A34076001" in result["samples"]
    assert "TAA-A34076002" in result["samples"]
    assert "TAA-B12345" in result["samples"]
    assert "шум" not in result["samples"]
    assert result["source"] == "fallback"


def test_extract_wells_from_samples():
    text = "TAA-A34076001 TAA-A34076002"
    result = extract_fields([], _ocr([], text))

    assert "34076001" in result["wells"]
    assert "34076002" in result["wells"]


def test_extract_zones_plus_samples_mixed():
    words = [_word("TST0001", [[10, 20], [100, 20], [100, 50], [10, 50]])]
    zones = [
        {"type": "work_order_coded", "bbox": [[5, 15], [110, 15], [110, 55], [5, 55]]}
    ]
    result = extract_fields(zones, _ocr(words, "TST0001 TAA-A34076001"))

    assert result["work_order_coded"] == "TST0001"
    assert "TAA-A34076001" in result["samples"]
    assert result["source"] == "mixed"


def test_extract_no_zones_no_samples_returns_none():
    result = extract_fields([], _ocr([], ""))
    assert result["source"] == "none"
    assert result["samples"] == []


# -------------------- новый формат (TST1234501) --------------------

def test_extract_samples_tst_format():
    """TST1234501 — новый формат этикетки, без дефиса."""
    text = "TST1234 TST1234501 TST1234502 TST1234503"
    result = extract_fields([], _ocr([], text))

    assert "TST1234501" in result["samples"]
    assert "TST1234502" in result["samples"]
    assert "TST1234503" in result["samples"]
    assert "TST1234" not in result["samples"]


def test_extract_work_order_fallback():
    """TST1234 — Н/З, не попадёт в samples (4 цифры < 5)."""
    text = "TST1234 TST1234501 TST1234502"
    result = extract_fields([], _ocr([], text))

    assert result["work_order_coded"] == "TST1234"
    assert "TST1234501" in result["samples"]
    assert "TST1234502" in result["samples"]
    assert "TST1234" not in result["samples"]


def test_extract_work_order_fallback_no_samples():
    text = "TST1234"
    result = extract_fields([], _ocr([], text))

    assert result["work_order_coded"] == "TST1234"
    assert result["samples"] == []
    assert result["source"] == "fallback"


def test_extract_work_order_fallback_realistic_label():
    text = (
        "Тестовый участок TST1234 ICP 1 "
        "TST1234501 TST1234502 TST1234503 "
        "TST1234504 TST1234505 TST1234506"
    )
    result = extract_fields([], _ocr([], text))

    assert result["work_order_coded"] == "TST1234"
    assert len(result["samples"]) == 6
    assert result["samples"][0] == "TST1234501"
    assert "TST1234" not in result["samples"]


# -------------------- 6a-fix4: дефис перед цифрами --------------------

def test_extract_sample_with_dash_before_digits():
    """TST-1234501 — дефис между буквами и цифрами."""
    text = "TST-1234501 TST-1234502"
    result = extract_fields([], _ocr([], text))

    assert "TST-1234501" in result["samples"]
    assert "TST-1234502" in result["samples"]


def test_extract_sample_with_double_dash():
    """TAA-A-34076001 — дефис + буква + дефис + цифры."""
    text = "TAA-A-34076001"
    result = extract_fields([], _ocr([], text))

    assert "TAA-A-34076001" in result["samples"]


def test_extract_work_order_with_dash():
    """TST-1234 — Н/З с дефисом."""
    text = "TST-1234"
    result = extract_fields([], _ocr([], text))

    assert result["work_order_coded"] == "TST-1234"
    assert result["samples"] == []


def test_extract_mixed_formats():
    """В одном тексте — все форматы проб сразу."""
    text = (
        "TST1234 "
        "TAA-A34076001 TST1234501 TST-1234502 TAA-A-34076003"
    )
    result = extract_fields([], _ocr([], text))

    assert result["work_order_coded"] == "TST1234"
    assert "TAA-A34076001" in result["samples"]
    assert "TST1234501" in result["samples"]
    assert "TST-1234502" in result["samples"]
    assert "TAA-A-34076003" in result["samples"]