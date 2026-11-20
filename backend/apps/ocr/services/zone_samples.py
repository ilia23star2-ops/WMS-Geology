"""
Зонный отбор токенов проб (6e-2-web-7-backend).

Если на фото есть зоны типа sample — пробы берём ТОЛЬКО из них:
значение Н/З или номера тары, попавшее в общий текст, пробой не станет.
Без зон — прежний fallback по всему тексту (контракт не меняем).
Токены, равные скалярам (Н/З текущий/входящий, номер тары), исключаем всегда.
"""
import re

_SAMPLE_RE = re.compile(
    r"\b[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ])?-?[0-9OIl]{5,}\b",
    re.IGNORECASE,
)


def _center(bbox):
    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2


def _inside(word_bbox, zone_bbox):
    cx, cy = _center(word_bbox)
    xs = [p[0] for p in zone_bbox]
    ys = [p[1] for p in zone_bbox]
    return min(xs) <= cx <= max(xs) and min(ys) <= cy <= max(ys)


def sample_tokens(zones, words, full_text, result):
    """Сырые токены-кандидаты в пробы; валидацию делает mapping.extract_fields."""
    scalars = {
        (result.get("work_order_coded") or "").upper(),
        (result.get("work_order_incoming") or "").upper(),
        (result.get("container_number") or "").upper(),
    }
    scalars.discard("")

    sample_zones = [
        z for z in (zones or [])
        if z.get("type") == "sample" and len(z.get("bbox") or []) >= 4
    ]

    if sample_zones:
        raw = []
        for z in sample_zones:
            for w in words or []:
                wb = w.get("bbox") or []
                if len(wb) < 4:
                    continue
                if _inside(wb, z["bbox"]):
                    raw.append(w.get("text") or "")
    else:
        raw = _SAMPLE_RE.findall(full_text or "")

    out = []
    for tok in raw:
        clean = tok.strip().upper()
        if not clean or clean in scalars:
            continue
        out.append(tok)
    return out