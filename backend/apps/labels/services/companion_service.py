"""
Сервис генерации сопроводительного документа к партии печати (2f-7b).

Документ A4 portrait:
- шапка: «Сопроводительный лист», номер партии, дата, автор, тип, статус;
- сводка: всего тар, всего проб;
- таблица тар (№ / номер тары / тип тары / кол-во проб);
- подписи: «Сдал» / «Принял».

Переиспользует хелперы `label_service.py` (шрифт, обрезка текста).
"""

from datetime import datetime
from io import BytesIO

from fpdf import FPDF

from apps.labels.services.label_service import (
    FONT_PATH,
    _check_font,
    _make_measurer,
    _truncate_to_width,
)


# --- Размеры и отступы (мм) ---
A4_W_MM = 210
A4_H_MM = 297
MARGIN_MM = 15
FONT_SIZE_PT = 10
TITLE_FONT_PT = 14
SUBTITLE_FONT_PT = 12
ROW_H_MM = 7
HEADER_ROW_H_MM = 8


def _fmt_dt(value) -> str:
    if not value:
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y %H:%M")
    return str(value)


def _draw_header(pdf: FPDF, batch) -> float:
    """Рисует шапку документа. Возвращает Y-координату конца шапки."""
    pdf.set_font("main", size=TITLE_FONT_PT)
    pdf.set_xy(MARGIN_MM, MARGIN_MM)
    pdf.cell(0, 8, "Сопроводительный лист", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("main", size=FONT_SIZE_PT)
    y = pdf.get_y() + 2

    lines = [
        ("Партия №:", batch.batch_number),
        ("Дата формирования:", _fmt_dt(batch.created_at)),
        ("Тип:", batch.get_print_type_display()),
        ("Статус:", batch.get_status_display()),
        ("Создал:", batch.created_by.username if batch.created_by else "—"),
        ("Напечатал:", batch.printed_by.username if batch.printed_by else "—"),
    ]

    label_w = 45.0
    for label, value in lines:
        pdf.set_xy(MARGIN_MM, y)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(label_w, ROW_H_MM, label)
        pdf.set_text_color(0, 0, 0)
        pdf.set_xy(MARGIN_MM + label_w, y)
        pdf.cell(0, ROW_H_MM, str(value))
        y += ROW_H_MM

    return y + 4


def _draw_summary(pdf: FPDF, total_items: int, total_samples: int, y: float) -> float:
    """Рисует блок сводки. Возвращает Y-координату."""
    pdf.set_font("main", size=SUBTITLE_FONT_PT)
    pdf.set_xy(MARGIN_MM, y)
    pdf.cell(0, 8, "Сводка", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("main", size=FONT_SIZE_PT)
    y = pdf.get_y()
    pdf.set_xy(MARGIN_MM, y)
    pdf.cell(0, ROW_H_MM, f"Всего тар: {total_items}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, ROW_H_MM, f"Всего проб: {total_samples}", new_x="LMARGIN", new_y="NEXT")
    return pdf.get_y() + 4


def _draw_table(pdf: FPDF, items: list, measurer: FPDF, y: float) -> float:
    """Рисует таблицу тар. Возвращает Y-координату."""
    pdf.set_font("main", size=SUBTITLE_FONT_PT)
    pdf.set_xy(MARGIN_MM, y)
    pdf.cell(0, 8, "Состав партии", new_x="LMARGIN", new_y="NEXT")
    y = pdf.get_y()

    # Ширины колонок
    col_n = 12
    col_num = 65
    col_type = 60
    col_samples = 25
    total_w = col_n + col_num + col_type + col_samples

    # Заголовок таблицы
    pdf.set_font("main", size=FONT_SIZE_PT)
    pdf.set_fill_color(240, 240, 240)
    pdf.set_xy(MARGIN_MM, y)
    pdf.cell(col_n, HEADER_ROW_H_MM, "№", border=1, align="C", fill=True)
    pdf.cell(col_num, HEADER_ROW_H_MM, "Номер тары", border=1, fill=True)
    pdf.cell(col_type, HEADER_ROW_H_MM, "Тип тары", border=1, fill=True)
    pdf.cell(col_samples, HEADER_ROW_H_MM, "Проб", border=1, align="C", fill=True)
    y += HEADER_ROW_H_MM

    # Строки таблицы
    for idx, item in enumerate(items, start=1):
        container = item.container
        c_number = container.container_number or f"Без номера (ID {container.pk})"
        c_type = container.container_type.name if container.container_type else "—"
        samples_count = len(container.samples.all())

        # Проверка на разрыв страницы
        if y + ROW_H_MM > A4_H_MM - 40:
            pdf.add_page()
            y = MARGIN_MM

        pdf.set_xy(MARGIN_MM, y)
        pdf.cell(col_n, ROW_H_MM, str(idx), border=1, align="C")
        
        # Обрезка текста, чтобы не вылезло за границы
        num_val = _truncate_to_width(measurer, c_number, col_num - 4)
        pdf.cell(col_num, ROW_H_MM, num_val, border=1)
        
        type_val = _truncate_to_width(measurer, c_type, col_type - 4)
        pdf.cell(col_type, ROW_H_MM, type_val, border=1)
        
        pdf.cell(col_samples, ROW_H_MM, str(samples_count), border=1, align="C")
        y += ROW_H_MM

    return y + 10


def _draw_signatures(pdf: FPDF, y: float) -> None:
    """Рисует блок подписей."""
    if y + 30 > A4_H_MM:
        pdf.add_page()
        y = MARGIN_MM

    pdf.set_font("main", size=FONT_SIZE_PT)
    pdf.set_xy(MARGIN_MM, y)
    pdf.cell(80, ROW_H_MM, "Сдал: __________________ / __________________")
    
    pdf.set_xy(MARGIN_MM, y + 15)
    pdf.cell(80, ROW_H_MM, "Принял: ________________ / __________________")


def render_batch_companion_pdf(batch) -> BytesIO:
    """Генерирует PDF сопроводительного листа для партии."""
    _check_font()

    # Загружаем тары и пробы одним запросом (prefetch_related)
    items = list(
        batch.items
        .select_related("container", "container__container_type")
        .prefetch_related("container__samples")
        .order_by("position", "id")
    )
    
    total_samples = sum(len(item.container.samples.all()) for item in items)

    pdf = FPDF(orientation="P", unit="mm", format=(A4_W_MM, A4_H_MM))
    pdf.set_auto_page_break(auto=False)
    pdf.add_font("main", "", str(FONT_PATH))
    pdf.add_page()

    measurer = _make_measurer()

    y = _draw_header(pdf, batch)
    y = _draw_summary(pdf, len(items), total_samples, y)
    y = _draw_table(pdf, items, measurer, y)
    _draw_signatures(pdf, y)

    return BytesIO(bytes(pdf.output()))