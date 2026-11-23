"""Вердикты и память по Н/З (6e-5-ocr-memory-3b).

Регресс двух дефектов на стыке заходов 2 и 3:
- в БД есть Н/З → _zone_verdicts не падает (поле модели order_number, не number);
- Н/З текущий ищется по ключу extracted work_order_coded, поэтому память читается.
"""
import pytest

from apps.ocr.views import _zone_verdicts


@pytest.mark.django_db
def test_verdicts_survive_work_orders_in_db():
    from apps.work_orders.models import WorkOrder

    WorkOrder.objects.create(order_number="TST12345", order_type="CODED")
    verdicts = _zone_verdicts({"work_order_coded": "TST12345", "site": "QQQ"})
    coded = [v for v in verdicts if v["zone_type"] == "work_order_coded"]
    assert len(coded) == 1
    assert coded[0]["resolved"] is True
    assert coded[0]["needs_input"] is False
    assert coded[0]["value"] == "TST12345"


@pytest.mark.django_db
def test_memory_is_read_for_work_order_coded():
    from apps.ocr.models import OcrMemoryEntry
    from apps.ocr.services import canon

    OcrMemoryEntry.objects.create(
        zone_type='work_order_coded', raw_token=canon.canon_text('1STI3209'),
        resolved_value='TST13209',
    )
    verdicts = _zone_verdicts({'work_order_coded': '1STI3209'})
    assert len(verdicts) == 1
    v = verdicts[0]
    assert v['zone_type'] == 'work_order_coded'
    assert v['resolved'] is True and v['needs_input'] is False
    assert v['value'] == 'TST13209'
    assert v['reason'] == 'из памяти исправлений'