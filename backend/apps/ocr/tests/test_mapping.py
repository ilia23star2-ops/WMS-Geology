"""Тесты apps.ocr.services.mapping.

c-3.x-migration-5e-2.
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
    # Границы касаются — считаем пересечением (max(axs)==min(bxs))
    assert bbox_intersects(a, b) is True


# -------------------- extract_fields --------------------

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


def test_extract_samples_fallback():
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