"""
Парсер Excel-файлов приёмки от лабораторий.

Формат (решение 1.49):
- Один файл = одна лаборатория.
- Один лист = один участок.
- Строки = Н/З.
- Столбцы = типы исследования (ШЛ, ХА, ИЗ).
- Ячейки = количество тары.
- Дата — правый столбец.

Заголовки гибкие:
- Первая колонка: «Н/З», «Наряд», «Наряд-заказ».
- Последняя колонка: «Дата».
- Промежуточные — типы исследования (code из справочника
  ResearchType).

Парсер не обращается к БД. Список известных кодов типов
передаётся снаружи (`research_type_codes`).
"""

import re
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Union

from openpyxl import load_workbook

from .types import ParsedCell, ParsedRow, ParsedSheet, ParsedWorkbook

WORK_ORDER_HEADERS = {
    "н/з", "наряд", "наряд-заказ", "наряд заказ", "нз",
}
DATE_HEADERS = {"дата", "date"}
NON_TYPE_HEADERS = WORK_ORDER_HEADERS | DATE_HEADERS | {"№", "no", "n"}


def _normalize(value) -> str:
    """Нормализация строки: strip, lower, схлопывание пробелов."""
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower())


def _parse_date(value) -> date | None:
    """Парсинг даты из ячейки Excel (datetime, date, строка)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        s = value.strip()
        for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
    return None


def parse_excel(
    source: Union[BytesIO, Path, str],
    research_type_codes: set[str] | None = None,
) -> ParsedWorkbook:
    """
    Парсит Excel-файл приёмки.

    :param source: BytesIO / путь к файлу (str или Path).
    :param research_type_codes: множество известных кодов типов
        (например, {"ШЛ", "ХА"}). Если None — все промежуточные
        заголовки принимаются за типы.
    :returns: ParsedWorkbook.
    """
    wb = load_workbook(source, data_only=True, read_only=True)
    result = ParsedWorkbook()

    try:
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            parsed_sheet = _parse_sheet(
                ws, sheet_name, research_type_codes, result.errors,
            )
            if parsed_sheet.rows:
                result.sheets.append(parsed_sheet)
    finally:
        wb.close()

    return result


def _parse_sheet(
    ws,
    sheet_name: str,
    research_type_codes: set[str] | None,
    errors: list[dict],
) -> ParsedSheet:
    """Парсит один лист книги."""
    sheet = ParsedSheet(sheet_name=sheet_name, site_name=sheet_name)

    rows_iter = ws.iter_rows(values_only=True)
    try:
        headers = next(rows_iter)
    except StopIteration:
        return sheet

    work_order_idx: int | None = None
    date_idx: int | None = None
    type_columns: list[tuple[int, str]] = []

    for idx, header in enumerate(headers):
        norm = _normalize(header)
        if not norm:
            continue
        if norm in WORK_ORDER_HEADERS:
            work_order_idx = idx
        elif norm in DATE_HEADERS:
            date_idx = idx
        elif norm in NON_TYPE_HEADERS:
            continue
        else:
            if research_type_codes is not None:
                matched = next(
                    (c for c in research_type_codes
                     if _normalize(c) == norm),
                    None,
                )
                if matched is None:
                    errors.append({
                        "sheet": sheet_name,
                        "row": 1,
                        "column": idx,
                        "error": f"Неизвестный тип исследования: {header}",
                    })
                    continue
                type_columns.append((idx, matched))
            else:
                type_columns.append((idx, str(header).strip()))

    if work_order_idx is None:
        errors.append({
            "sheet": sheet_name,
            "row": 1,
            "error": "Не найдена колонка Н/З",
        })
        return sheet

    for row_num, row in enumerate(rows_iter, start=2):
        wo_value = row[work_order_idx] if work_order_idx < len(row) else None
        if _normalize(wo_value) == "":
            continue

        parsed_row = ParsedRow(work_order_number=str(wo_value).strip())

        if date_idx is not None and date_idx < len(row):
            parsed_row.date = _parse_date(row[date_idx])

        for col_idx, type_code in type_columns:
            if col_idx >= len(row):
                continue
            value = row[col_idx]
            if value is None or value == "":
                continue
            try:
                count = int(value)
            except (ValueError, TypeError):
                errors.append({
                    "sheet": sheet_name,
                    "row": row_num,
                    "column": col_idx,
                    "error": f"Не удалось преобразовать в число: {value}",
                })
                continue
            if count <= 0:
                continue
            parsed_row.cells.append(ParsedCell(
                research_type_code=type_code,
                containers_count=count,
            ))

        if parsed_row.cells:
            sheet.rows.append(parsed_row)

    return sheet