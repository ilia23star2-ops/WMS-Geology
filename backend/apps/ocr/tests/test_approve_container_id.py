"""6e-2-web-a: container_id в reviewed_data — источник для кнопки «Открыть тару»."""
from unittest.mock import Mock, patch

import pytest

from apps.storage.models import Container


def _payload(container_type, research_type, site):
    return {
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


def _fake_fill(container, **kwargs):
    container.status = Container.STATUS_PENDING_PLACEMENT
    container.save(update_fields=['status'])
    return [Mock(), Mock()]


@pytest.mark.django_db
@patch('apps.ocr.services.approve.fill_container_with_samples')
def test_reviewed_data_has_container_id(
    mock_fill, api_client, ocr_task, container_type, research_type, site,
):
    mock_fill.side_effect = _fake_fill
    payload = _payload(container_type, research_type, site)

    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 200
    ocr_task.refresh_from_db()
    assert ocr_task.reviewed_data['container_id'] == resp.json()['container_id']


@pytest.mark.django_db
@patch('apps.ocr.services.approve.fill_container_with_samples')
def test_reviewed_data_keeps_payload_fields(
    mock_fill, api_client, ocr_task, container_type, research_type, site,
):
    mock_fill.side_effect = _fake_fill
    payload = _payload(container_type, research_type, site)

    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/approve/', payload, format='json',
    )

    assert resp.status_code == 200
    ocr_task.refresh_from_db()
    assert ocr_task.reviewed_data['container_number'] == 'T-001'
    assert ocr_task.reviewed_data['work_order_coded'] == 'TST0001'