"""Тесты POST /api/v1/ocr/tasks/{id}/approve/."""
from unittest.mock import Mock, patch

import pytest

from apps.ocr.models import OcrTask
from apps.storage.models import Container


# Хелпер: стандартный валидный payload
def _payload(container_type, research_type, site, **overrides):
    base = {
        'container_number': 'T-001',
        'container_type_id': container_type.pk,
        'work_order_coded': 'TST0001',
        'work_order_incoming': '02-Тест001',
        'research_type_id': research_type.pk,
        'site_id': site.pk,
        'sample_groups': [
            {
                'prefix': 'TAA-A',
                'middle': '34076001',
                'sequence_from': 1,
                'sequence_to': 3,
                'sequence_digits': 3,
                'well_name': None,
                'status': 'NORMAL',
            },
        ],
    }
    base.update(overrides)
    return base


def _fake_fill(container, **kwargs):
    """Зеркалит реальное поведение fill_container_with_samples:
    переводит тару PENDING_FILLING → PENDING_PLACEMENT.

    Возвращает список Mock-проб (без создания Sample).
    """
    container.status = Container.STATUS_PENDING_PLACEMENT
    container.save(update_fields=['status'])
    return [Mock(), Mock()]


# -------------------- happy path --------------------

@pytest.mark.django_db
@patch('apps.ocr.services.approve.fill_container_with_samples')
def test_approve_no_cell(
    mock_fill, api_client, ocr_task, container_type, research_type, site,
):
    mock_fill.side_effect = _fake_fill
    payload = _payload(container_type, research_type, site)

    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body['samples_created'] == 2
    assert body['batch_completed'] is True

    container = Container.objects.get(pk=body['container_id'])
    assert container.status == Container.STATUS_PENDING_PLACEMENT
    assert container.container_number == 'T-001'
    assert container.container_type_id == container_type.pk

    ocr_task.refresh_from_db()
    assert ocr_task.status == 'DONE'
    assert ocr_task.reviewed_data['work_order_coded'] == 'TST0001'

    assert ocr_task.batch.status == 'COMPLETED'


@pytest.mark.django_db
@patch('apps.ocr.services.approve.bulk_place_containers')
@patch('apps.ocr.services.approve.fill_container_with_samples')
def test_approve_with_cell(
    mock_fill, mock_place, api_client, ocr_task,
    container_type, research_type, site,
):
    def fake_fill(container, **kwargs):
        container.status = Container.STATUS_PENDING_PLACEMENT
        container.save(update_fields=['status'])
        return [Mock()]

    mock_fill.side_effect = fake_fill

    def fake_place(container_ids, cell_id, floor_room_id, user):
        Container.objects.filter(pk__in=container_ids).update(
            status=Container.STATUS_ACTIVE,
        )
        return ({'message': 'ok'}, None)

    mock_place.side_effect = fake_place
    payload = _payload(container_type, research_type, site, cell_id=99)

    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 200
    container = Container.objects.get(pk=resp.json()['container_id'])
    assert container.status == Container.STATUS_ACTIVE
    mock_place.assert_called_once()
    call_kwargs = mock_place.call_args.kwargs
    assert call_kwargs['cell_id'] == 99


# -------------------- ошибки --------------------

@pytest.mark.django_db
def test_approve_already_done(api_client, ocr_task, container_type, research_type, site):
    ocr_task.status = 'DONE'
    ocr_task.save(update_fields=['status'])

    payload = _payload(container_type, research_type, site)
    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 400
    assert 'уже подтверждена' in resp.json()['error']


@pytest.mark.django_db
def test_approve_empty_sample_groups(
    api_client, ocr_task, container_type, research_type, site,
):
    payload = _payload(container_type, research_type, site, sample_groups=[])
    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 400
    assert 'sample_groups' in resp.json()


@pytest.mark.django_db
def test_approve_invalid_container_type(
    api_client, ocr_task, research_type, site,
):
    payload = _payload(
        container_type=Mock(pk=99999),
        research_type=research_type, site=site,
    )
    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 400
    assert 'Тип тары' in resp.json()['error']


@pytest.mark.django_db
def test_approve_missing_required_fields(api_client, ocr_task):
    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', {}, format='json',
    )

    assert resp.status_code == 400


@pytest.mark.django_db
def test_approve_unknown_task(api_client, container_type, research_type, site):
    payload = _payload(container_type, research_type, site)
    resp = api_client.post(
        '/api/v1/ocr/tasks/99999/approve/', payload, format='json',
    )

    assert resp.status_code == 404


# -------------------- batch completion --------------------

@pytest.mark.django_db
@patch('apps.ocr.services.approve.fill_container_with_samples')
def test_approve_two_tasks_second_stays_review(
    mock_fill, api_client, user, ocr_task, container_type, research_type, site,
):
    import base64
    from django.core.files.uploadedfile import SimpleUploadedFile
    from apps.ocr.models import OcrTask

    _png = base64.b64decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk'
        'YAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    )
    second_task = OcrTask.objects.create(
        batch=ocr_task.batch,
        image=SimpleUploadedFile('t2.png', _png, content_type='image/png'),
        status='READY',
    )
    mock_fill.side_effect = _fake_fill
    payload = _payload(container_type, research_type, site)

    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 200
    assert resp.json()['batch_completed'] is False
    ocr_task.batch.refresh_from_db()
    assert ocr_task.batch.status == 'REVIEW'
    second_task.refresh_from_db()
    assert second_task.status == 'READY'


# -------------------- интеграционный (без мока fill) --------------------

@pytest.mark.django_db
def test_approve_creates_real_samples(
    api_client, ocr_task, container_type, research_type, site,
):
    """Реальный вызов fill_container_with_samples → реальные Sample.

    Формат sample_number: {prefix}{middle}{sequence_digits:03d},
    напр. TAA-A + 34076001 + 001 = TAA-A34076001001.
    (См. ТД-80: DATABASE.md показывает другой пример с дефисами.)
    """
    from apps.samples.models import Sample

    payload = _payload(container_type, research_type, site)
    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body['samples_created'] == 3

    container = Container.objects.get(pk=body['container_id'])
    assert Sample.objects.filter(container=container).count() == 3
    numbers = sorted(
        Sample.objects.filter(container=container).values_list(
            'sample_number', flat=True,
        )
    )
    assert numbers == [
        'TAA-A34076001001',
        'TAA-A34076001002',
        'TAA-A34076001003',
    ]