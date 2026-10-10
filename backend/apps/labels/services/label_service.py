"""
Сервис рендера этикеток тары в PDF (модель 4d-1).

Формат: сетка ширин × сетка высот (A5 landscape, макс. 210×148).
Шапка фиксированной высоты: QR 25×25 справа, 4 строки слева.
Рабочая область растягивается на всю ширину этикетки (1 мм
отступ от периметра с каждой стороны). Колонки делят ширину
поровну.
Лист A4: этикетки от левого верхнего угла (без отступов).
Пунктирный периметр + рамка таблицы + чекбоксы в строках.

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

# --- Размерная сетка (мм) ---
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
# Метрики раскладки
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
# Разбиение проб и пагинация
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
# Рендер
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


def _draw_cut_perimeter(pdf: FPDF, x: float, y: float, w: float, h: float) -> None:
    pdf.set_dash_pattern(dash=CUT_DASH_MM, gap=CUT_DASH_MM)
    pdf.set_draw_color(150, 150, 150)
    pdf.rect(x, y, w, h)
    pdf.set_dash_pattern()
    pdf.set_draw_color(0, 0, 0)


def _draw_header(
    pdf: FPDF, container, samples, x: float, y: float, w: float,
) -> None:
    """Шапка этикетки: QR справа, текст слева."""
    qr_x = x + w - LABEL_MARGIN_MM - QR_SIZE_MM
    qr_y = y + LABEL_MARGIN_MM
    payload = make_payload("CONTAINER", container.id)
    qr_buf = generate_qr_png(payload, box_size=8, border=1)
    pdf.image(qr_buf, x=qr_x, y=qr_y, w=QR_SIZE_MM, h=QR_SIZE_MM)

    # Вертикальный разделитель между текстом шапки и QR.
    divider_x = qr_x - 2
    pdf.set_draw_color(180, 180, 180)
    pdf.line(divider_x, y + LABEL_MARGIN_MM, divider_x, y + HEADER_H_MM - 1)
    pdf.set_draw_color(0, 0, 0)

    # Текст слева.
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
    """Горизонтальный разделитель между шапкой и рабочей зоной."""
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
    """
    Таблица списка проб. Колонки растягиваются на всю ширину
    рабочей области: col_w = work_w / cols.
    """
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

    # Рамка таблицы.
    pdf.rect(work_x, y, table_w, h)

    # Шапка колонок.
    for ci in range(len(numbered)):
        cx = work_x + ci * col_w
        pdf.set_xy(cx + 1, y + 0.7)
        pdf.cell(PNP_W_MM - 1, COL_HEADER_H_MM - 1.5, "п/п", border=0)
        pdf.set_xy(cx + PNP_W_MM + 1, y + 0.7)
        pdf.cell(col_w - PNP_W_MM - 2, COL_HEADER_H_MM - 1.5, "Образец", border=0)

    # Линия под шапкой.
    pdf.line(work_x, y + COL_HEADER_H_MM, work_x + table_w, y + COL_HEADER_H_MM)

    # Вертикальные линии между колонками.
    for ci in range(1, len(numbered)):
        lx = work_x + ci * col_w
        pdf.line(lx, y, lx, y + h)

    # Строки.
    for ci, col in enumerate(numbered):
        cx = work_x + ci * col_w
        row_y = y + COL_HEADER_H_MM
        for num, s in col:
            if row_y + ROW_H_MM > y + h:
                break
            # Порядковый номер.
            pdf.set_xy(cx + 1, row_y + 0.7)
            pdf.cell(PNP_W_MM - 1, ROW_H_MM - 1.5, f"{num}.", border=0)
            # Чекбокс.
            box_x = cx + PNP_W_MM + 1
            box_y = row_y + (ROW_H_MM - CHECKBOX_SIZE_MM) / 2
            pdf.rect(box_x, box_y, CHECKBOX_SIZE_MM, CHECKBOX_SIZE_MM)
            # Номер пробы.
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
# Публичные функции
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


def count_pdf_pages(pdf_bytes: bytes) -> int:
    """Число страниц PDF по содержимому (для тестов)."""
    m = re.search(rb"/Count (\d+)", pdf_bytes)
    return int(m.group(1)) if m else 0