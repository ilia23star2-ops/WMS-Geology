"""Mapping zones + raw_ocr_data → extracted fields.

c-5e-2: базовый маппинг через зоны.
c-6a-fix3/4: regex TST1234501 / TST-1234501 / TAA-A-34076001.
c-6a-fix5a: fuzzy match справочников.
c-6j: OCR-нормализация (O→0, I/l→1) в trailing; Latin↔Cyrillic;
  коррекция префикса (ST→TST) + фильтр fallback Н/З по valid_prefixes.
"""
import re
from typing import Optional


_SAMPLE_RE = re.compile(
    r"\b[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ])?-?[0-9OIl]{5,}\b",
    re.IGNORECASE,
)
_WORK_ORDER_RE = re.compile(
    r"\b[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ])?-?[0-9OIl]{2,4}\b",
    re.IGNORECASE,
)
_WELL_RE = re.compile(r"\d{5,}")
_DIGIT_SUFFIX_RE = re.compile(r"[0-9OoIiLl]+$")
_PREFIX_RE = re.compile(r"^[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ])?", re.IGNORECASE)

_OCR_DIGIT_TRANS = str.maketrans({
    "O": "0", "o": "0", "I": "1", "i": "1", "l": "1",
})

_LAT_TO_CYR = str.maketrans({
    "A": "А", "B": "В", "E": "Е", "K": "К", "M": "М",
    "H": "Н", "O": "О", "P": "Р", "C": "С", "T": "Т",
    "X": "Х", "Y": "У",
    "a": "а", "b": "в", "e": "е", "k": "к", "m": "м",
    "h": "н", "o": "о", "p": "р", "c": "с", "t": "т",
    "x": "х", "y": "у",
})


def _fix_ocr_digits(s: str) -> str:
    """O→0, I/l→1 в trailing цифровой части. TSTI209OI → TST120901."""
    m = _DIGIT_SUFFIX_RE.search(s)
    if not m:
        return s
    body = m.group()
    fixed = body.translate(_OCR_DIGIT_TRANS)
    if not fixed.isdigit():
        return s
    return s[:m.start()] + fixed


def _norm_cyr(s: str) -> str:
    return s.translate(_LAT_TO_CYR).upper()


def _levenshtein(a: str, b: str) -> int:
    """Расстояние Левенштейна."""
    if len(a) < len(b):
        return _levenshtein(b, a)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(
                prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb),
            ))
        prev = cur
    return prev[-1]


def _fix_prefix(s: str, valid_prefixes: set) -> str:
    """Коррекция префикса: ST→TST (Levenshtein 1).

    Если s уже начинается с валидного — без изменений.
    Иначе — ближайший prefix (distance ≤1) заменяет.
    """
    if not valid_prefixes:
        return s
    upper = s.upper()
    for vp in valid_prefixes:
        if upper.startswith(vp.upper()):
            return s  # уже валидный
    m = _PREFIX_RE.match(s)
    if not m:
        return s
    prefix = m.group()
    body = s[len(prefix):]
    best = None
    best_dist = 2
    for vp in valid_prefixes:
        d = _levenshtein(prefix.upper(), vp.upper())
        if d < best_dist:
            best_dist = d
            best = vp
    if best and best_dist <= 1:
        return best.upper() + body
    return s


