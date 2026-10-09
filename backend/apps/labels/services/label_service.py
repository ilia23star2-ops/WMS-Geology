"""
Сервис рендера этикетки тары в PDF.

Использует fpdf2 (чистый Python, без внешних DLL).
Размер этикетки: 200×120 мм.
Структура: шапка (участок, Н/З, тип, тара) + QR + список проб.

Шрифт: `backend/apps/labels/static/fonts/DejaVuSans.ttf`
(поддерживает кириллицу). Путь к файлу — в константе FONT_PATH.
"""

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

PAGE_W_MM = 200
PAGE_H_MM = 120
MARGIN_MM = 4
QR_SIZE_MM = 30
HEADER_LINE_H_MM = 5
LIST_TOP_MM = 42
LIST_BOTTOM_MM = PAGE_H_MM - MARGIN_MM  # 116

MAX_SINGLE_COLUMN = 15
MAX_TWO_COLUMN = 60


def _calculate_layout(samples_count: int) -> tuple[int, float, int]:
    """
    Определяет (columns, row_height_mm, max_display).

    - ≤ 15 проб   → 1 колонка, высота строки 4.5 мм
    - 16–60 проб  → 2 колонки, высота строки 2.4 мм
    - > 60 проб   → 2 колонки, обрезание до 60
    """
    if samples_count <= MAX_SINGLE_COLUMN:
        return 1, 4.5, samples_count
    if samples_count <= MAX_TWO_COLUMN:
        return 2, 2.4, samples_count
    return 2, 2.4, MAX_TWO_COLUMN


def _split_into_columns(items: list, columns: int) -> list[list]:
    """Делит список на `columns` примерно равных частей."""
    if columns <= 0:
        raise ValueError("columns должен быть > 0")
    if not items:
        return [[] for _ in range(columns)]
    per_column = (len(items) + columns - 1) // columns
    return [items[i:i + per_column] for i in range(0, len(items), per_column)]


def _number_samples(columns: list[list]) -> list[list[tuple[int, object]]]:
    """Присваивает пробам сквозной номер: [(n, sample), ...]."""
    result: list[list[tuple[int, object]]] = []
    counter = 1
    for column in columns:
        numbered = []
        for sample in column:
            numbered.append((counter, sample))
            counter += 1
        result.append(numbered)
    return result


def _get_work_order_display(first_sample) -> str:
    """Формирует строку Н/З: 'вх / зашифр' или просто одно."""
    if first_sample is None or first_sample.current_work_order is None:
        return ""
    wo = first_sample.current_work_order
    if wo.linked_order is None:
        return wo.order_number
    if wo.order_type == "INCOMING":
        return f"{wo.order_number} / {wo.linked_order.order_number}"
    return f"{wo.linked_order.order_number} / {wo.order_number}"


def _build_pdf(container, samples: list) -> bytes:
    """Собирает PDF как bytes."""
    if not FONT_PATH.exists():
        raise FileNotFoundError(
            f"Шрифт не найден: {FONT_PATH}. "
            "Положи любой TTF с кириллицей (например, Arial) по этому пути."
        )

    samples_count = len(samples)
    columns_n, row_h, max_display = _calculate_layout(samples_count)
    is_truncated = samples_count > max_display
    samples_to_show = samples[:max_display] if is_truncated else samples

    columns_data = _number_samples(
        _split_into_columns(samples_to_show, columns_n),
    )

    first = samples[0] if samples else None
    site_name = first.site.name if first and first.site else ""
    research_type_code = (
        first.research_type.code if first and first.research_type else ""
    )
    work_order_display = _get_work_order_display(first)

    # --- PDF ---
    pdf = FPDF(orientation="P", unit="mm", format=(PAGE_W_MM, PAGE_H_MM))
    pdf.set_auto_page_break(auto=False)
    pdf.add_font("main", "", str(FONT_PATH))
    pdf.add_page()

    # --- Шапка ---
    pdf.set_font("main", size=11)
    y = MARGIN_MM
    header_lines = [
        ("Участок:", site_name),
        ("Н/З:", work_order_display),
        ("Тип:", research_type_code),
        ("Тара:", container.container_number),
    ]
    for label, value in header_lines:
        if not value:
            continue
        pdf.set_xy(MARGIN_MM, y)
        pdf.set_text_color(120, 120, 120)
        pdf.cell(20, HEADER_LINE_H_MM, label, border=0)
        pdf.set_text_color(0, 0, 0)
        pdf.set_xy(MARGIN_MM + 20, y)
        pdf.cell(0, HEADER_LINE_H_MM, str(value), border=0)
        y += HEADER_LINE_H_MM

    # --- QR ---
    payload = make_payload("CONTAINER", container.id)
    qr_buf = generate_qr_png(payload, box_size=8, border=1)
    qr_x = PAGE_W_MM - MARGIN_MM - QR_SIZE_MM
    qr_y = MARGIN_MM
    pdf.image(qr_buf, x=qr_x, y=qr_y, w=QR_SIZE_MM, h=QR_SIZE_MM)

    # ID под QR
    pdf.set_font("main", size=7)
    pdf.set_text_color(120, 120, 120)
    pdf.set_xy(qr_x, qr_y + QR_SIZE_MM + 0.5)
    pdf.cell(QR_SIZE_MM, 3, f"#{container.id}", align="C")
    pdf.set_text_color(0, 0, 0)

    # --- Линия-разделитель ---
    pdf.line(MARGIN_MM, LIST_TOP_MM - 2, PAGE_W_MM - MARGIN_MM, LIST_TOP_MM - 2)

    # --- Список проб ---
    if samples_count > 0:
        col_width = (PAGE_W_MM - 2 * MARGIN_MM) / columns_n
        pdf.set_font("main", size=8)

        for col_idx, column in enumerate(columns_data):
            col_x = MARGIN_MM + col_idx * col_width
            y = LIST_TOP_MM
            for n, sample in column:
                # Чекбокс
                box_size = min(2.2, row_h * 0.8)
                pdf.rect(
                    col_x, y + (row_h - box_size) / 2,
                    box_size, box_size,
                )
                # Текст
                pdf.set_xy(col_x + box_size + 1.2, y)
                pdf.cell(
                    col_width - box_size - 1.2,
                    row_h,
                    f"{n}. {sample.sample_number}",
                    border=0,
                )
                y += row_h

    # --- Пометка об обрезке ---
    if is_truncated:
        pdf.set_font("main", size=8)
        pdf.set_text_color(120, 120, 120)
        pdf.set_xy(MARGIN_MM, LIST_BOTTOM_MM - 4)
        pdf.cell(
            PAGE_W_MM - 2 * MARGIN_MM, 4,
            f"Показано 60 из {samples_count} проб. Полный список — в системе.",
            align="C",
        )

    return bytes(pdf.output())


def render_container_label(container) -> BytesIO:
    """
    Рендерит PDF-этикетку для тары.

    :param container: экземпляр Container.
    :returns: BytesIO с PDF (указатель в начале).
    """
    samples = list(
        container.samples.select_related(
            "research_type", "site", "current_work_order__linked_order",
        ).order_by("sample_number")
    )
    pdf_bytes = _build_pdf(container, samples)
    return BytesIO(pdf_bytes)