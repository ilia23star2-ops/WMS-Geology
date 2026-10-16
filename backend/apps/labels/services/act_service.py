"""
Сервис рендера PDF «Акт приёмки» (пачка 3f-1).

Акт формируется по завершённой партии `Receipt` (`status=CONFIRMED`).
Содержимое:
- шапка (номер партии, дата, рейс, лаборатория, участок);
- сводка (всего / принято / не пришло / прочее);
- таблица неприехавших `ReceiptItem` (`status=MISSING`);
- подписи.

Формат: A4 portrait, шрифт `DejaVuSans.ttf` — тот же, что в этикетках.
Переиспользует `FONT_PATH`, `_check_font` и `_truncate_to_width`
из `label_service` (приватные — сознательно, чтобы не дублировать
код измерения; при рефакторинге можно вынести в общий модуль).
"""

from io import BytesIO

from fpdf import FPDF

from apps.receiving.models import Receipt, ReceiptItem

from .label_service import (
    A4_H_MM,
    A4_W_MM,
    FONT_PATH,
    _check_font,
    _truncate_to_width,
)


# --- Геометрия акта (мм) ---
MARGIN_MM = 15
CONTENT_W_MM = A4_W_MM - 2 * MARGIN_MM   # 180

TITLE_H_MM = 10
META_LINE_H_MM = 6
SECTION_GAP_MM = 4

TABLE_ROW_H_MM = 6
TABLE_HEADER_H_MM = 7

FONT_SIZE_PT = 10
FONT_SIZE_TITLE_PT = 14

# --- Колонки таблицы «не приехало» (сумма = 180) ---
COL_NUM_W_MM = 12
COL_SITE_W_MM = 38
COL_WO_W_MM = 45
COL_RT_W_MM = 20
COL_CT_W_MM = 45
COL_COUNT_W_MM = 20


# ============================================================
# Вспомогательные
# ============================================================
def _fmt_date(value) -> str:
    """Формат даты `DD.MM.YYYY` или «—»."""
    if not value:
        return "—"
    return value.strftime("%d.%m.%Y")


def _collect_summary(receipt: Receipt) -> dict:
    """Сводка по строкам партии."""
    items = list(receipt.items.all())
    total = len(items)
    matched = sum(
        1 for it in items if it.status == ReceiptItem.STATUS_MATCHED
    )
    missing = sum(
        1 for it in items if it.status == ReceiptItem.STATUS_MISSING
    )
    other = total - matched - missing
    return {
        "total": total,
        "matched": matched,
        "missing": missing,
        "other": other,
        "missing_items": [
            it for it in items
            if it.status == ReceiptItem.STATUS_MISSING
        ],
    }


# ============================================================
# Отрисовка блоков
# ============================================================
def _draw_title(pdf: FPDF, receipt: Receipt) -> None:
    pdf.set_font("main", size=FONT_SIZE_TITLE_PT)
    pdf.set_xy(MARGIN_MM, MARGIN_MM)
    pdf.cell(
        CONTENT_W_MM,
        TITLE_H_MM,
        f"АКТ ПРИЁМКИ № {receipt.receipt_number}",
        align="C",
    )
    pdf.ln(TITLE_H_MM)


def _draw_meta(pdf: FPDF, receipt: Receipt) -> None:
    pdf.set_font("main", size=FONT_SIZE_PT)

    shipment_label = "—"
    if receipt.shipment_id and receipt.shipment is not None:
        shipment_label = receipt.shipment.shipment_number

    lab_label = receipt.laboratory.name if receipt.laboratory_id else "—"
    site_label = receipt.site.name if receipt.site_id else "—"

    rows = [
        ("Дата рейса:", _fmt_date(receipt.expected_date)),
        ("Рейс:", shipment_label),
        ("Лаборатория:", lab_label),
        ("Участок:", site_label),
    ]
    for label, value in rows:
        pdf.set_x(MARGIN_MM)
        pdf.cell(40, META_LINE_H_MM, label)
        pdf.cell(CONTENT_W_MM - 40, META_LINE_H_MM, value)
        pdf.ln(META_LINE_H_MM)


