"""
PDF-рендер QR-кодов для объектов топологии (Section, Cell).

Формат:
- A4 portrait (210 × 297 мм).
- Сетка 2 × 3 = 6 QR на лист.
- QR 65 × 65 мм, под ним адрес (10 мм) — шрифт 10 pt.
- Если элементов не влезает на один лист — новый лист.

Один общий сервис, единая раскладка. Одиночный режим (один QR
на лист) — вызывающий код просто передаёт один элемент.

Шрифт — `DejaVuSans.ttf` (тот же, что в этикетках).
QR-картинка — `qr_service.generate_qr_png`.
"""

from io import BytesIO

from fpdf import FPDF

from apps.labels.services.label_service import (
    A4_H_MM,
    A4_W_MM,
    FONT_PATH,
    _check_font,
)
from apps.labels.services.qr_service import generate_qr_png, make_payload


# --- Геометрия (мм) ---
QR_SIZE_MM = 65
ADDRESS_H_MM = 10
ADDRESS_GAP_MM = 1.5

COL_GAP_MM = 15
ROW_GAP_MM = 15

COLS = 2
ROWS = 3
PER_PAGE = COLS * ROWS

# Отступы рассчитываются так, чтобы сетка была по центру.
MARGIN_X_MM = (A4_W_MM - (COLS * QR_SIZE_MM + (COLS - 1) * COL_GAP_MM)) / 2
MARGIN_Y_MM = (A4_H_MM - (ROWS * (QR_SIZE_MM + ADDRESS_H_MM)
                          + (ROWS - 1) * ROW_GAP_MM)) / 2

FONT_SIZE_PT = 10


def _truncate_to_width(pdf: FPDF, text: str, max_mm: float) -> str:
    """Обрезает текст до max_mm (простая обрезка по символам)."""
    if not text:
        return ""
    if pdf.get_string_width(text) <= max_mm:
        return text
    ellipsis = "…"
    lo, hi = 0, len(text)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if pdf.get_string_width(text[:mid] + ellipsis) <= max_mm:
            lo = mid
        else:
            hi = mid - 1
    return text[:lo] + ellipsis


def _draw_item(
    pdf: FPDF,
    x: float,
    y: float,
    payload: str,
    address: str,
) -> None:
    """Один QR + адрес под ним."""
    qr_buf = generate_qr_png(payload, box_size=25, border=2)
    pdf.image(qr_buf, x=x, y=y, w=QR_SIZE_MM, h=QR_SIZE_MM)

    pdf.set_font("main", size=FONT_SIZE_PT)
    pdf.set_text_color(0, 0, 0)
    pdf.set_xy(x, y + QR_SIZE_MM + ADDRESS_GAP_MM)
    pdf.cell(
        QR_SIZE_MM,
        ADDRESS_H_MM,
        _truncate_to_width(pdf, address, QR_SIZE_MM),
        align="C",
    )


def render_topology_qr_pdf(
    items: list[dict],
) -> BytesIO:
    """
    Рендерит PDF с QR-кодами объектов топологии.

    :param items: список словарей
        `{"type": "SECTION" | "CELL", "id": <int>, "address": <str>}`.
        Для `CELL` адрес — обычно `full_address`; для `SECTION` —
        собранный из комнаты/стеллажа/секции.
    :returns: `BytesIO` с PDF (указатель в начале).
    """
    _check_font()

    pdf = FPDF(orientation="P", unit="mm", format=(A4_W_MM, A4_H_MM))
    pdf.set_auto_page_break(auto=False)
    pdf.add_font("main", "", str(FONT_PATH))

    if not items:
        pdf.add_page()
        return BytesIO(bytes(pdf.output()))

    for page_start in range(0, len(items), PER_PAGE):
        page_items = items[page_start:page_start + PER_PAGE]
        pdf.add_page()

        for idx, item in enumerate(page_items):
            col = idx % COLS
            row = idx // COLS
            x = MARGIN_X_MM + col * (QR_SIZE_MM + COL_GAP_MM)
            y = MARGIN_Y_MM + row * (QR_SIZE_MM + ADDRESS_H_MM + ROW_GAP_MM)

            payload = make_payload(item["type"], item["id"])
            _draw_item(pdf, x, y, payload, item.get("address", ""))

    return BytesIO(bytes(pdf.output()))