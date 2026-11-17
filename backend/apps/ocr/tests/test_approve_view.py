"""Тесты POST /api/v1/ocr/tasks/{id}/approve/.

c-5a: базовые.
c-6f-1: approve с `batch.cell_id` (мобилка) → Pallet + ACTIVE;
  приоритет payload.cell_id > batch.cell_id.
"""
from unittest.mock import Mock, patch

import pytest

from apps.ocr.models import OcrTask
from apps.storage.models import Cell, Container, Room, Rack, Section, Tier


def _make_cell(db, suffix: str = "1"):
    """Создать минимальную цепочку Room→Rack→Section→Tier→Cell.

    `full_address` — unique, задаём явно (нет autosave в тестах).
    """
    room = Room.objects.create(name=f"Комната {suffix}")
    rack = Rack.objects.create(room=room, code=f"R{suffix}")
    section = Section.objects.create(rack=rack, code=suffix)
    tier = Tier.objects.create(section=section, code="A")
    return Cell.objects.create(
        tier=tier,
        code=suffix,
        full_address=f"Комната {suffix} / R{suffix} / {suffix} / A / {suffix}",
    )


@pytest.fixture
def cell(db):
    return _make_cell(db, "1")


@pytest.fixture
def cell2(db):
    return _make_cell(db, "2")


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
    container.status = Container.STATUS_PENDING_PLACEMENT
    container.save(update_fields=['status'])
    return [Mock(), Mock()]


# -------------------- happy path: без cell --------------------

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

    ocr_task.refresh_from_db()
    assert ocr_task.status == 'DONE'
    assert ocr_task.batch.status == 'COMPLETED'


# -------------------- с batch.cell_id (мобилка) --------------------

@pytest.mark.django_db
@patch('apps.ocr.services.approve.bulk_place_containers')
@patch('apps.ocr.services.approve.fill_container_with_samples')
def test_approve_with_batch_cell(
    mock_fill, mock_place, api_client, ocr_task, user, cell,
    container_type, research_type, site,
):
    """c-6f-1: batch.cell_id задан → Container ACTIVE + Pallet (bulk_place)."""
    ocr_task.batch.cell = cell
    ocr_task.batch.save(update_fields=['cell'])

    mock_fill.side_effect = _fake_fill

    def fake_place(container_ids, cell_id, floor_room_id, user):
        Container.objects.filter(pk__in=container_ids).update(
            status=Container.STATUS_ACTIVE,
        )
        return ({'message': 'ok'}, None)

    mock_place.side_effect = fake_place
    payload = _payload(container_type, research_type, site)

    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 200
    container = Container.objects.get(pk=resp.json()['container_id'])
    assert container.status == Container.STATUS_ACTIVE
    mock_place.assert_called_once()
    assert mock_place.call_args.kwargs['cell_id'] == cell.pk


# -------------------- приоритет payload.cell_id --------------------

@pytest.mark.django_db
@patch('apps.ocr.services.approve.bulk_place_containers')
@patch('apps.ocr.services.approve.fill_container_with_samples')
def test_approve_payload_cell_overrides_batch(
    mock_fill, mock_place, api_client, ocr_task, user, cell, cell2,
    container_type, research_type, site,
):
    """c-6f-1: payload.cell_id > batch.cell_id."""
    ocr_task.batch.cell = cell
    ocr_task.batch.save(update_fields=['cell'])

    mock_fill.side_effect = _fake_fill

    def fake_place(container_ids, cell_id, floor_room_id, user):
        Container.objects.filter(pk__in=container_ids).update(
            status=Container.STATUS_ACTIVE,
        )
        return ({'message': 'ok'}, None)

    mock_place.side_effect = fake_place
    payload = _payload(container_type, research_type, site, cell_id=cell2.pk)

    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 200
    # payload.cell_id (cell2) приоритет > batch.cell (cell)
    assert mock_place.call_args.kwargs['cell_id'] == cell2.pk
    assert mock_place.call_args.kwargs['cell_id'] != cell.pk


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
    from apps.ocr.models import OcrTask as _OcrTask

    _png = base64.b64decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk'
        'YAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    )
    second_task = _OcrTask.objects.create(
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


# -------------------- интеграционный --------------------

@pytest.mark.django_db
def test_approve_creates_real_samples(
    api_client, ocr_task, container_type, research_type, site,
):
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