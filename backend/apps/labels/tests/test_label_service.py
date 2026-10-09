"""
Тесты сервиса рендера этикетки тары.

Покрывают:
- возврат PDF (BytesIO, сигнатура %PDF);
- раскладку (1 колонка / 2 колонки / обрезание);
- деление на колонки;
- сквозную нумерацию;
- работу с пустой тарой;
- работу с большим количеством проб;
- ошибку, если TTF-шрифт отсутствует.
"""

from io import BytesIO

import pytest

from apps.labels.services.label_service import (
    FONT_PATH,
    MAX_TWO_COLUMN,
    _calculate_layout,
    _number_samples,
    _split_into_columns,
    render_container_label,
)
from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType
from apps.work_orders.models import WorkOrder


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-001", container_type=container_type,
    )


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def site(db):
    return Site.objects.create(code="TST", name="Тестовый")


@pytest.fixture
def work_order(db):
    return WorkOrder.objects.create(
        order_number="A-100", order_type=WorkOrder.TYPE_INCOMING,
    )


@pytest.fixture
def samples(db, container, research_type, site, work_order):
    objs = []
    for i in range(1, 6):
        objs.append(Sample.objects.create(
            sample_number=f"TAA-{i:03d}",
            research_type=research_type,
            site=site,
            container=container,
            current_work_order=work_order,
        ))
    return objs


# ============================================================
# _calculate_layout
# ============================================================
def test_layout_small():
    """≤ 15 проб — 1 колонка, строка 4.5 мм."""
    columns, row_h, max_display = _calculate_layout(5)
    assert columns == 1
    assert row_h == 4.5
    assert max_display == 5

    columns, row_h, max_display = _calculate_layout(15)
    assert columns == 1
    assert max_display == 15


def test_layout_medium():
    """16–60 — 2 колонки, строка 2.4 мм."""
    columns, row_h, max_display = _calculate_layout(30)
    assert columns == 2
    assert row_h == 2.4
    assert max_display == 30

    columns, _, max_display = _calculate_layout(60)
    assert columns == 2
    assert max_display == 60


def test_layout_large():
    """> 60 — 2 колонки, обрезание до 60."""
    columns, _, max_display = _calculate_layout(100)
    assert columns == 2
    assert max_display == MAX_TWO_COLUMN


# ============================================================
# _split_into_columns
# ============================================================
def test_split_two_columns():
    items = list(range(10))
    result = _split_into_columns(items, 2)
    assert result == [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]]


def test_split_one_column():
    items = list(range(5))
    assert _split_into_columns(items, 1) == [[0, 1, 2, 3, 4]]


def test_split_empty():
    assert _split_into_columns([], 2) == [[], []]


def test_split_invalid_columns():
    with pytest.raises(ValueError):
        _split_into_columns([1, 2, 3], 0)


def test_split_uneven():
    """Нечётное количество — вторая колонка короче."""
    items = list(range(7))
    result = _split_into_columns(items, 2)
    assert result[0] == [0, 1, 2, 3]
    assert result[1] == [4, 5, 6]


# ============================================================
# _number_samples
# ============================================================
def test_number_samples_two_columns():
    columns = [["a", "b"], ["c", "d"]]
    result = _number_samples(columns)
    assert result == [
        [(1, "a"), (2, "b")],
        [(3, "c"), (4, "d")],
    ]


def test_number_samples_empty():
    assert _number_samples([[], []]) == [[], []]


# ============================================================
# render_container_label
# ============================================================
def test_font_present():
    """TTF-шрифт должен быть по ожидаемому пути."""
    assert FONT_PATH.exists(), (
        f"Шрифт не найден: {FONT_PATH}. "
        "Положи TTF (например, arial.ttf) в static/fonts/DejaVuSans.ttf."
    )


def test_render_returns_bytesio(db, container, samples):
    buf = render_container_label(container)
    assert isinstance(buf, BytesIO)


def test_render_returns_pdf_signature(db, container, samples):
    buf = render_container_label(container)
    data = buf.read()
    assert data[:4] == b"%PDF"


def test_render_empty_container(db, container):
    """Пустая тара (без проб) — PDF всё равно валидный."""
    buf = render_container_label(container)
    data = buf.read()
    assert data[:4] == b"%PDF"


def test_render_with_many_samples(
    db, container, research_type, site, work_order,
):
    """100 проб — рендер проходит без ошибок (обрезается до 60)."""
    for i in range(1, 101):
        Sample.objects.create(
            sample_number=f"TAA-{i:04d}",
            research_type=research_type,
            site=site,
            container=container,
            current_work_order=work_order,
        )
    buf = render_container_label(container)
    data = buf.read()
    assert data[:4] == b"%PDF"
    assert len(data) > 1000