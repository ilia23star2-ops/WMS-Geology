"""
Тесты автогенерации QR и PDF-рендера топологии (пачка 2f-4c-1).

Покрывают:
- `Section.save()` генерирует `qr_code`;
- `Cell.save()` генерирует `qr_code`;
- явно заданный `qr_code` не перезаписывается;
- `GET /storage/sections/{id}/qr.pdf/` → 200 + PDF;
- `GET /storage/cells/{id}/qr.pdf/` → 200 + PDF;
- `POST /storage/sections/qr-batch/` → 200 + PDF;
- ошибки batch (пустой список, несуществующий id, плохой type).
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storage.models import Cell, Rack, Room, Section, Tier

User = get_user_model()


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def user(db):
    return User.objects.create_user(username="qr-user", password="p")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def topology(db):
    room = Room.objects.create(name="Комната 1")
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    tier = Tier.objects.create(
        section=section, code="A", level_number=1,
    )
    cell = Cell.objects.create(
        tier=tier, code="1",
        full_address="Комната 1 / A / S1 / A / 1",
    )
    return {"room": room, "rack": rack, "section": section,
            "tier": tier, "cell": cell}


def _read_body(resp) -> bytes:
    chunks = []
    for chunk in resp.streaming_content:
        chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode())
    return b"".join(chunks)


# ============================================================
# Автогенерация qr_code
# ============================================================
@pytest.mark.django_db
def test_section_qr_auto_generated(topology):
    section = topology["section"]
    assert section.qr_code is not None
    assert section.qr_code.startswith("WMSG:SECTION:")
    assert str(section.pk) in section.qr_code


@pytest.mark.django_db
def test_cell_qr_auto_generated(topology):
    cell = topology["cell"]
    assert cell.qr_code is not None
    assert cell.qr_code.startswith("WMSG:CELL:")
    assert str(cell.pk) in cell.qr_code


@pytest.mark.django_db
def test_section_qr_not_overwritten_when_set_explicitly(db):
    room = Room.objects.create(name="Комната")
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(
        rack=rack, code="S1", qr_code="MY-CUSTOM-QR",
    )
    assert section.qr_code == "MY-CUSTOM-QR"


@pytest.mark.django_db
def test_cell_qr_not_overwritten_when_set_explicitly(topology):
    tier = topology["tier"]
    cell = Cell.objects.create(
        tier=tier, code="99",
        full_address="Комната 1 / A / S1 / A / 99",
        qr_code="MY-CUSTOM-CELL",
    )
    assert cell.qr_code == "MY-CUSTOM-CELL"


# ============================================================
# PDF: одиночный
# ============================================================
@pytest.mark.django_db
def test_section_qr_pdf_returns_pdf(api, topology):
    section = topology["section"]
    resp = api.get(f"/api/v1/storage/sections/{section.pk}/qr.pdf/")
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("application/pdf")
    body = _read_body(resp)
    assert body.startswith(b"%PDF")
    assert len(body) > 500


@pytest.mark.django_db
def test_cell_qr_pdf_returns_pdf(api, topology):
    cell = topology["cell"]
    resp = api.get(f"/api/v1/storage/cells/{cell.pk}/qr.pdf/")
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("application/pdf")
    body = _read_body(resp)
    assert body.startswith(b"%PDF")


# ============================================================
# PDF: batch
# ============================================================
@pytest.mark.django_db
def test_qr_batch_returns_pdf(api, topology):
    section = topology["section"]
    cell = topology["cell"]

    resp = api.post(
        "/api/v1/storage/sections/qr-batch/",
        {
            "items": [
                {"type": "SECTION", "id": section.pk},
                {"type": "CELL", "id": cell.pk},
            ],
        },
        format="json",
    )

    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("application/pdf")
    body = _read_body(resp)
    assert body.startswith(b"%PDF")


@pytest.mark.django_db
def test_qr_batch_empty_items_returns_400(api):
    resp = api.post(
        "/api/v1/storage/sections/qr-batch/",
        {"items": []},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_qr_batch_unknown_id_returns_404(api, topology):
    resp = api.post(
        "/api/v1/storage/sections/qr-batch/",
        {"items": [{"type": "SECTION", "id": 999999}]},
        format="json",
    )
    assert resp.status_code == 404


@pytest.mark.django_db
def test_qr_batch_unknown_type_returns_400(api, topology):
    section = topology["section"]
    resp = api.post(
        "/api/v1/storage/sections/qr-batch/",
        {"items": [{"type": "PALLET", "id": section.pk}]},
        format="json",
    )
    assert resp.status_code == 400