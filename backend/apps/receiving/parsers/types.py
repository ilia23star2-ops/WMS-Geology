"""
Типы данных парсера приёмки.

Промежуточное представление результатов парсинга файла Excel.
Не привязано к Django-моделям — парсер тестируется без БД.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Optional


@dataclass
class ParsedCell:
    """Одна ячейка строки: тип исследования + количество тары."""

    research_type_code: str
    containers_count: int


@dataclass
class ParsedRow:
    """Одна строка листа: Н/З + список ячеек по типам + дата."""

    work_order_number: str
    date: Optional[date] = None
    cells: list[ParsedCell] = field(default_factory=list)


@dataclass
class ParsedSheet:
    """Один лист: участок + список строк."""

    sheet_name: str
    site_code: Optional[str] = None
    site_name: str = ""
    rows: list[ParsedRow] = field(default_factory=list)


@dataclass
class ParsedWorkbook:
    """
    Результат парсинга всего файла.

    `sheets` — успешно распарсенные листы.
    `errors` — список ошибок: [{sheet, row, column, error}].
    """

    sheets: list[ParsedSheet] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)

    @property
    def total_rows(self) -> int:
        """Общее количество строк (Н/З)."""
        return sum(len(s.rows) for s in self.sheets)

    @property
    def total_containers(self) -> int:
        """Общее количество тары по всем ячейкам."""
        return sum(
            c.containers_count
            for s in self.sheets
            for r in s.rows
            for c in r.cells
        )