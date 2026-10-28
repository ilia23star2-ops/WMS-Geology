"""
Тесты моделей приложения storage (v6).

Покрывают:
- топологию;
- Pallet (OneToOne, XOR);
- ContainerType (laboratory, unique (name, laboratory));
- Container (comment, PENDING_PLACEMENT);
- updated_at на Pallet и Container (3.x-offline-sync-b-1a).

`Container.container_number` — **не уникален глобально**
(см. DECISIONS 1.61, пачка 3d-3-fix-2). Семантика: номер — метка
внутри группы (Н/З × ТИ), идентификатор — `id`.

`Section.qr_code` и `Cell.qr_code` — **автогенерируются при
создании** (пачка 2f-4c-1), если не заданы явно.
"""

import time

import pytest
from django.db import IntegrityError
from django.db.models import ProtectedError

from apps.samples.catalogs import Laboratory
from apps.storage.catalogs import ContainerComment
from apps.storage.models import (
    Cell,
    Container,
    ContainerType,
    Pallet,
    Rack,
    Room,
    Section,
    Tier,
)


@pytest.fixture
def room(db):
    return Room.objects.create(name="Комната 1")


@pytest.fixture
def full_topology(db, room):
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    tier = Tier.objects.create(section=section, code="A", level_number=1)
    cell = Cell.objects.create(
        tier=tier, code="1", full_address="Комната 1 / A / S1 / A / 1",
    )
    return {"room": room, "rack": rack, "section": section, "tier": tier, "cell": cell}


@pytest.fixture
def laboratory(db):
    return Laboratory.objects.create(code="ЛАБ-1", name="Лаборатория 1")


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(
        name="Коробка малая", size_class="S", max_on_standard_pallet=10,
    )


@pytest.fixture
def container_comment(db):
    return ContainerComment.objects.create(text="Повреждена")


# ============================================================
# Room, Rack, Section, Tier, Cell
# ============================================================
def test_room_str(db):
    r = Room.objects.create(name="Склад А")
    assert str(r) == "Склад А"


def test_rack_unique_code_in_room(db, room):
    Rack.objects.create(room=room, code="A")
    with pytest.raises(IntegrityError):
        Rack.objects.create(room=room, code="A")


def test_section_qr_code_unique(db, room):
    rack = Rack.objects.create(room=room, code="A")
    Section.objects.create(rack=rack, code="S1", qr_code="WMSG:SECTION:1")
    with pytest.raises(IntegrityError):
        Section.objects.create(rack=rack, code="S2", qr_code="WMSG:SECTION:1")


def test_section_qr_code_auto_generated(db, room):
    """QR секции автогенерируется при создании (2f-4c-1)."""
    rack = Rack.objects.create(room=room, code="A")
    s1 = Section.objects.create(rack=rack, code="S1")
    s2 = Section.objects.create(rack=rack, code="S2")
    assert s1.qr_code is not None
    assert s2.qr_code is not None
    assert s1.qr_code != s2.qr_code
    assert s1.qr_code.startswith("WMSG:SECTION:")


def test_tier_codes_a_d(db, room):
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    for code, level in [("A", 1), ("B", 2), ("C", 3), ("D", 4)]:
        Tier.objects.create(section=section, code=code, level_number=level)
    assert Tier.objects.filter(section=section).count() == 4


def test_tier_unique_code_within_section(db, full_topology):
    section = full_topology["section"]
    with pytest.raises(IntegrityError):
        Tier.objects.create(section=section, code="A", level_number=1)


def test_cell_unique_code_within_tier(db, full_topology):
    tier = full_topology["tier"]
    with pytest.raises(IntegrityError):
        Cell.objects.create(
            tier=tier, code="1", full_address="Другой адрес",
        )


def test_cell_full_address_unique(db, full_topology):
    tier = full_topology["tier"]
    addr = full_topology["cell"].full_address
    with pytest.raises(IntegrityError):
        Cell.objects.create(tier=tier, code="2", full_address=addr)


def test_cell_default_type_standard(db, full_topology):
    cell = full_topology["cell"]
    assert cell.cell_type == "STANDARD"


