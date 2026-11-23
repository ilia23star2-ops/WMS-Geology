"""Тесты модели памяти исправлений OCR (6e-5-ocr-memory, заход 1)."""
import pytest
from django.db import IntegrityError, transaction

from apps.ocr.models import OcrMemoryEntry


@pytest.mark.django_db
def test_memory_entry_created_with_defaults():
    entry = OcrMemoryEntry.objects.create(
        zone_type='site', raw_token='TST', resolved_value='TST',
    )
    assert entry.pk is not None
    assert entry.hit_count == 0
    assert entry.created_by is None
    assert entry.last_used_at is None


@pytest.mark.django_db
def test_memory_entry_unique_zone_plus_raw():
    OcrMemoryEntry.objects.create(
        zone_type='site', raw_token='TST', resolved_value='TST',
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            OcrMemoryEntry.objects.create(
                zone_type='site', raw_token='TST', resolved_value='OTHER',
            )


@pytest.mark.django_db
def test_memory_entry_same_raw_different_zone_allowed():
    OcrMemoryEntry.objects.create(
        zone_type='site', raw_token='X1', resolved_value='A',
    )
    entry = OcrMemoryEntry.objects.create(
        zone_type='research_type', raw_token='X1', resolved_value='B',
    )
    assert entry.pk is not None


@pytest.mark.django_db
def test_memory_entry_str_contains_token_and_value():
    entry = OcrMemoryEntry(
        zone_type='site', raw_token='TST', resolved_value='TST',
    )
    text = str(entry)
    assert 'TST' in text