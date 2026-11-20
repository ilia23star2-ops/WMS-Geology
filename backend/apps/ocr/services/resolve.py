"""Резолвер значений зон OCR по справочникам (решение 1.127).

Принимает тип зоны и сырой токен, канонизует его через canon.py и
ищет однозначное совпадение в справочнике, переданном вызывающим
кодом (queryset или список). Вердикты:
  resolved    — найдено однозначное значение справочника
  needs_input — не найдено или неоднозначно: нужен человек

Логика намеренно чистая (без импорта моделей): вызывающий код сам
передаёт справочник, поэтому резолвер тестируется без БД и может
переиспользоваться в approve и будущих клиентах без изменений.
"""
from __future__ import annotations

from dataclasses import dataclass

from apps.ocr.services import canon


@dataclass(frozen=True)
class ResolveResult:
    """Итог сопоставления токена зоны со справочником."""

    zone_type: str
    raw: str
    canonical: str
    value: str | None
    resolved: bool
    needs_input: bool
    reason: str = ""


def _miss(zone_type: str, raw: str, canonical: str, reason: str) -> ResolveResult:
    return ResolveResult(zone_type, raw, canonical, None, False, True, reason)


def resolve_by_code(
    zone_type: str,
    token: str,
    codes: tuple[str, ...] | list[str],
) -> ResolveResult:
    """Сопоставляет токен с кодом справочника (участок, тип исследования)."""
    c = canon.canon_text(token)
    c = canon.snap_prefix(c, tuple(codes))
    hits = [code for code in codes if code == c]
    if len(hits) == 1:
        return ResolveResult(zone_type, token, c, hits[0], True, False)
    if len(hits) > 1:
        return _miss(zone_type, token, c, "неоднозначно: несколько совпадений")
    return _miss(zone_type, token, c, "не найдено в справочнике")


def resolve_by_number(
    zone_type: str,
    token: str,
    numbers: tuple[str, ...] | list[str],
) -> ResolveResult:
    """Сопоставляет токен с номером (Н/З, тара): канонизация цифр + равенство."""
    c = canon.canon_text(token)
    digits = canon.fix_digits(c, after_prefix=False)
    hits = [n for n in numbers if n == digits or n == c]
    if len(hits) == 1:
        return ResolveResult(zone_type, token, digits, hits[0], True, False)
    if len(hits) > 1:
        return _miss(zone_type, token, digits, "неоднозначно: несколько совпадений")
    return _miss(zone_type, token, digits, "не найдено в справочнике")