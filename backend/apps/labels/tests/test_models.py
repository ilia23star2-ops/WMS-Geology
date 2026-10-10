"""
Тесты моделей приложения labels: PrintBatch, PrintBatchItem.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db.models import ProtectedError

from apps.labels.models import PrintBatch, PrintBatchItem
from apps.storage.models import Container, ContainerType

User = get_user_model()


@pytest.fixture
def container_type(db):
    """Тип тары — общий."""
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    """Одна тара для тестов."""
    return Container.objects.create(
        container_number="T-001",
        container_type=container_type,
    )


@pytest.fixture
def batch(db):
    """Черновик партии печати."""
    return PrintBatch.objects.create(batch_number="ПЕЧ-2026-001")


@pytest.mark.django_db
def test_print_batch_default_status_draft(batch):
    """По умолчанию партия в статусе «Черновик»."""
    assert batch.status == PrintBatch.STATUS_DRAFT


@pytest.mark.django_db
def test_print_batch_default_print_type_labels(batch):
    """По умолчанию печатаются полные этикетки."""
    assert batch.print_type == PrintBatch.PRINT_TYPE_LABELS


@pytest.mark.django_db
def test_print_batch_default_counters_zero(batch):
    """Счётчики тар и страниц по умолчанию равны нулю."""
    assert batch.total_items == 0
    assert batch.total_pages == 0


@pytest.mark.django_db
def test_print_batch_str_returns_number(batch):
    """__str__ возвращает номер партии."""
    assert str(batch) == "ПЕЧ-2026-001"


@pytest.mark.django_db
def test_print_batch_number_unique(batch):
    """Номер партии уникален."""
    with pytest.raises(Exception):
        PrintBatch.objects.create(batch_number="ПЕЧ-2026-001")


@pytest.mark.django_db
def test_print_batch_item_position_default_zero(batch, container):
    """Позиция элемента по умолчанию — 0."""
    item = PrintBatchItem.objects.create(batch=batch, container=container)
    assert item.position == 0


@pytest.mark.django_db
def test_print_batch_item_unique_batch_container(batch, container):
    """Одна тара не может дважды попасть в одну партию."""
    PrintBatchItem.objects.create(batch=batch, container=container)
    with pytest.raises(Exception):
        PrintBatchItem.objects.create(batch=batch, container=container)


@pytest.mark.django_db
def test_print_batch_item_str(batch, container):
    """__str__ элемента — «номер партии / номер тары»."""
    item = PrintBatchItem.objects.create(batch=batch, container=container)
    assert str(item) == "ПЕЧ-2026-001 / T-001"


@pytest.mark.django_db
def test_container_protected_when_in_batch(batch, container):
    """Тару нельзя удалить, пока она в партии печати."""
    PrintBatchItem.objects.create(batch=batch, container=container)
    with pytest.raises(ProtectedError):
        container.delete()


@pytest.mark.django_db
def test_batch_cascade_deletes_items(batch, container):
    """Удаление партии уносит её элементы."""
    PrintBatchItem.objects.create(batch=batch, container=container)
    batch_id = batch.id
    batch.delete()
    assert PrintBatchItem.objects.filter(batch_id=batch_id).count() == 0
    # Тара осталась — PROTECT защищает её, но не от удаления партии.
    assert Container.objects.filter(pk=container.pk).exists()


@pytest.mark.django_db
def test_batch_created_by_set_null_on_user_delete(container):
    """При удалении пользователя партия остаётся, автор → NULL."""
    user = User.objects.create_user(username="tester", password="x")
    batch = PrintBatch.objects.create(
        batch_number="ПЕЧ-2026-002",
        created_by=user,
    )
    user.delete()
    batch.refresh_from_db()
    assert batch.created_by is None