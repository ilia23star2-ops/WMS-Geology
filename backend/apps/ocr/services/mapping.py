"""Mapping zones + raw_ocr_data → extracted fields.

c-3.x-migration-5e-2: базовый маппинг через зоны.
c-3.x-migration-6a-fix3/4: regex для TST1234501 / TST-1234501 / TAA-A-34076001.
c-3.x-migration-6a-fix5a: fuzzy match справочников (Site, ResearchType,
  ContainerType) в тексте. Справочники передаются параметром —
  mapping.py остаётся pure-Python (тесты без БД).

Справочники передаются как list[dict] с полями:
  - sites: [{"code": "TST", "name": "Тестовый участок", "match_patterns": ["TST", "Тест"]}]
  - research_types: [{"code": "ICP", "name": "ICP"}]
  - container_types: [{"name": "Ящик"}, ...]
"""
import re
from typing import Optional


_SAMPLE_RE = re.compile(
    r"\b[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ])?-?\d{5,}\b",
    re.IGNORECASE,
)
_WORK_ORDER_RE = re.compile(
    r"\b[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ])?-?\d{2,4}\b",
    re.IGNORECASE,
)
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


# ---------- fuzzy match ----------

def _find_site(text: str, sites: list) -> Optional[str]:
    """Возвращает Site.code, если найдено в тексте."""
    if not text or not sites:
        return None
    lower = text.lower()
    # 1. match_patterns (приоритет — самые специфичные)
    for s in sites:
        for p in s.get("match_patterns") or []:
            if p and p.lower() in lower:
                return s["code"]
    # 2. exact code
    for s in sites:
        code = (s.get("code") or "").strip()
        if code and re.search(rf"\b{re.escape(code)}\b", text, re.IGNORECASE):
            return code
    # 3. substring name
    for s in sites:
        name = (s.get("name") or "").strip()
        if name and name.lower() in lower:
            return s["code"]
    return None


def _find_research_type(text: str, research_types: list) -> Optional[str]:
    """Возвращает ResearchType.code, если найдено в тексте."""
    if not text or not research_types:
        return None
    lower = text.lower()
    # 1. exact code (более короткий, но явный)
    for rt in research_types:
        code = (rt.get("code") or "").strip()
        if code and re.search(rf"\b{re.escape(code)}\b", text, re.IGNORECASE):
            return code
    # 2. substring name
    for rt in research_types:
        name = (rt.get("name") or "").strip()
        if name and name.lower() in lower:
            return rt["code"]
    return None


def _find_container_type(text: str, container_types: list) -> Optional[str]:
    """Возвращает ContainerType.name, если найдено в тексте.

    Root-match: «Ящик» → «Ящик*» (поймает «Ящики»). Обратное —
    «Ящики» в тексте, «Ящик» в справочнике.
    """
    if not text or not container_types:
        return None
    lower = text.lower()
    # 1. exact name
    for ct in container_types:
        name = (ct.get("name") or "").strip()
        if name and name.lower() in lower:
            return name
    # 2. root match (5 первых символов)
    for ct in container_types:
        name = (ct.get("name") or "").strip()
        if len(name) >= 4:
            root = name[:4].lower()
            if re.search(rf"\b{re.escape(root)}\w*", lower):
                return name
    return None


def extract_fields(
    zones: list,
    ocr_data: dict,
    sites: Optional[list] = None,
    research_types: Optional[list] = None,
    container_types: Optional[list] = None,
) -> dict:
    """Извлекает поля из OCR-данных по зонам + fallback + fuzzy match.

    Возвращает dict:
      work_order_coded, work_order_incoming, container_number,
      research_type, container_type, site,
      samples, wells, source
    """
    words = ocr_data.get("words") or []
    full_text = ocr_data.get("text") or ""

    result: dict = {
        "work_order_coded": None,
        "work_order_incoming": None,
        "container_number": None,
        "research_type": None,
        "container_type": None,
        "site": None,
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

    # 2. Samples — regex по всему тексту
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

    # 4. Fallback: work_order_coded без зон
    if not result["work_order_coded"]:
        text_wo = full_text
        for s in result["samples"]:
            text_wo = text_wo.replace(s, " ")
        for m in _WORK_ORDER_RE.findall(text_wo):
            candidate = m.upper()
            if candidate not in samples_set:
                result["work_order_coded"] = candidate
                break

    # 5. Fuzzy match справочников
    if not result["site"]:
        result["site"] = _find_site(full_text, sites or [])
    if not result["research_type"]:
        result["research_type"] = _find_research_type(full_text, research_types or [])
    if not result["container_type"]:
        result["container_type"] = _find_container_type(full_text, container_types or [])

    # 6. Источник
    has_zones = bool(zones)
    has_zones_data = any(result[k] for k in scalar_types)
    has_fallback = bool(
        result["samples"]
        or result["wells"]
        or result["work_order_coded"]
        or result["site"]
        or result["research_type"]
        or result["container_type"]
    )

    if has_zones and has_zones_data and has_fallback:
        result["source"] = "mixed"
    elif has_zones and has_zones_data:
        result["source"] = "zones"
    elif has_fallback:
        result["source"] = "fallback"
    else:
        result["source"] = "none"

    return result