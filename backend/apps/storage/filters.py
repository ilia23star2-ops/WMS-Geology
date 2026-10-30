"""
Фильтры для queryset'ов storage (c-6b).

Мобилка (c-6c) делает инкрементальный Pull: шлёт `updated_since` —
момент последнего Pull, бэкенд отдаёт только записи с
`updated_at > этого момента`.
"""

from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError


def apply_updated_since(qs, raw: str | None):
    """Применить фильтр `?updated_since=<ISO 8601>` к queryset.

    Требования:
    - ISO 8601, с таймзоной (UTC, суффикс Z или +00:00).
    - Naive datetime → 400 (Mobile всегда шлёт UTC).
    - Невалидный формат → 400.
    - Пусто / None → queryset без изменений (полный Pull).
    """
    if not raw:
        return qs

    dt = parse_datetime(raw)
    if dt is None:
        raise ValidationError(
            f"Неверный формат updated_since: {raw!r}. Ожидается ISO 8601."
        )
    if dt.tzinfo is None:
        raise ValidationError(
            "updated_since должен содержать таймзону (UTC, суффикс Z)."
        )
    return qs.filter(updated_at__gt=dt)