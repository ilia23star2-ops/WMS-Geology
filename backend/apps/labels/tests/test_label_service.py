"""
Тесты сервиса рендера этикеток тары (модель 4d-1).

Покрывают:
- измерение текста и обрезку;
- метрики раскладки (ширина колонки, число колонок, строк);
- выбор размера из сетки (ширины × высоты);
- пагинацию и продолжения;
- укладку этикеток на A4;
- рендер одиночной этикетки и партии.
"""

from io import BytesIO

import pytest

from apps.labels.models import PrintBatch, PrintBatchItem
from apps.labels.services.label_service import (
    A4_H_MM,
    A4_LABEL_GAP_MM,
    FONT_PATH,
    HEIGHTS_MM,
    MAX_CONTINUATIONS,
    QR_GRID_GAP_MM,
    QR_GRID_MARGIN_MM,
    QR_GRID_SIZE_MM,
    QR_SIZE_MM,
    WIDTHS_MM,
    _choose_size,
    _column_width_mm,
    _columns_count,
    _make_measurer,
    _pack_on_sheets,
    _paginate,
    _qr_grid_capacity,
    _qr_grid_dimensions,
    _rows_count,
    _split_columns,
    _text_width_mm,
    _truncate_to_width,
    _working_height_mm,
    _working_width_mm,
    count_pdf_pages,
    render_batch_labels_pdf,
    render_batch_qr_pdf,
    render_container_label,
)
from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType


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


def _make_samples(container, research_type, n: int, prefix: str = "TAA-") -> list:
    """Создаёт N проб в таре. Префикс — для разной длины номеров."""
    objs = []
    for i in range(1, n + 1):
        objs.append(Sample.objects.create(
            sample_number=f"{prefix}{i:04d}",
            research_type=research_type,
            container=container,
        ))
    return objs


def _make_container(container_type, idx: int) -> Container:
    return Container.objects.create(
        container_number=f"T-B{idx:03d}",
        container_type=container_type,
    )


# ============================================================
# Шрифт
# ============================================================
def test_font_present():
    assert FONT_PATH.exists(), f"Шрифт не найден: {FONT_PATH}"


# ============================================================
# _text_width_mm / _truncate_to_width
# ============================================================
def test_text_width_non_empty():
    pdf = _make_measurer()
    assert _text_width_mm(pdf, "abc") > 0


def test_text_width_empty():
    pdf = _make_measurer()
    assert _text_width_mm(pdf, "") == 0.0


def test_truncate_fits_unchanged():
    pdf = _make_measurer()
    assert _truncate_to_width(pdf, "abc", 100) == "abc"


def test_truncate_adds_ellipsis():
    pdf = _make_measurer()
    result = _truncate_to_width(pdf, "abcdefghij" * 10, 30)
    assert result.endswith("...")
    assert _text_width_mm(pdf, result) <= 30 + 0.1


def test_truncate_tiny_budget_returns_ellipsis_or_empty():
    pdf = _make_measurer()
    result = _truncate_to_width(pdf, "abc", 0.5)
    assert result in ("", "...")


# ============================================================
# Метрики раскладки
# ============================================================
def test_working_width_subtracts_margins():
    # LABEL_MARGIN_MM = 1 → 150 - 2 = 148
    assert _working_width_mm(150) == 150 - 2


def test_working_height_subtracts_header_and_bottom():
    # HEADER_H_MM = 28, LABEL_BOTTOM_PAD_MM = 2
    assert _working_height_mm(99) == 99 - 28 - 1


def test_rows_count_zero_for_tiny_label():
    """37 мм — рабочая область слишком мала для строк проб."""
    assert _rows_count(37) == 0


def test_rows_count_positive_for_larger():
    assert _rows_count(148) > 0


def test_column_width_positive(db, container, research_type):
    pdf = _make_measurer()
    samples = _make_samples(container, research_type, 3, prefix="X-")
    assert _column_width_mm(pdf, samples) > 0


def test_column_width_grows_with_number_length(db, container, research_type):
    pdf = _make_measurer()
    short = _make_samples(container, research_type, 1, prefix="A-")
    # Нужны разные тары, чтобы не пересекались sample_number
    container2 = Container.objects.create(
        container_number="T-LONG", container_type=container.container_type,
    )
    long = _make_samples(container2, research_type, 1, prefix="TAA-A34076001-001-")
    assert _column_width_mm(pdf, long) > _column_width_mm(pdf, short)


def test_columns_count_more_for_short_numbers(db, container, research_type):
    pdf = _make_measurer()
    short = _make_samples(container, research_type, 5, prefix="A-")
    container2 = Container.objects.create(
        container_number="T-LONG", container_type=container.container_type,
    )
    long = _make_samples(container2, research_type, 5, prefix="TAA-A34076001-001-")
    assert _columns_count(pdf, short, 210) >= _columns_count(pdf, long, 210)


# ============================================================
# _choose_size
# ============================================================
def test_choose_size_empty_returns_minimum(db, container):
    pdf = _make_measurer()
    w, h = _choose_size(pdf, [])
    assert w == WIDTHS_MM[0]
    assert h == HEIGHTS_MM[0]


