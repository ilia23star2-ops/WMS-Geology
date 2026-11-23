"""Тесты обучения памяти исправлений в approve (6e-5-ocr-memory, заход 2)."""
import pytest
from django.contrib.auth import get_user_model

from apps.ocr.models import OcrMemoryEntry
from apps.ocr.services.memory import learn_from_approve
from apps.samples.catalogs import Site


class _Task:
    """Минимальная замена OcrTask: нужен только raw_ocr_data."""

    def __init__(self, extracted):
        self.pk = 1
        self.raw_ocr_data = {'extracted': extracted}


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username='mem', password='p')


@pytest.mark.django_db
def test_learn_writes_corrected_site(user):
    # OCR прочитал «ТЗТ-Х» (канон TST-X), оператор подтвердил TST → пара.
    site = Site.objects.create(code='TST', name='Тестовый', is_active=True)
    task = _Task({'site': 'ТЗТ-Х'})
    payload = {'site_id': site.pk, 'work_order_coded': ''}
    n = learn_from_approve(task, payload, user)
    assert n == 1
    entry = OcrMemoryEntry.objects.get(zone_type='site')
    assert entry.resolved_value == 'TST'
    assert entry.created_by == user


@pytest.mark.django_db
def test_learn_skips_when_canonical_matches(user):
    # canon_text('ТЗТ') == 'TST' — резолвер сам закрывает, учить нечего.
    site = Site.objects.create(code='TST', name='Тестовый', is_active=True)
    task = _Task({'site': 'ТЗТ'})
    payload = {'site_id': site.pk, 'work_order_coded': ''}
    n = learn_from_approve(task, payload, user)
    assert n == 0
    assert OcrMemoryEntry.objects.count() == 0


@pytest.mark.django_db
def test_learn_writes_work_order_coded(user):
    task = _Task({'work_order_coded': '132O9'})
    payload = {'work_order_coded': '13209', 'work_order_incoming': ''}
    n = learn_from_approve(task, payload, user)
    assert n == 1
    entry = OcrMemoryEntry.objects.get(zone_type='work_order_coded')
    assert entry.resolved_value == '13209'


@pytest.mark.django_db
def test_learn_skips_empty_raw_or_value(user):
    task = _Task({'site': None, 'work_order_coded': ''})
    payload = {'work_order_coded': '', 'work_order_incoming': ''}
    n = learn_from_approve(task, payload, user)
    assert n == 0


@pytest.mark.django_db
def test_learn_updates_existing_without_duplicate(user):
    task = _Task({'work_order_coded': '132O9'})
    payload = {'work_order_coded': '13209', 'work_order_incoming': ''}
    learn_from_approve(task, payload, user)
    learn_from_approve(task, payload, user)
    assert OcrMemoryEntry.objects.filter(zone_type='work_order_coded').count() == 1