def test_cell_qr_code_auto_generated(db, full_topology):
    """QR ячейки автогенерируется при создании (2f-4c-1)."""
    cell = full_topology["cell"]
    assert cell.qr_code is not None
    assert cell.qr_code.startswith("WMSG:CELL:")
    assert str(cell.pk) in cell.qr_code


def test_cell_qr_code_unique(db, full_topology):
    tier_a = full_topology["tier"]
    section = full_topology["section"]
    tier_b = Tier.objects.create(section=section, code="B", level_number=2)

    Cell.objects.create(
        tier=tier_a, code="2", full_address="Адрес A",
        qr_code="WMSG:CELL:1",
    )
    with pytest.raises(IntegrityError):
        Cell.objects.create(
            tier=tier_b, code="3", full_address="Адрес B",
            qr_code="WMSG:CELL:1",
        )


# ============================================================
# ContainerComment
# ============================================================
def test_container_comment_unique_text(db):
    ContainerComment.objects.create(text="Повреждена")
    with pytest.raises(IntegrityError):
        ContainerComment.objects.create(text="Повреждена")


# ============================================================
# ContainerType
# ============================================================
def test_container_type_default_max(db):
    ct = ContainerType.objects.create(name="Коробка")
    assert ct.max_on_standard_pallet == 10
    assert ct.is_core is False


def test_container_type_laboratory_null_by_default(db):
    """Общий тип — laboratory=None."""
    ct = ContainerType.objects.create(name="Коробка")
    assert ct.laboratory is None


def test_container_type_str_common(db):
    ct = ContainerType.objects.create(name="Коробка")
    assert "общий" in str(ct)


def test_container_type_str_with_lab(db, laboratory):
    ct = ContainerType.objects.create(name="Коробка", laboratory=laboratory)
    text = str(ct)
    assert "Коробка" in text
    assert "ЛАБ-1" in text


def test_container_type_unique_name_per_lab(db, laboratory):
    """Один и тот же name у разных лабораторий — допустимо."""
    ContainerType.objects.create(name="Коробка", laboratory=laboratory)
    other_lab = Laboratory.objects.create(code="ЛАБ-2", name="Лаборатория 2")
    ct2 = ContainerType.objects.create(name="Коробка", laboratory=other_lab)
    assert ct2.pk is not None


def test_container_type_same_name_lab_raises(db, laboratory):
    """Дубликат (name, laboratory) — ошибка."""
    ContainerType.objects.create(name="Коробка", laboratory=laboratory)
    with pytest.raises(IntegrityError):
        ContainerType.objects.create(name="Коробка", laboratory=laboratory)


def test_container_type_common_and_lab_can_coexist(db, laboratory):
    """Общий тип + тип лаборатории с тем же name — допустимо."""
    ContainerType.objects.create(name="Коробка")  # общий
    ct = ContainerType.objects.create(name="Коробка", laboratory=laboratory)
    assert ct.pk is not None


def test_container_type_laboratory_cascade(db, laboratory):
    """Удаление лаборатории каскадно удаляет её типы тары."""
    ContainerType.objects.create(name="Коробка", laboratory=laboratory)
    ContainerType.objects.create(name="Общий тип")  # общий — не удалится
    pk = laboratory.pk
    laboratory.delete()
    assert ContainerType.objects.filter(laboratory_id=pk).count() == 0
    assert ContainerType.objects.filter(laboratory__isnull=True).count() == 1


# ============================================================
# Pallet
# ============================================================
def test_pallet_in_cell_valid(db, full_topology):
    cell = full_topology["cell"]
    p = Pallet.objects.create(cell=cell)
    assert p.pk is not None


def test_pallet_one_to_one_cell_raises(db, full_topology):
    cell = full_topology["cell"]
    Pallet.objects.create(cell=cell)
    with pytest.raises(IntegrityError):
        Pallet.objects.create(cell=cell)


def test_pallet_on_floor_valid(db, room):
    p = Pallet.objects.create(floor_room=room)
    assert p.pk is not None


