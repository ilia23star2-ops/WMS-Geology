"""
Парсер Excel-файлов приёмки от лабораторий.

Формат (решение 1.49 + уточнения receiving-1a):
- Один файл = одна лаборатория.
- Один лист = один участок.
- Строки = Н/З.
- Столбцы = типы исследования, разбитые на группы.
- Каждая группа типов заканчивается колонкой «Дата».
- Ячейки = количество тары; могут быть составными («1+1»).
- Даты в ячейке «Дата» могут быть списком через запятую
  («13.08,02.09,25.05»). Без года — подставляется текущий.

Колонка «Дата» закрывает текущую группу типов. Следующие
типы формируют новую группу с новой датой.

Пример:
    [Н/З] [ПА] [ААА] [Циан.] [ICP] [Дата] [АД] [ГД] [Дата]
           └────── группа 1 ──────┘      └─ группа 2 ─┘

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

# Коды ошибок (структурированные — чтобы UI мог различать).
ERR_MISSING_WORK_ORDER = "MISSING_WORK_ORDER_COLUMN"
ERR_UNKNOWN_TYPE = "UNKNOWN_RESEARCH_TYPE"
ERR_BAD_NUMBER = "BAD_COUNT_VALUE"
ERR_BAD_DATE = "BAD_DATE_VALUE"


def _normalize(value) -> str:
    """Нормализация строки: strip, lower, схлопывание пробелов."""
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower())


def _parse_one_date(s: str, default_year: int) -> date | None:
    """Одна дата. Форматы: YYYY-MM-DD, DD.MM.YYYY, DD.MM.YY,
    DD.MM, DD/MM/YYYY, DD-MM-YYYY."""
    s = s.strip()
    if not s:
        return None

    # ISO.
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        pass

    # С полным годом.
    for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue

    # С двузначным годом.
    for fmt in ("%d.%m.%y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue

    # Без года — парсим вручную, чтобы не ловить DeprecationWarning
    # про «day of month without year» (Python 3.15).
    parts = re.split(r"[./-]", s)
    if len(parts) == 2:
        try:
            day = int(parts[0])
            month = int(parts[1])
            return date(default_year, month, day)
        except (ValueError, TypeError):
            return None

    return None


def _parse_date_list(value, default_year: int | None = None) -> list[date]:
    """
    Список дат из ячейки.

    Поддерживает:
    - datetime/date из openpyxl;
    - строку с одной датой;
    - строку со списком через запятую или точку с запятой.
    """
    if default_year is None:
        default_year = date.today().year

    if value is None:
        return []
    if isinstance(value, datetime):
        return [value.date()]
    if isinstance(value, date):
        return [value]
    if not isinstance(value, str):
        return []

    s = value.strip()
    if not s:
        return []

    parts = [p.strip() for p in re.split(r"[,;]", s) if p.strip()]
    result: list[date] = []
    for part in parts:
        d = _parse_one_date(part, default_year)
        if d is not None:
            result.append(d)
    return result


def _parse_count(value) -> int | None:
    """
    Количество тары из ячейки.

    Поддерживает:
    - int / float;
    - строку с числом;
    - составное «1+1» (суммирует).
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        n = int(value)
        return n if n > 0 else None
    if not isinstance(value, str):
        return None

    s = value.strip()
    if not s:
        return None

    parts = [p.strip() for p in s.split("+")]
    total = 0
    for part in parts:
        try:
            total += int(float(part))
        except (ValueError, TypeError):
            return None
    return total if total > 0 else None


def parse_excel(
    source: Union[BytesIO, Path, str],
    research_type_codes: set[str] | None = None,
) -> ParsedWorkbook:
    """
    Парсит Excel-файл приёмки.

    :param source: BytesIO / путь к файлу (str или Path).
    :param research_type_codes: множество известных кодов типов
        (например, {"ШЛ", "ХА"}). Если None — все заголовки типов
        принимаются как есть.
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
    # Группы типов: список (type_cols, date_col_idx).
    # type_cols — список (col_idx, type_code).
    type_groups: list[tuple[list[tuple[int, str]], int | None]] = []
    # Буфер текущей группы: типы, ожидающие колонку «Дата».
    current_group: list[tuple[int, str]] = []

    for idx, header in enumerate(headers):
        norm = _normalize(header)
        if not norm:
            continue

        if norm in WORK_ORDER_HEADERS:
            work_order_idx = idx
            continue

        if norm in DATE_HEADERS:
            # Закрываем текущую группу (даже если она пустая).
            type_groups.append((current_group, idx))
            current_group = []
            continue

        if norm in NON_TYPE_HEADERS:
            continue

        # Тип исследования.
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
                    "code": ERR_UNKNOWN_TYPE,
                })
                continue
            current_group.append((idx, matched))
        else:
            current_group.append((idx, str(header).strip()))

    # Хвост без колонки «Дата» — своя группа с date=None.
    if current_group:
        type_groups.append((current_group, None))

    # Убираем пустые группы.
    type_groups = [(cols, di) for cols, di in type_groups if cols]

    if work_order_idx is None:
        errors.append({
            "sheet": sheet_name,
            "row": 1,
            "error": "Не найдена колонка Н/З",
            "code": ERR_MISSING_WORK_ORDER,
        })
        return sheet

    for row_num, row in enumerate(rows_iter, start=2):
        wo_value = (
            row[work_order_idx] if work_order_idx < len(row) else None
        )
        if _normalize(wo_value) == "":
            continue

        parsed_row = ParsedRow(
            work_order_number=str(wo_value).strip(),
        )

        for type_cols, date_col_idx in type_groups:
            # Даты группы — из колонки «Дата» этой группы.
            group_dates: list[date] = []
            if date_col_idx is not None and date_col_idx < len(row):
                group_dates = _parse_date_list(row[date_col_idx])

            for col_idx, type_code in type_cols:
                if col_idx >= len(row):
                    continue
                raw = row[col_idx]
                count = _parse_count(raw)
                if count is None:
                    continue

                parsed_row.cells.append(ParsedCell(
                    research_type_code=type_code,
                    containers_count=count,
                    dates=list(group_dates),
                ))

        if parsed_row.cells:
            sheet.rows.append(parsed_row)

    return sheet