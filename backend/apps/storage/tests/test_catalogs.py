"""
Тесты справочников приложения storage.

Покрывают ContainerComment.
"""

import pytest
from django.db import IntegrityError

from apps.storage.catalogs import ContainerComment


def test_container_comment_create(db):
    """ContainerComment создаётся."""
    cc = ContainerComment.objects.create(text="Повреждена")
    assert cc.pk is not None
    assert str(cc) == "Повреждена"
    assert cc.is_active is True


def test_container_comment_text_unique(db):
    """Одинаковый текст — ошибка."""
    ContainerComment.objects.create(text="Влажная")
    with pytest.raises(IntegrityError):
        ContainerComment.objects.create(text="Влажная")


def test_container_comment_ordering(db):
    """Сортировка: sort_order, потом text."""
    ContainerComment.objects.create(text="Влажная", sort_order=20)
    ContainerComment.objects.create(text="Повреждена", sort_order=10)
    texts = list(ContainerComment.objects.values_list("text", flat=True))
    assert texts == ["Повреждена", "Влажная"]


def test_container_comment_is_active_default(db):
    cc = ContainerComment.objects.create(text="Особая маркировка")
    assert cc.is_active is True