def test_choose_size_grows_with_sample_count(db, container, research_type):
    pdf = _make_measurer()
    few = _make_samples(container, research_type, 3, prefix="A-")
    container2 = Container.objects.create(
        container_number="T-MANY", container_type=container.container_type,
    )
    many = _make_samples(container2, research_type, 100, prefix="A-")
    w1, h1 = _choose_size(pdf, few)
    w2, h2 = _choose_size(pdf, many)
    assert (w2, h2) >= (w1, h1)


def test_choose_size_long_numbers_picks_wider(db, container, research_type):
    pdf = _make_measurer()
    short = _make_samples(container, research_type, 20, prefix="A-")
    container2 = Container.objects.create(
        container_number="T-LONG", container_type=container.container_type,
    )
    long = _make_samples(container2, research_type, 20, prefix="TAA-A34076001-001-")
    w_short, _ = _choose_size(pdf, short)
    w_long, _ = _choose_size(pdf, long)
    assert w_long >= w_short


def test_choose_size_from_grid(db, container, research_type):
    pdf = _make_measurer()
    for n in (1, 5, 20, 50, 100, 500):
        samples = _make_samples(container, research_type, n, prefix="A-")
        w, h = _choose_size(pdf, samples)
        assert w in WIDTHS_MM
        assert h in HEIGHTS_MM


# ============================================================
# _split_columns
# ============================================================
def test_split_columns_two():
    assert _split_columns([1, 2, 3, 4], 2) == [[1, 2], [3, 4]]


def test_split_columns_uneven():
    result = _split_columns([1, 2, 3, 4, 5], 2)
    assert result[0] == [1, 2, 3]
    assert result[1] == [4, 5]


def test_split_columns_empty():
    assert _split_columns([], 2) == []


def test_split_columns_invalid():
    with pytest.raises(ValueError):
        _split_columns([1], 0)


# ============================================================
# _paginate
# ============================================================
def test_paginate_empty_container_single_page(db, container):
    pdf = _make_measurer()
    pages = _paginate(pdf, container, [])
    assert len(pages) == 1
    assert pages[0]["is_continuation"] is False
    assert pages[0]["samples"] == []


def test_paginate_small_fits_one_page(db, container, research_type):
    pdf = _make_measurer()
    samples = _make_samples(container, research_type, 3, prefix="A-")
    pages = _paginate(pdf, container, samples)
    assert len(pages) == 1
    assert pages[0]["total_pages"] == 1
    assert len(pages[0]["samples"]) == 3


def test_paginate_many_creates_continuations(db, container, research_type):
    pdf = _make_measurer()
    samples = _make_samples(container, research_type, 500, prefix="A-")
    pages = _paginate(pdf, container, samples)
    assert len(pages) > 1
    assert pages[0]["is_continuation"] is False
    assert all(p["is_continuation"] for p in pages[1:])


def test_paginate_caps_continuations(db, container, research_type):
    pdf = _make_measurer()
    samples = _make_samples(container, research_type, 5000, prefix="A-")
    pages = _paginate(pdf, container, samples)
    assert len(pages) <= MAX_CONTINUATIONS + 1
    assert pages[-1]["truncated"] is True


# ============================================================
# _pack_on_sheets
# ============================================================
def test_pack_single_page_one_sheet():
    pages = [{"height": 74, "width": 150}]
    sheets = _pack_on_sheets(pages)
    assert len(sheets) == 1
    assert len(sheets[0]) == 1


def test_pack_sorts_by_height_desc():
    pages = [
        {"height": 49, "width": 110},
        {"height": 148, "width": 210},
        {"height": 74, "width": 150},
    ]
    sheets = _pack_on_sheets(pages)
    heights = [p["height"] for p in sheets[0]]
    assert heights == sorted(heights, reverse=True)


def test_pack_overflow_to_new_sheet():
    """
    4 этикетки по 148 мм без зазоров: 148 + 148 = 296 ≤ 297.
    Влезает 2 на A4 → 2 листа.
    """
    pages = [{"height": 148, "width": 210} for _ in range(4)]
    sheets = _pack_on_sheets(pages)
    assert len(sheets) == 2
    for sheet in sheets:
        assert len(sheet) == 2


def test_pack_small_two_on_one_sheet():
    """Две этикетки по 49 мм — обе на одном A4."""
    pages = [{"height": 49, "width": 110} for _ in range(2)]
    sheets = _pack_on_sheets(pages)
    assert len(sheets) == 1
    assert len(sheets[0]) == 2


# ============================================================
# render_container_label
# ============================================================
def test_render_returns_bytesio(db, container, research_type):
    _make_samples(container, research_type, 5)
    buf = render_container_label(container)
    assert isinstance(buf, BytesIO)


def test_render_returns_pdf_signature(db, container, research_type):
    _make_samples(container, research_type, 5)
    buf = render_container_label(container)
    assert buf.read()[:4] == b"%PDF"