def bbox_intersects(a: list, b: list) -> bool:
    axs = [p[0] for p in a]
    ays = [p[1] for p in a]
    bxs = [p[0] for p in b]
    bys = [p[1] for p in b]
    return not (
        max(axs) < min(bxs) or min(axs) > max(bxs)
        or max(ays) < min(bys) or min(ays) > max(bys)
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


def _find_site(text: str, sites: list) -> Optional[str]:
    if not text or not sites:
        return None
    lower = text.lower()
    for s in sites:
        for p in s.get("match_patterns") or []:
            if p and p.lower() in lower:
                return s["code"]
    for s in sites:
        code = (s.get("code") or "").strip()
        if code and re.search(
            rf"(?<![A-ZА-ЯЁ0-9]){re.escape(code)}(?![A-ZА-ЯЁ0-9])",
            text, re.IGNORECASE,
        ):
            return code
    for s in sites:
        name = (s.get("name") or "").strip()
        if name and name.lower() in lower:
            return s["code"]
    return None


def _find_research_type(text: str, research_types: list) -> Optional[str]:
    if not text or not research_types:
        return None
    text_norm = _norm_cyr(text)
    for rt in research_types:
        code_norm = _norm_cyr((rt.get("code") or "").strip())
        if code_norm and re.search(
            rf"(?<![A-ZА-ЯЁ0-9]){re.escape(code_norm)}(?![A-ZА-ЯЁ0-9])",
            text_norm,
        ):
            return rt["code"]
    for rt in research_types:
        name_norm = _norm_cyr((rt.get("name") or "").strip())
        if name_norm and name_norm in text_norm:
            return rt["code"]
    return None


def _find_container_type(text: str, container_types: list) -> Optional[str]:
    if not text or not container_types:
        return None
    lower = text.lower()
    for ct in container_types:
        name = (ct.get("name") or "").strip()
        if name and name.lower() in lower:
            return name
    for ct in container_types:
        name = (ct.get("name") or "").strip()
        if len(name) >= 4:
            root = name[:4].lower()
            if re.search(rf"\b{re.escape(root)}\w*", lower):
                return name
    return None


def _has_valid_prefix(s: str, valid_prefixes: set) -> bool:
    """Начинается ли s с одного из валидных префиксов."""
    if not valid_prefixes:
        return True
    upper = s.upper()
    for vp in valid_prefixes:
        if upper.startswith(vp.upper()):
            return True
    return False


def extract_fields(
    zones: list,
    ocr_data: dict,
    sites: Optional[list] = None,
    research_types: Optional[list] = None,
    container_types: Optional[list] = None,
    valid_prefixes: Optional[set] = None,
) -> dict:
    """Извлекает поля из OCR + fallback + fuzzy + OCR-fix.

    valid_prefixes — set[str] валидных префиксов (site.code + lab.prefixes + match_patterns).
    Если передан — samples/Н/З без валидного префикса отбрасываются,
    префикс корректируется (ST→TST).
    """
    words = ocr_data.get("words") or []
    full_text = ocr_data.get("text") or ""
    vp = valid_prefixes or set()

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
        "work_order_coded", "work_order_incoming",
        "container_number", "research_type",
    )
    for zone in zones or []:
        t = zone.get("type")
        if t in scalar_types:
            val = _extract_scalar(words, zone)
            if val:
                result[t] = val

    # 1b. 6e-2-site: участок из зоны → code через fuzzy по тексту зоны
    site_from_zone = False
    for zone in zones or []:
        if zone.get("type") == "site":
            val = _extract_scalar(words, zone)
            if val:
                code = _find_site(val, sites or [])
                if code:
                    result["site"] = code
                    site_from_zone = True

    # 2. Samples
    samples_set: set = set()
    for m in _SAMPLE_RE.findall(full_text):
        fixed = _fix_ocr_digits(m)
        if not re.match(r"^[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ])?-?\d+$", fixed, re.IGNORECASE):
            continue
        fixed = _fix_prefix(fixed, vp)
        if vp and not _has_valid_prefix(fixed, vp):
            continue
        samples_set.add(fixed.upper())
    result["samples"] = sorted(samples_set)

    # 3. Wells
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

    # 4. Fallback: work_order_coded (только с валидным префиксом)
    if not result["work_order_coded"]:
        text_wo = full_text
        for s in result["samples"]:
            text_wo = text_wo.replace(s, " ")
            text_wo = text_wo.replace(s.lower(), " ")
        for m in _WORK_ORDER_RE.findall(text_wo):
            fixed = _fix_ocr_digits(m)
            if not re.match(r"^[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ])?-?\d+$", fixed, re.IGNORECASE):
                continue
            fixed = _fix_prefix(fixed, vp)
            if vp and not _has_valid_prefix(fixed, vp):
                continue
            fixed_upper = fixed.upper()
            if fixed_upper in samples_set:
                continue
            result["work_order_coded"] = fixed_upper
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
    has_zones_data = any(result[k] for k in scalar_types) or site_from_zone
    has_fallback = bool(
        result["samples"] or result["wells"] or result["work_order_coded"]
        or result["site"] or result["research_type"] or result["container_type"]
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