def test_pallet_on_cell_and_floor_raises(db, full_topology):
    cell = full_topology["cell"]
    room = full_topology["room"]
    with pytest.raises(IntegrityError):
        Pallet.objects.create(cell=cell, floor_room=room)


def test_pallet_in_transit_valid(db):
    p = Pallet.objects.create()
    assert p.pk is not None
    assert p.cell is None
    assert p.floor_room is None


def test_pallet_default_type_standard(db):
    p = Pallet.objects.create()
    assert p.pallet_type == "STANDARD"


def test_pallet_capacity_override_jsonb(db):
    p = Pallet.objects.create(capacity_override={"1": 15, "2": 6})
    p.refresh_from_db()
    assert p.capacity_override["1"] == 15


# ============================================================
# Container
# ============================================================
def test_container_on_pallet_valid(db, container_type):
    p = Pallet.objects.create()
    c = Container.objects.create(
        container_number="T-001", container_type=container_type, pallet=p,
    )
    assert c.pk is not None


def test_container_on_floor_valid(db, room, container_type):
    c = Container.objects.create(
        container_number="T-002", container_type=container_type, floor_room=room,
    )
    assert c.pk is not None


def test_container_in_transit_valid(db, container_type):
    c = Container.objects.create(
        container_number="T-003", container_type=container_type,
    )
    assert c.pk is not None


def test_container_on_pallet_and_floor_raises(db, room, container_type):
    p = Pallet.objects.create()
    with pytest.raises(IntegrityError):
        Container.objects.create(
            container_number="T-004", container_type=container_type,
            pallet=p, floor_room=room,
        )


def test_container_number_duplicate_allowed(db, container_type):
    """
    `container_number` **не уникален глобально** (DECISIONS 1.61).

    Семантика: номер — метка внутри группы (Н/З × ТИ).
    Идентификатор — `id` (QR: `WMSG:CONTAINER:<id>`).
    """
    Container.objects.create(
        container_number="1", container_type=container_type,
    )
    c2 = Container.objects.create(
        container_number="1", container_type=container_type,
    )
    assert c2.pk is not None
    assert Container.objects.filter(container_number="1").count() == 2


def test_container_type_protected_from_delete(db, container_type):
    Container.objects.create(
        container_number="T-006", container_type=container_type,
    )
    with pytest.raises(ProtectedError):
        container_type.delete()


def test_container_status_pending_placement_valid(db, container_type):
    c = Container.objects.create(
        container_number="T-100",
        container_type=container_type,
        status=Container.STATUS_PENDING_PLACEMENT,
    )
    assert c.status == "PENDING_PLACEMENT"
    assert c.get_status_display() == "Ожидает размещения"


def test_container_comment_default_empty(db, container_type):
    c = Container.objects.create(
        container_number="T-101", container_type=container_type,
    )
    assert c.comment == ""
    assert c.comment_template is None


def test_container_comment_template_link(db, container_type, container_comment):
    c = Container.objects.create(
        container_number="T-103",
        container_type=container_type,
        comment_template=container_comment,
    )
    assert c.comment_template.text == "Повреждена"


def test_container_comment_template_set_null(
    db, container_type, container_comment,
):
    c = Container.objects.create(
        container_number="T-104",
        container_type=container_type,
        comment_template=container_comment,
    )
    container_comment.delete()
    c.refresh_from_db()
    assert c.comment_template is None


# ============================================================
# updated_at (3.x-offline-sync-b-1a)
# ============================================================
def test_container_updated_at_changes_on_save(db, container_type):
    """`Container.updated_at` обновляется при каждом `.save()`."""
    c = Container.objects.create(
        container_number="T-UPD-1", container_type=container_type,
    )
    before = c.updated_at
    time.sleep(0.01)
    c.comment = "изменено"
    c.save()
    c.refresh_from_db()
    assert c.updated_at > before


def test_pallet_updated_at_changes_on_save(db):
    """`Pallet.updated_at` обновляется при каждом `.save()`."""
    p = Pallet.objects.create()
    before = p.updated_at
    time.sleep(0.01)
    p.capacity_override = {"1": 20}
    p.save()
    p.refresh_from_db()
    assert p.updated_at > before