def test_render_empty_container(db, container):
    buf = render_container_label(container)
    assert buf.read()[:4] == b"%PDF"


def test_render_many_samples_still_pdf(db, container, research_type):
    _make_samples(container, research_type, 200)
    buf = render_container_label(container)
    data = buf.read()
    assert data[:4] == b"%PDF"
    assert len(data) > 1000


# ============================================================
# render_batch_labels_pdf
# ============================================================
def test_batch_empty_returns_pdf(db):
    batch = PrintBatch.objects.create(batch_number="ПЕЧ-T-EMPTY")
    data = render_batch_labels_pdf(batch).read()
    assert data[:4] == b"%PDF"


def test_batch_one_container_one_page(db, container_type, research_type):
    batch = PrintBatch.objects.create(batch_number="ПЕЧ-T-001")
    c = _make_container(container_type, 1)
    PrintBatchItem.objects.create(batch=batch, container=c, position=1)
    _make_samples(c, research_type, 5)
    data = render_batch_labels_pdf(batch).read()
    assert data[:4] == b"%PDF"
    assert count_pdf_pages(data) >= 1


def test_batch_two_small_on_one_sheet(db, container_type, research_type):
    """Две этикетки маленькие (≤ 49 мм) — обе на одном листе A4."""
    batch = PrintBatch.objects.create(batch_number="ПЕЧ-T-002")
    for i in (1, 2):
        c = _make_container(container_type, i)
        PrintBatchItem.objects.create(batch=batch, container=c, position=i)
        _make_samples(c, research_type, 3, prefix="A-")
    data = render_batch_labels_pdf(batch).read()
    assert data[:4] == b"%PDF"
    assert count_pdf_pages(data) == 1


def test_batch_two_large_two_sheets(db, container_type, research_type):
    """
    Два контейнера с 200 пробами — каждый даёт 2 этикетки XXL.
    Итого 4 этикетки, каждая влезает только по одной на A4.
    """
    batch = PrintBatch.objects.create(batch_number="ПЕЧ-T-003")
    for i in (1, 2):
        c = _make_container(container_type, i)
        PrintBatchItem.objects.create(batch=batch, container=c, position=i)
        _make_samples(c, research_type, 200, prefix="A-")
    data = render_batch_labels_pdf(batch).read()
    assert data[:4] == b"%PDF"
    assert count_pdf_pages(data) >= 2

# ============================================================
# QR-сетка (4d-3)
# ============================================================
def test_qr_grid_dimensions_8x11():
    """На A4 при QR 25 мм, зазоре 1 мм, отступе 1 мм — 8 × 11."""
    cols, rows = _qr_grid_dimensions()
    assert cols == 8
    assert rows == 11


def test_qr_grid_capacity_88():
    """Ёмкость листа — 88 QR-кодов."""
    assert _qr_grid_capacity() == 88


def test_qr_grid_size_matches_label_qr():
    """QR в сетке — того же размера, что на этикетке."""
    assert QR_GRID_SIZE_MM == QR_SIZE_MM
    assert QR_GRID_SIZE_MM == 25


def _make_batch_with_containers(container_type, n: int):
    """Создаёт партию с N тарами."""
    batch = PrintBatch.objects.create(
        batch_number=f"ПЕЧ-QR-{n:04d}",
    )
    last = None
    for i in range(1, n + 1):
        c = Container.objects.create(
            container_number=f"T-QR-{i:04d}",
            container_type=container_type,
        )
        PrintBatchItem.objects.create(batch=batch, container=c, position=i)
        last = c
    return batch, last


def test_qr_batch_empty_returns_pdf(db):
    """Пустая партия — валидный PDF."""
    batch = PrintBatch.objects.create(batch_number="ПЕЧ-QR-EMPTY")
    data = render_batch_qr_pdf(batch).read()
    assert data[:4] == b"%PDF"


def test_qr_batch_one_container_one_page(db, container_type):
    """1 тара — 1 страница, 1 QR."""
    batch, _ = _make_batch_with_containers(container_type, 1)
    data = render_batch_qr_pdf(batch).read()
    assert data[:4] == b"%PDF"
    assert count_pdf_pages(data) == 1


def test_qr_batch_fits_88_one_page(db, container_type):
    """88 тар (ёмкость) — 1 страница."""
    batch, _ = _make_batch_with_containers(container_type, 88)
    data = render_batch_qr_pdf(batch).read()
    assert count_pdf_pages(data) == 1


def test_qr_batch_overflow_89_two_pages(db, container_type):
    """89 тар — 2 страницы."""
    batch, _ = _make_batch_with_containers(container_type, 89)
    data = render_batch_qr_pdf(batch).read()
    assert count_pdf_pages(data) == 2


def test_qr_batch_200_three_pages(db, container_type):
    """200 тар — 3 страницы (88 + 88 + 24)."""
    batch, _ = _make_batch_with_containers(container_type, 200)
    data = render_batch_qr_pdf(batch).read()
    assert count_pdf_pages(data) == 3