"""
Сервис рендера этикеток тары в PDF.

Модель раскладки:

- `render_container_label` — одна этикетка тары (модель 4d-1).
- `render_batch_labels_pdf` — партия этикеток (модель 4d-1).
- `render_batch_qr_pdf` — партия в режиме «только QR» (4d-3):
  сетка QR 25×25 мм на A4, тот же QR, что на этикетке.
  Общие линии реза — одна линия между соседними QR.

Формат этикетки (4d-1):
- Сетка ширин × сетка высот (A5 landscape, макс. 210×148).
- Шапка 28 мм: QR 25×25 справа, 4 строки слева.
- Рабочая область растягивается на всю ширину.
- Лист A4: этикетки от левого верхнего угла (без отступов).
- Пунктирный периметр + рамка таблицы + чекбоксы.

QR-сетка (4d-3):
- QR 25×25 мм (тот же, что на этикетке).
- Зазор между QR — 1 мм, отступ от края — 1 мм.
- 8 × 11 = 88 QR на A4.
- Общие пунктирные линии реза: одна между соседними QR.

Шрифт: `backend/apps/labels/static/fonts/DejaVuSans.ttf`.
"""

import math
import re
from io import BytesIO
from pathlib import Path

from fpdf import FPDF

from apps.labels.services.qr_service import generate_qr_png, make_payload


FONT_PATH = (
    Path(__file__).resolve().parent.parent
    / "static"
    / "fonts"
    / "DejaVuSans.ttf"
)

# --- Размерная сетка этикетки (мм) ---
WIDTHS_MM = [110, 130, 150, 180, 210]
HEIGHTS_MM = [37, 49, 74, 99, 148]

# --- Геометрия этикетки (мм) ---
QR_SIZE_MM = 25
HEADER_H_MM = 28
LABEL_MARGIN_MM = 1
LABEL_BOTTOM_PAD_MM = 1
COL_HEADER_H_MM = 5
ROW_H_MM = 5
PNP_W_MM = 12
COL_PADDING_MM = 3
CHECKBOX_SIZE_MM = 2.2

# --- Шрифт ---
FONT_SIZE_PT = 10
SMALL_FONT_PT = 7

# --- A4 (мм) ---
A4_W_MM = 210
A4_H_MM = 297
A4_LABEL_GAP_MM = 0  # не используется, оставлено для совместимости

# --- QR-сетка (режим QR_ONLY, 4d-3) ---
QR_GRID_SIZE_MM = 25       # тот же QR, что на этикетке
QR_GRID_GAP_MM = 1
QR_GRID_MARGIN_MM = 1

# --- Продолжения ---
MAX_CONTINUATIONS = 3

# --- Пунктир реза ---
CUT_DASH_MM = 1.0


# ============================================================
# Шрифт
# ============================================================
def _check_font() -> None:
    if not FONT_PATH.exists():
        raise FileNotFoundError(
            f"Шрифт не найден: {FONT_PATH}. "
            "Положи TTF с кириллицей (например, DejaVuSans) по пути."
        )


def _make_measurer() -> FPDF:
    """Отдельный FPDF только для измерения ширины текста."""
    pdf = FPDF(unit="mm")
    pdf.add_font("main", "", str(FONT_PATH))
    pdf.set_font("main", size=FONT_SIZE_PT)
    return pdf


def _text_width_mm(pdf: FPDF, text: str) -> float:
    if not text:
        return 0.0
    return float(pdf.get_string_width(text))


def _truncate_to_width(pdf: FPDF, text: str, max_mm: float) -> str:
    """Обрезает текст до max_mm, добавляя «…» в конце."""
    if _text_width_mm(pdf, text) <= max_mm:
        return text
    ellipsis = "..."
    ellipsis_w = _text_width_mm(pdf, ellipsis)
    if ellipsis_w > max_mm:
        return ""
    lo, hi = 0, len(text)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if _text_width_mm(pdf, text[:mid]) + ellipsis_w <= max_mm:
            lo = mid
        else:
            hi = mid - 1
    return text[:lo] + ellipsis


