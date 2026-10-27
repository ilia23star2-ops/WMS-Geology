"""
Тесты сервисов приложения «Пробы».

Покрывает `sync_sample_status_for_container`:
- маппинг статусов тары → статусы проб (ACTIVE, PENDING_PLACEMENT,
  IN_TRANSIT);
- отсутствие маппинга для ISSUED (2f-9c: Sample.STATUS_ISSUED удалён,
  sync не трогает пробы);
- защита терминальных статусов (DISPOSED / CONSUMED / SELECTED);
- возвращаемое количество обновлений;
- поведение на неизвестном статусе тары.
"""

import pytest

from apps.samples.models import Sample
from apps.samples.services import sync_sample_status_for_container
from apps.samples.catalogs import ResearchType
from apps.storage.models import Container, ContainerType


# ─── Фикстуры ───────────────────────────────────────────────


@pytest.fixture
def research_type(db):
    """Тип исследования для проб."""
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def container_type(db):
    """Тип тары для контейнеров."""
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    """Тара без места, статус ACTIVE."""
    return Container.objects.create(
        container_number="T-001",
        container_type=container_type,
        status=Container.STATUS_ACTIVE,
    )


def _make_sample(container, research_type, number, status):
    """Хелпер: создать пробу с заданным статусом."""
    return Sample.objects.create(
        sample_number=number,
        research_type=research_type,
        container=container,
        status=status,
    )


# ─── Прямой маппинг статусов ────────────────────────────────


@pytest.mark.django_db
def test_active_container_sets_sample_in_storage(container, research_type):
    """ACTIVE тары → IN_STORAGE у пробы."""
    sample = _make_sample(container, research_type, "S-1", Sample.STATUS_PENDING_PLACEMENT)
    container.status = Container.STATUS_ACTIVE

    updated = sync_sample_status_for_container(container)

    sample.refresh_from_db()
    assert updated == 1
    assert sample.status == Sample.STATUS_IN_STORAGE


@pytest.mark.django_db
def test_pending_placement_container_sets_sample_pending_placement(
    container, research_type,
):
    """PENDING_PLACEMENT тары → PENDING_PLACEMENT у пробы."""
    sample = _make_sample(container, research_type, "S-2", Sample.STATUS_IN_STORAGE)
    container.status = Container.STATUS_PENDING_PLACEMENT

    updated = sync_sample_status_for_container(container)

    sample.refresh_from_db()
    assert updated == 1
    assert sample.status == Sample.STATUS_PENDING_PLACEMENT


@pytest.mark.django_db
def test_in_transit_container_sets_sample_in_transit(container, research_type):
    """IN_TRANSIT тары → IN_TRANSIT у пробы."""
    sample = _make_sample(container, research_type, "S-3", Sample.STATUS_IN_STORAGE)
    container.status = Container.STATUS_IN_TRANSIT

    updated = sync_sample_status_for_container(container)

    sample.refresh_from_db()
    assert updated == 1
    assert sample.status == Sample.STATUS_IN_TRANSIT


@pytest.mark.django_db
def test_issued_container_does_not_touch_sample(container, research_type):
    """
    ISSUED тары — маппинга нет (2f-9c), sync не обновляет пробы.
    Sample.STATUS_ISSUED удалён из модели.
    """
    sample = _make_sample(container, research_type, "S-4", Sample.STATUS_IN_STORAGE)
    container.status = Container.STATUS_ISSUED

    updated = sync_sample_status_for_container(container)

    sample.refresh_from_db()
    assert updated == 0
    assert sample.status == Sample.STATUS_IN_STORAGE


# ─── Защищённые статусы ─────────────────────────────────────


@pytest.mark.django_db
def test_disposed_sample_not_touched(container, research_type):
    """DISPOSED-проба не перезаписывается."""
    sample = _make_sample(container, research_type, "S-5", Sample.STATUS_DISPOSED)
    container.status = Container.STATUS_PENDING_PLACEMENT

    updated = sync_sample_status_for_container(container)

    sample.refresh_from_db()
    assert updated == 0
    assert sample.status == Sample.STATUS_DISPOSED


