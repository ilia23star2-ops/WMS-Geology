"""
Тесты справочников приложения samples.

Покрывают:
- ResearchType: код уникален, ordering, __str__, is_active.
- Site: код уникален, match_patterns (JSONB), ordering.
- Laboratory: код уникален, prefixes (JSONB), ordering.
"""

import pytest
from django.db import IntegrityError

from apps.samples.catalogs import Laboratory, ResearchType, Site


# ============================================================
# ResearchType
# ============================================================
def test_research_type_create(db):
    """ResearchType создаётся, __str__ содержит код и имя."""
    rt = ResearchType.objects.create(code="ШЛ", name="Шлифы")
    assert rt.pk is not None
    assert "ШЛ" in str(rt)
    assert "Шлифы" in str(rt)
    assert rt.is_active is True


def test_research_type_code_unique(db):
    """Одинаковый код — ошибка."""
    ResearchType.objects.create(code="ШЛ", name="Шлифы")
    with pytest.raises(IntegrityError):
        ResearchType.objects.create(code="ШЛ", name="Другое")


def test_research_type_ordering_by_sort_order_then_code(db):
    """Сортировка: sort_order, потом code (по правилам локали БД)."""
    ResearchType.objects.create(code="ХА", name="Хим", sort_order=50)
    ResearchType.objects.create(code="ШЛ", name="Шлифы", sort_order=10)
    ResearchType.objects.create(code="ИЗ", name="Изотопы", sort_order=50)

    # sort_order: ШЛ=10, ХА=50, ИЗ=50.
    # При равном sort_order сортировка по code. В кириллице
    # «И» < «Х», поэтому ИЗ идёт перед ХА.
    codes = list(ResearchType.objects.values_list("code", flat=True))
    assert codes == ["ШЛ", "ИЗ", "ХА"]


def test_research_type_is_active_default(db):
    """По умолчанию is_active=True."""
    rt = ResearchType.objects.create(code="ШЛ", name="Шлифы")
    assert rt.is_active is True


# ============================================================
# Site
# ============================================================
def test_site_create_with_patterns(db):
    """Site создаётся с паттернами JSONB."""
    site = Site.objects.create(
        code="TST",
        name="Тестовый",
        match_patterns=["TST", "Тест"],
    )
    site.refresh_from_db()
    assert site.pk is not None
    assert site.match_patterns == ["TST", "Тест"]


def test_site_code_unique(db):
    Site.objects.create(code="TST", name="Тестовый")
    with pytest.raises(IntegrityError):
        Site.objects.create(code="TST", name="Другой")


def test_site_empty_patterns_allowed(db):
    """Пустой список паттернов — допустимо."""
    site = Site.objects.create(code="XXX", name="Без паттернов")
    assert site.match_patterns == []


def test_site_ordering(db):
    Site.objects.create(code="СЕВ", name="Северный", sort_order=20)
    Site.objects.create(code="TST", name="Тестовый", sort_order=10)
    codes = list(Site.objects.values_list("code", flat=True))
    assert codes == ["TST", "СЕВ"]


# ============================================================
# Laboratory
# ============================================================
def test_laboratory_create_with_prefixes(db):
    lab = Laboratory.objects.create(
        code="ЛАБ-1",
        name="Лаборатория 1",
        prefixes=["TAA-A", "TAA-B"],
    )
    lab.refresh_from_db()
    assert lab.pk is not None
    assert lab.prefixes == ["TAA-A", "TAA-B"]


def test_laboratory_code_unique(db):
    Laboratory.objects.create(code="ЛАБ-1", name="Лаб 1")
    with pytest.raises(IntegrityError):
        Laboratory.objects.create(code="ЛАБ-1", name="Другая")


def test_laboratory_empty_prefixes_allowed(db):
    lab = Laboratory.objects.create(code="ЛАБ-2", name="Лаб 2")
    assert lab.prefixes == []


def test_laboratory_str_contains_code_and_name(db):
    lab = Laboratory.objects.create(code="ЛАБ-1", name="Лаборатория 1")
    text = str(lab)
    assert "ЛАБ-1" in text
    assert "Лаборатория 1" in text