# ============================================================
# Метрики раскладки этикетки
# ============================================================
def _working_width_mm(label_w: float) -> float:
    return label_w - 2 * LABEL_MARGIN_MM


def _working_height_mm(label_h: float) -> float:
    return label_h - HEADER_H_MM - LABEL_BOTTOM_PAD_MM


def _column_width_mm(pdf: FPDF, samples) -> float:
    """
    Минимальная ширина колонки: п/п + чекбокс + самый длинный
    номер + padding. Используется только для расчёта кол-ва
    колонок; фактическая ширина растягивается.
    """
    max_num_w = 0.0
    for s in samples:
        w = _text_width_mm(pdf, s.sample_number)
        if w > max_num_w:
            max_num_w = w
    return PNP_W_MM + CHECKBOX_SIZE_MM + 1 + max_num_w + COL_PADDING_MM


def _columns_count(pdf: FPDF, samples, label_w: float) -> int:
    work_w = _working_width_mm(label_w)
    col_w = _column_width_mm(pdf, samples)
    if col_w <= 0:
        return 1
    return max(1, int(work_w // col_w))


def _rows_count(label_h: float) -> int:
    work_h = _working_height_mm(label_h) - COL_HEADER_H_MM
    if work_h < ROW_H_MM:
        return 0
    return int(work_h // ROW_H_MM)


def _total_capacity(pdf: FPDF, samples, label_w: float, label_h: float) -> int:
    return _columns_count(pdf, samples, label_w) * _rows_count(label_h)


def _choose_size(pdf: FPDF, samples) -> tuple[int, int]:
    """Минимальный размер из сетки, в который влезают пробы."""
    n = len(samples)
    if n == 0:
        return WIDTHS_MM[0], HEIGHTS_MM[0]
    for h in HEIGHTS_MM:
        for w in WIDTHS_MM:
            if _total_capacity(pdf, samples, w, h) >= n:
                return w, h
    return WIDTHS_MM[-1], HEIGHTS_MM[-1]


# ============================================================
# Метрики QR-сетки (4d-3)
# ============================================================
def _qr_grid_dimensions() -> tuple[int, int]:
    """
    Сколько QR влезает на A4: (cols, rows).

    Формула: `(usable + gap) // (size + gap)` — зазор считается
    только между QR, а не после последнего.
    """
    cell = QR_GRID_SIZE_MM + QR_GRID_GAP_MM
    usable_w = A4_W_MM - 2 * QR_GRID_MARGIN_MM
    usable_h = A4_H_MM - 2 * QR_GRID_MARGIN_MM
    cols = max(1, int((usable_w + QR_GRID_GAP_MM) // cell))
    rows = max(1, int((usable_h + QR_GRID_GAP_MM) // cell))
    return cols, rows


def _qr_grid_capacity() -> int:
    """Сколько всего QR влезает на один A4."""
    cols, rows = _qr_grid_dimensions()
    return cols * rows


# ============================================================
# Разбиение проб и пагинация этикетки
# ============================================================
def _split_columns(samples: list, columns_n: int) -> list[list]:
    if columns_n <= 0:
        raise ValueError("columns_n должен быть > 0")
    if not samples:
        return []
    per_col = math.ceil(len(samples) / columns_n)
    cols = []
    for i in range(columns_n):
        chunk = samples[i * per_col:(i + 1) * per_col]
        if chunk:
            cols.append(chunk)
    return cols


def _number_samples(columns: list[list]) -> list[list[tuple[int, object]]]:
    result: list[list[tuple[int, object]]] = []
    counter = 1
    for col in columns:
        numbered = []
        for s in col:
            numbered.append((counter, s))
            counter += 1
        result.append(numbered)
    return result


def _paginate(pdf: FPDF, container, samples: list) -> list[dict]:
    total = len(samples)
    if total == 0:
        return [{
            "container": container,
            "samples": [],
            "page_num": 1,
            "total_pages": 1,
            "is_continuation": False,
            "width": WIDTHS_MM[0],
            "height": HEIGHTS_MM[0],
            "total_samples": 0,
            "truncated": False,
        }]

    w, h = _choose_size(pdf, samples)
    cols = _columns_count(pdf, samples, w)
    rows = _rows_count(h)
    per_page = max(1, cols * rows)

    total_pages = max(1, math.ceil(total / per_page))
    if total_pages > MAX_CONTINUATIONS + 1:
        total_pages = MAX_CONTINUATIONS + 1

    pages = []
    shown = 0
    for i in range(total_pages):
        chunk = samples[shown:shown + per_page]
        shown += len(chunk)
        pages.append({
            "container": container,
            "samples": chunk,
            "page_num": i + 1,
            "total_pages": total_pages,
            "is_continuation": i > 0,
            "width": w,
            "height": h,
            "total_samples": total,
            "truncated": (i == total_pages - 1) and (shown < total),
        })
    return pages


def _pack_on_sheets(pages: list[dict]) -> list[list[dict]]:
    """
    Раскладка по листам A4: от левого верхнего угла (0,0),
    стопкой без зазоров, сортировка по убыванию высоты,
    этикетка не разрывается.
    """
    sorted_pages = sorted(pages, key=lambda p: -p["height"])
    sheets: list[list[dict]] = []
    current: list[dict] = []
    y = 0.0

    for p in sorted_pages:
        h = p["height"]
        if current and y + h > A4_H_MM:
            sheets.append(current)
            current = []
            y = 0.0
        placed = dict(p)
        placed["x"] = 0.0
        placed["y"] = y
        current.append(placed)
        y += h

    if current:
        sheets.append(current)
    return sheets


# ============================================================
# Рендер этикетки (4d-1)
# ============================================================
def _load_samples(container) -> list:
    return list(
        container.samples.select_related(
            "research_type", "site", "current_work_order__linked_order",
        ).order_by("sample_number")
    )


def _is_incoming(first_sample) -> bool:
    if first_sample is None or first_sample.current_work_order is None:
        return False
    return first_sample.current_work_order.order_type == "INCOMING"


def _get_work_order_display(first_sample) -> str:
    if first_sample is None or first_sample.current_work_order is None:
        return ""
    wo = first_sample.current_work_order
    if wo.linked_order is None:
        return wo.order_number
    if wo.order_type == "INCOMING":
        return f"{wo.order_number} / {wo.linked_order.order_number}"
    return f"{wo.linked_order.order_number} / {wo.order_number}"


def _header_lines(container, samples) -> list[tuple[str, str]]:
    first = samples[0] if samples else None
    site = first.site.name if first and first.site else "—"
    rtype = first.research_type.code if first and first.research_type else "—"
    wo = _get_work_order_display(first) or "—"
    wo_label = "Н/З (вх.):" if _is_incoming(first) else "Н/З:"
    return [
        ("Уч:", site),
        (wo_label, wo),
        ("Исл:", rtype),
        ("№:", container.container_number),
    ]


def _set_cut_style(pdf: FPDF) -> None:
    """Переводит перо в режим пунктира реза."""
    pdf.set_dash_pattern(dash=CUT_DASH_MM, gap=CUT_DASH_MM)
    pdf.set_draw_color(150, 150, 150)


def _reset_draw_style(pdf: FPDF) -> None:
    """Сбрасывает пунктир и цвет пера."""
    pdf.set_dash_pattern()
    pdf.set_draw_color(0, 0, 0)


def _draw_cut_perimeter(pdf: FPDF, x: float, y: float, w: float, h: float) -> None:
    """Пунктирный периметр этикетки."""
    _set_cut_style(pdf)
    pdf.rect(x, y, w, h)
    _reset_draw_style(pdf)


def _draw_header(
    pdf: FPDF, container, samples, x: float, y: float, w: float,
) -> None:
    """Шапка этикетки: QR справа, текст слева."""
    qr_x = x + w - LABEL_MARGIN_MM - QR_SIZE_MM
    qr_y = y + LABEL_MARGIN_MM
    payload = make_payload("CONTAINER", container.id)
    qr_buf = generate_qr_png(payload, box_size=8, border=1)
    pdf.image(qr_buf, x=qr_x, y=qr_y, w=QR_SIZE_MM, h=QR_SIZE_MM)

    divider_x = qr_x - 2
    pdf.set_draw_color(180, 180, 180)
    pdf.line(divider_x, y + LABEL_MARGIN_MM, divider_x, y + HEADER_H_MM - 1)
    pdf.set_draw_color(0, 0, 0)

    pdf.set_font("main", size=FONT_SIZE_PT)
    text_x = x + LABEL_MARGIN_MM
    text_w = divider_x - text_x - 2
    label_w_mm = _text_width_mm(pdf, "Н/З (вх.):") + 2
    value_x = text_x + label_w_mm
    value_w = max(10.0, text_w - label_w_mm)

    lines = _header_lines(container, samples)
    line_h = 5
    y_text = y + LABEL_MARGIN_MM
    for label, value in lines:
        pdf.set_xy(text_x, y_text)
        pdf.set_text_color(120, 120, 120)
        pdf.cell(label_w_mm, line_h, label, border=0)
        pdf.set_text_color(0, 0, 0)
        pdf.set_xy(value_x, y_text)
        val = _truncate_to_width(pdf, value or "—", value_w)
        pdf.cell(value_w, line_h, val, border=0)
        y_text += line_h


def _draw_header_divider(
    pdf: FPDF, x: float, y: float, w: float,
) -> None:
    pdf.set_draw_color(0, 0, 0)
    pdf.line(
        x + LABEL_MARGIN_MM,
        y + HEADER_H_MM - 1,
        x + w - LABEL_MARGIN_MM,
        y + HEADER_H_MM - 1,
    )


def _draw_continuation_note(
    pdf: FPDF, container, x: float, y: float, w: float,
    page_num: int, total_pages: int,
) -> None:
    pdf.set_font("main", size=FONT_SIZE_PT)
    pdf.set_text_color(0, 0, 0)
    pdf.set_xy(x + LABEL_MARGIN_MM, y + LABEL_MARGIN_MM)
    text = (
        f"Тара {container.container_number} — продолжение "
        f"{page_num - 1}/{total_pages - 1}"
    )
    pdf.cell(w - 2 * LABEL_MARGIN_MM, 5, text, border=0)


def _draw_working_area(
    pdf: FPDF, samples: list, x: float, y: float, w: float, h: float,
) -> None:
    if not samples:
        return

    work_x = x + LABEL_MARGIN_MM
    work_w = w - 2 * LABEL_MARGIN_MM
    col_w_min = _column_width_mm(pdf, samples)
    cols = max(1, int(work_w // col_w_min))
    col_w = work_w / cols

    columns = _split_columns(samples, cols)
    if not columns:
        return
    numbered = _number_samples(columns)
    table_w = work_w

    pdf.set_font("main", size=FONT_SIZE_PT)
    pdf.set_text_color(0, 0, 0)
    pdf.set_line_width(0.2)
    pdf.set_draw_color(0, 0, 0)

    pdf.rect(work_x, y, table_w, h)

    for ci in range(len(numbered)):
        cx = work_x + ci * col_w
        pdf.set_xy(cx + 1, y + 0.7)
        pdf.cell(PNP_W_MM - 1, COL_HEADER_H_MM - 1.5, "п/п", border=0)
        pdf.set_xy(cx + PNP_W_MM + 1, y + 0.7)
        pdf.cell(col_w - PNP_W_MM - 2, COL_HEADER_H_MM - 1.5, "Образец", border=0)

    pdf.line(work_x, y + COL_HEADER_H_MM, work_x + table_w, y + COL_HEADER_H_MM)

    for ci in range(1, len(numbered)):
        lx = work_x + ci * col_w
        pdf.line(lx, y, lx, y + h)

    for ci, col in enumerate(numbered):
        cx = work_x + ci * col_w
        row_y = y + COL_HEADER_H_MM
        for num, s in col:
            if row_y + ROW_H_MM > y + h:
                break
            pdf.set_xy(cx + 1, row_y + 0.7)
            pdf.cell(PNP_W_MM - 1, ROW_H_MM - 1.5, f"{num}.", border=0)
            box_x = cx + PNP_W_MM + 1
            box_y = row_y + (ROW_H_MM - CHECKBOX_SIZE_MM) / 2
            pdf.rect(box_x, box_y, CHECKBOX_SIZE_MM, CHECKBOX_SIZE_MM)
            text_x = box_x + CHECKBOX_SIZE_MM + 1
            text_w = col_w - (text_x - cx) - 1
            pdf.set_xy(text_x, row_y + 0.7)
            pdf.cell(text_w, ROW_H_MM - 1.5, s.sample_number, border=0)
            row_y += ROW_H_MM


def _draw_truncated_note(
    pdf: FPDF, x: float, y: float, w: float, h: float,
    shown: int, total: int,
) -> None:
    pdf.set_font("main", size=SMALL_FONT_PT)
    pdf.set_text_color(120, 120, 120)
    pdf.set_xy(x + LABEL_MARGIN_MM, y + h - 3)
    pdf.cell(
        w - 2 * LABEL_MARGIN_MM, 3,
        f"Показано {shown} из {total}. Полный список — в системе.",
        align="C",
    )
    pdf.set_text_color(0, 0, 0)


def _draw_label_on_page(pdf: FPDF, page: dict, x: float, y: float) -> None:
    w = page["width"]
    h = page["height"]
    container = page["container"]
    samples = page["samples"]

    _draw_cut_perimeter(pdf, x, y, w, h)

    if page["is_continuation"]:
        _draw_continuation_note(
            pdf, container, x, y, w,
            page_num=page["page_num"],
            total_pages=page["total_pages"],
        )
        working_y = y + 8
        working_h = h - 8 - LABEL_BOTTOM_PAD_MM
    else:
        _draw_header(pdf, container, samples, x, y, w)
        _draw_header_divider(pdf, x, y, w)
        working_y = y + HEADER_H_MM
        working_h = h - HEADER_H_MM - LABEL_BOTTOM_PAD_MM

    _draw_working_area(pdf, samples, x, working_y, w, working_h)

    if page.get("truncated"):
        _draw_truncated_note(
            pdf, x, y, w, h,
            shown=page["page_num"] * len(samples),
            total=page["total_samples"],
        )


# ============================================================
# Публичные функции: этикетки (4d-1)
# ============================================================
def render_container_label(container) -> BytesIO:
    """PDF одной этикетки тары (или её продолжений)."""
    _check_font()
    samples = _load_samples(container)
    measurer = _make_measurer()
    pages = _paginate(measurer, container, samples)

    w = pages[0]["width"]
    h = pages[0]["height"]

    pdf = FPDF(orientation="P", unit="mm", format=(w, h))
    pdf.set_auto_page_break(auto=False)
    pdf.add_font("main", "", str(FONT_PATH))

    for page in pages:
        pdf.add_page()
        _draw_label_on_page(pdf, page, x=0, y=0)

    return BytesIO(bytes(pdf.output()))


def render_batch_labels_pdf(batch) -> BytesIO:
    """PDF партии: листы A4, этикетки от левого верхнего угла."""
    _check_font()

    items = list(
        batch.items.select_related("container").order_by("position", "id")
    )

    measurer = _make_measurer()
    all_pages: list[dict] = []
    for item in items:
        samples = _load_samples(item.container)
        all_pages.extend(_paginate(measurer, item.container, samples))

    pdf = FPDF(orientation="P", unit="mm", format=(A4_W_MM, A4_H_MM))
    pdf.set_auto_page_break(auto=False)
    pdf.add_font("main", "", str(FONT_PATH))

    if not all_pages:
        pdf.add_page()
        return BytesIO(bytes(pdf.output()))

    sheets = _pack_on_sheets(all_pages)
    for sheet in sheets:
        pdf.add_page()
        for page in sheet:
            _draw_label_on_page(pdf, page, x=page["x"], y=page["y"])

    return BytesIO(bytes(pdf.output()))


# ============================================================
# Публичные функции: QR-сетка (4d-3)
# ============================================================
def _draw_qr_grid_cut_lines(pdf: FPDF, cols: int, n_items: int) -> None:
    """
    Общие пунктирные линии реза для QR-сетки (4d-3).

    Между соседними QR — ОДНА линия (а не две). Внешний контур
    рисуется один раз. Линии идут по границе ячейки
    (`size + gap/2`), то есть по центру зазора между QR.

    :param cols: число колонок в сетке.
    :param n_items: сколько QR фактически на странице.
    """
    cell = QR_GRID_SIZE_MM + QR_GRID_GAP_MM
    half_gap = QR_GRID_GAP_MM / 2
    size = QR_GRID_SIZE_MM
    n_rows_used = (n_items + cols - 1) // cols

    _set_cut_style(pdf)

    for row in range(n_rows_used):
        items_in_row = min(cols, n_items - row * cols)
        for col in range(items_in_row):
            x = QR_GRID_MARGIN_MM + col * cell
            y = QR_GRID_MARGIN_MM + row * cell

            # Верхняя граница — только для первой строки.
            if row == 0:
                pdf.line(
                    x - half_gap, y - half_gap,
                    x + size + half_gap, y - half_gap,
                )
            # Левая граница — только для первой колонки.
            if col == 0:
                pdf.line(
                    x - half_gap, y - half_gap,
                    x - half_gap, y + size + half_gap,
                )
            # Правая граница — всегда. Между соседними QR это
            # одна общая линия.
            pdf.line(
                x + size + half_gap, y - half_gap,
                x + size + half_gap, y + size + half_gap,
            )
            # Нижняя граница — всегда.
            pdf.line(
                x - half_gap, y + size + half_gap,
                x + size + half_gap, y + size + half_gap,
            )

    _reset_draw_style(pdf)


def render_batch_qr_pdf(batch) -> BytesIO:
    """
    PDF партии в режиме «только QR» (4d-3).

    Каждая тара — один QR 25×25 мм, тот же payload, что на
    этикетке. Раскладка — сетка 8×11 = 88 QR на лист A4.
    Общие пунктирные линии реза — по одной между соседними QR.

    :param batch: экземпляр PrintBatch.
    :returns: BytesIO с PDF (указатель в начале).
    """
    items = list(
        batch.items.select_related("container").order_by("position", "id")
    )
    containers = [item.container for item in items]

    cols, rows = _qr_grid_dimensions()
    per_page = max(1, cols * rows)
    cell = QR_GRID_SIZE_MM + QR_GRID_GAP_MM

    pdf = FPDF(orientation="P", unit="mm", format=(A4_W_MM, A4_H_MM))
    pdf.set_auto_page_break(auto=False)

    if not containers:
        pdf.add_page()
        return BytesIO(bytes(pdf.output()))

    for page_start in range(0, len(containers), per_page):
        page_containers = containers[page_start:page_start + per_page]
        pdf.add_page()
        for idx, container in enumerate(page_containers):
            col = idx % cols
            row = idx // cols
            x = QR_GRID_MARGIN_MM + col * cell
            y = QR_GRID_MARGIN_MM + row * cell
            payload = make_payload("CONTAINER", container.id)
            qr_buf = generate_qr_png(payload, box_size=8, border=1)
            pdf.image(
                qr_buf,
                x=x,
                y=y,
                w=QR_GRID_SIZE_MM,
                h=QR_GRID_SIZE_MM,
            )
        # Один раз на страницу — общие линии реза.
        _draw_qr_grid_cut_lines(pdf, cols, len(page_containers))

    return BytesIO(bytes(pdf.output()))


def count_pdf_pages(pdf_bytes: bytes) -> int:
    """Число страниц PDF по содержимому (для тестов)."""
    m = re.search(rb"/Count (\d+)", pdf_bytes)
    return int(m.group(1)) if m else 0