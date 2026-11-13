"""Mapping zones + raw_ocr_data → extracted fields.

c-3.x-migration-5e-2.

Для каждой зоны:
  - берём слова из raw_ocr_data.words, чьи bbox пересекаются с зоной;
  - склеиваем текст по позиции (сверху-вниз, слева-направо);
  - это значение поля.

Для проб — fallback по всему тексту (regex TAA-A\\d+), потому что
EasyOCR обычно читает пробу как одно слово, а зона 'sample' пока
используется только для подсветки (UI, 5f).
"""
import re
from typing import Any, Optional


# TAA-A34076001, TAA-B12345, TTA-A9999 и т.п.
_SAMPLE_RE = re.compile(r"\b[A-Z]{2,}-[A-Z]\d{3,}\b", re.IGNORECASE)
# Номера скважин: middle из sample-номера или "скважина 12345"
_WELL_RE = re.compile(r"\d{5,}")


def bbox_intersects(a: list, b: list) -> bool:
    """AABB-пересечение двух bbox [[x,y], ...]."""
    axs = [p[0] for p in a]
    ays = [p[1] for p in a]
    bxs = [p[0] for p in b]
    bys = [p[1] for p in b]
    return not (
        max(axs) < min(bxs)
        or min(axs) > max(bxs)
        or max(ays) < min(bys)
        or min(ays) > max(bys)
    )


def _sort_words(words: list) -> list:
    """Сортировка сверху-вниз, слева-направо (центр bbox)."""

    def key(w: dict) -> tuple:
        cy = sum(p[1] for p in w["bbox"]) / 4
        cx = sum(p[0] for p in w["bbox"]) / 4
        return (cy, cx)

    return sorted(words, key=key)


def _words_in_zone(words: list, zone_bbox: list) -> list:
    return [w for w in words if bbox_intersects(w["bbox"], zone_bbox)]


def _extract_scalar(words: list, zone: dict) -> Optional[str]:
    inside = _words_in_zone(words, zone["bbox"])
    if not inside:
        return None
    ordered = _sort_words(inside)
    text = " ".join(w["text"] for w in ordered).strip()
    return text or None


def extract_fields(zones: list, ocr_data: dict) -> dict:
    """Извлекает поля из OCR-данных по зонам.

    Возвращает dict:
      work_order_coded: str | None
      work_order_incoming: str | None
      container_number: str | None
      research_type: str | None
      samples: list[str]
      wells: list[str]
      source: 'zones' | 'fallback' | 'mixed' | 'none'
    """
    words = ocr_data.get("words") or []
    full_text = ocr_data.get("text") or ""

    result: dict = {
        "work_order_coded": None,
        "work_order_incoming": None,
        "container_number": None,
        "research_type": None,
        "samples": [],
        "wells": [],
    }

    # 1. Scalar-поля из зон
    scalar_types = (
        "work_order_coded",
        "work_order_incoming",
        "container_number",
        "research_type",
    )
    for zone in zones or []:
        t = zone.get("type")
        if t in scalar_types:
            val = _extract_scalar(words, zone)
            if val:
                result[t] = val

    # 2. Samples — regex по всему тексту (fallback + зоны 'sample' как подсказка)
    samples_set: set = set()
    for m in _SAMPLE_RE.findall(full_text):
        samples_set.add(m.upper())
    result["samples"] = sorted(samples_set)

    # 3. Wells — из middle sample-номеров + из зон 'well'
    wells_set: set = set()
    for s in result["samples"]:
        for wm in _WELL_RE.findall(s):
            wells_set.add(wm)
    for zone in zones or []:
        if zone.get("type") == "well":
            val = _extract_scalar(words, zone)
            if val:
                for wm in _WELL_RE.findall(val):
                    wells_set.add(wm)
    result["wells"] = sorted(wells_set)

    # 4. Источник
    has_zones = bool(zones)
    has_zones_data = any(
        result[k] for k in scalar_types
    )
    has_fallback = bool(result["samples"] or result["wells"])

    if has_zones and has_zones_data and has_fallback:
        result["source"] = "mixed"
    elif has_zones and has_zones_data:
        result["source"] = "zones"
    elif has_fallback:
        result["source"] = "fallback"
    else:
        result["source"] = "none"

    return result