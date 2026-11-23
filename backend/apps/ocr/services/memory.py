"""Память исправлений OCR (6e-5-ocr-memory, решение 1.127).

Записывает подтверждённые оператором пары «сырой токен (канон) →
код справочника». Источник обучения — только approve (вариант 1А).
Учим лишь пары, где канон сырого токена отличается от подтверждённого
значения: точное совпадение канонизатор + резолвер закрывают сами,
память там избыточна. Номер тары и даты не учим.
"""
import logging

from django.utils import timezone

from apps.ocr.models import OcrMemoryEntry
from apps.ocr.services import canon

logger = logging.getLogger(__name__)

# zone_type → ключ в extracted
_ZONE_TO_EXTRACTED = {
    'site': 'site',
    'research_type': 'research_type',
    'work_order_coded': 'work_order_coded',
    'work_order_incoming': 'work_order_incoming',
}


def _confirmed_values(payload):
    """Подтверждённые коды справочников из approve-payload.

    site/research_type приходят как id — здесь резолвим в code.
    work_order_* — строки, берём как есть. Номер тары и даты
    намеренно не учим (решение 1.127).
    """
    from apps.samples.catalogs import Site, ResearchType

    confirmed = {}

    site_id = payload.get('site_id')
    if site_id:
        site = Site.objects.filter(pk=site_id).only('code').first()
        if site:
            confirmed['site'] = site.code

    rt_id = payload.get('research_type_id')
    if rt_id:
        rt = ResearchType.objects.filter(pk=rt_id).only('code').first()
        if rt:
            confirmed['research_type'] = rt.code

    if payload.get('work_order_coded'):
        confirmed['work_order_coded'] = str(payload['work_order_coded']).strip()
    if payload.get('work_order_incoming'):
        confirmed['work_order_incoming'] = str(payload['work_order_incoming']).strip()

    return confirmed


def learn_from_approve(task, payload, user=None):
    """Пишет в память подтверждённые исправления из task.raw_ocr_data.

    Возвращает число записанных/обновлённых пар. Не бросает исключений
    наружу по ключевым данным — но ошибки БД пробрасывает вызывающему,
    тот решает, критично ли (в approve обёрнуто в try/except).
    """
    extracted = (task.raw_ocr_data or {}).get('extracted') or {}
    confirmed = _confirmed_values(payload)
    learned = 0

    for zone_type, key in _ZONE_TO_EXTRACTED.items():
        raw = extracted.get(key)
        value = confirmed.get(zone_type)
        if not raw or not value:
            continue

        raw = str(raw).strip()
        value = str(value).strip()
        if not raw or not value:
            continue

        token = canon.canon_text(raw)
        if not token or token == value.upper():
            # Точное совпадение — резолвер уже справляется, память избыточна.
            continue

        entry, created = OcrMemoryEntry.objects.get_or_create(
            zone_type=zone_type,
            raw_token=token,
            defaults={'resolved_value': value, 'created_by': user},
        )
        entry.resolved_value = value
        entry.last_used_at = timezone.now()
        entry.save(update_fields=['resolved_value', 'last_used_at'])
        learned += 1

    return learned