@pytest.mark.django_db
def test_consumed_sample_not_touched(container, research_type):
    """CONSUMED-проба не перезаписывается."""
    sample = _make_sample(container, research_type, "S-6", Sample.STATUS_CONSUMED)
    container.status = Container.STATUS_ACTIVE

    updated = sync_sample_status_for_container(container)

    sample.refresh_from_db()
    assert updated == 0
    assert sample.status == Sample.STATUS_CONSUMED


@pytest.mark.django_db
def test_selected_sample_not_touched(container, research_type):
    """SELECTED-проба не перезаписывается (2f-9b)."""
    sample = _make_sample(container, research_type, "S-7", Sample.STATUS_SELECTED)
    container.status = Container.STATUS_PENDING_PLACEMENT

    updated = sync_sample_status_for_container(container)

    sample.refresh_from_db()
    assert updated == 0
    assert sample.status == Sample.STATUS_SELECTED


# ─── Смешанные случаи ───────────────────────────────────────


@pytest.mark.django_db
def test_mixed_statuses_only_updates_non_protected(container, research_type):
    """Смесь: обычные пробы обновляются, защищённые — нет."""
    s1 = _make_sample(container, research_type, "S-8-1", Sample.STATUS_IN_STORAGE)
    s2 = _make_sample(container, research_type, "S-8-2", Sample.STATUS_DISPOSED)
    s3 = _make_sample(container, research_type, "S-8-3", Sample.STATUS_IN_STORAGE)

    container.status = Container.STATUS_PENDING_PLACEMENT
    updated = sync_sample_status_for_container(container)

    s1.refresh_from_db()
    s2.refresh_from_db()
    s3.refresh_from_db()
    assert updated == 2
    assert s1.status == Sample.STATUS_PENDING_PLACEMENT
    assert s2.status == Sample.STATUS_DISPOSED
    assert s3.status == Sample.STATUS_PENDING_PLACEMENT


@pytest.mark.django_db
def test_multiple_samples_all_updated(container, research_type):
    """Несколько обычных проб — все обновляются."""
    for i in range(1, 6):
        _make_sample(container, research_type, f"S-9-{i}", Sample.STATUS_IN_STORAGE)

    container.status = Container.STATUS_PENDING_PLACEMENT
    updated = sync_sample_status_for_container(container)

    assert updated == 5
    assert (
        Sample.objects.filter(
            container=container,
            status=Sample.STATUS_PENDING_PLACEMENT,
        ).count()
        == 5
    )


# ─── Крайние случаи ─────────────────────────────────────────


@pytest.mark.django_db
def test_empty_container_returns_zero(container):
    """Пустая тара → 0 обновлений."""
    container.status = Container.STATUS_PENDING_PLACEMENT

    updated = sync_sample_status_for_container(container)

    assert updated == 0


@pytest.mark.django_db
def test_unknown_container_status_returns_zero(container, research_type):
    """Неизвестный статус тары → 0, без исключений."""
    _make_sample(container, research_type, "S-10", Sample.STATUS_IN_STORAGE)
    container.status = "SOMETHING_WEIRD"

    updated = sync_sample_status_for_container(container)

    assert updated == 0


@pytest.mark.django_db
def test_returns_count_of_updated_samples(container, research_type):
    """Возвращает именно количество обновлённых строк."""
    _make_sample(container, research_type, "S-11-1", Sample.STATUS_IN_STORAGE)
    _make_sample(container, research_type, "S-11-2", Sample.STATUS_IN_STORAGE)
    _make_sample(container, research_type, "S-11-3", Sample.STATUS_DISPOSED)

    container.status = Container.STATUS_PENDING_PLACEMENT
    updated = sync_sample_status_for_container(container)

    assert updated == 2