def _draw_summary(pdf: FPDF, summary: dict) -> None:
    pdf.set_font("main", size=FONT_SIZE_PT)

    pdf.set_x(MARGIN_MM)
    pdf.cell(CONTENT_W_MM, META_LINE_H_MM, "Сводка:")
    pdf.ln(META_LINE_H_MM)

    lines = [
        ("Всего тар:", str(summary["total"])),
        ("Принято:", str(summary["matched"])),
        ("Не пришло:", str(summary["missing"])),
    ]
    if summary["other"]:
        lines.append(("Прочее:", str(summary["other"])))

    for label, value in lines:
        pdf.set_x(MARGIN_MM + 5)
        pdf.cell(50, META_LINE_H_MM, label)
        pdf.cell(CONTENT_W_MM - 55, META_LINE_H_MM, value)
        pdf.ln(META_LINE_H_MM)


def _draw_table_header(pdf: FPDF) -> None:
    pdf.set_font("main", size=FONT_SIZE_PT)
    headers = [
        ("№", COL_NUM_W_MM),
        ("Участок", COL_SITE_W_MM),
        ("Н/З (вх.)", COL_WO_W_MM),
        ("Иссл.", COL_RT_W_MM),
        ("Тип тары", COL_CT_W_MM),
        ("Кол-во", COL_COUNT_W_MM),
    ]
    pdf.set_x(MARGIN_MM)
    for text, w in headers:
        pdf.cell(w, TABLE_HEADER_H_MM, text, border=1)
    pdf.ln(TABLE_HEADER_H_MM)


def _draw_missing_table(pdf: FPDF, items: list) -> None:
    pdf.set_font("main", size=FONT_SIZE_PT)

    pdf.set_x(MARGIN_MM)
    pdf.cell(CONTENT_W_MM, META_LINE_H_MM, "Не приехало:")
    pdf.ln(META_LINE_H_MM)

    _draw_table_header(pdf)

    if not items:
        pdf.set_x(MARGIN_MM)
        pdf.cell(CONTENT_W_MM, TABLE_ROW_H_MM, "Расхождений нет.", border=1)
        pdf.ln(TABLE_ROW_H_MM)
        return

    for idx, it in enumerate(items, start=1):
        site_name = (
            it.site.name if it.site_id
            else (it.expected_site_code or "—")
        )
        wo = it.expected_work_order_number or "—"
        rt = it.expected_research_type_code or "—"
        ct = it.container_type.name if it.container_type_id else "—"

        cells = [
            (str(idx), COL_NUM_W_MM),
            (
                _truncate_to_width(pdf, site_name, COL_SITE_W_MM - 2),
                COL_SITE_W_MM,
            ),
            (
                _truncate_to_width(pdf, wo, COL_WO_W_MM - 2),
                COL_WO_W_MM,
            ),
            (rt, COL_RT_W_MM),
            (
                _truncate_to_width(pdf, ct, COL_CT_W_MM - 2),
                COL_CT_W_MM,
            ),
            ("1", COL_COUNT_W_MM),
        ]
        pdf.set_x(MARGIN_MM)
        for text, w in cells:
            pdf.cell(w, TABLE_ROW_H_MM, text, border=1)
        pdf.ln(TABLE_ROW_H_MM)


def _draw_signatures(pdf: FPDF) -> None:
    pdf.ln(10)
    pdf.set_font("main", size=FONT_SIZE_PT)
    pdf.set_x(MARGIN_MM)
    half = CONTENT_W_MM / 2
    pdf.cell(half, META_LINE_H_MM, "Сдал: ______________________")
    pdf.cell(half, META_LINE_H_MM, "Принял: ______________________")
    pdf.ln(META_LINE_H_MM)


# ============================================================
# Публичный API
# ============================================================
def render_receipt_act(receipt: Receipt) -> BytesIO:
    """
    Рендерит PDF «Акт приёмки» для завершённой партии.

    :param receipt: экземпляр `Receipt` (ожидается `status=CONFIRMED`).
    :returns: `BytesIO` с PDF (указатель в начале).
    """
    _check_font()

    pdf = FPDF(orientation="P", unit="mm", format=(A4_W_MM, A4_H_MM))
    pdf.set_auto_page_break(auto=True, margin=MARGIN_MM)
    pdf.add_font("main", "", str(FONT_PATH))
    pdf.add_page()

    _draw_title(pdf, receipt)
    pdf.ln(SECTION_GAP_MM)

    _draw_meta(pdf, receipt)
    pdf.ln(SECTION_GAP_MM)

    summary = _collect_summary(receipt)
    _draw_summary(pdf, summary)
    pdf.ln(SECTION_GAP_MM)

    _draw_missing_table(pdf, summary["missing_items"])
    _draw_signatures(pdf)

    return BytesIO(bytes(pdf.output()))