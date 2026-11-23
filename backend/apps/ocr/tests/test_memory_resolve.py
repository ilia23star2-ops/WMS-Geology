"""Тесты чтения памяти исправлений в резолвере (6e-5-ocr-memory, заход 3)."""
import pytest

from apps.ocr.models import OcrMemoryEntry
from apps.ocr.views import _zone_verdicts
from apps.samples.catalogs import Site


@pytest.mark.django_db
def test_memory_resolves_unresolved_token():
    # Мусор, которого нет в справочнике, но есть пара в памяти.
    OcrMemoryEntry.objects.create(
        zone_type='site', raw_token='TST-X', resolved_value='TST',
    )
    verdicts = _zone_verdicts({'site': 'TST-X'})
    assert len(verdicts) == 1
    v = verdicts[0]
    assert v['resolved'] is True
    assert v['needs_input'] is False
    assert v['value'] == 'TST'
    assert v['reason'] == 'из памяти исправлений'


@pytest.mark.django_db
def test_memory_hit_increments_counter():
    entry = OcrMemoryEntry.objects.create(
        zone_type='site', raw_token='TST-X', resolved_value='TST',
    )
    _zone_verdicts({'site': 'TST-X'})
    entry.refresh_from_db()
    assert entry.hit_count == 1
    assert entry.last_used_at is not None


@pytest.mark.django_db
def test_live_catalog_wins_over_memory():
    # Живой справочник резолвит первым — память не трогаем.
    Site.objects.create(code='TST', name='Тестовый', is_active=True)
    OcrMemoryEntry.objects.create(
        zone_type='site', raw_token='TST', resolved_value='OTHER',
    )
    verdicts = _zone_verdicts({'site': 'TST'})
    v = verdicts[0]
    assert v['resolved'] is True
    assert v['value'] == 'TST'


@pytest.mark.django_db
def test_no_memory_still_needs_input():
    verdicts = _zone_verdicts({'site': 'QQQ'})
    v = verdicts[0]
    assert v['needs_input'] is True
    assert v['resolved'] is False