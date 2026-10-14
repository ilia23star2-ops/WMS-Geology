"""
Типы данных парсера приёмки.

Промежуточное представление результатов парсинга файла Excel.
Не привязано к Django-моделям — парсер тестируется без БД.

Изменения (receiving-1a):
- `ParsedCell.dates: list[date]` — вместо одного поля `date`.
  Это отражает реальный формат: в одной ячейке Excel может быть
  список дат через запятую («13.08,02.09,25.05»). Одна дата в
  списке = однозначный случай; несколько = спорный, разбирается
  на уровне сервиса.

Изменения (receiving-1a-2):
- `ParsedCell.container_type_name` — имя типа тары (Ящики,
  Биг-бэг, Коробка, …). Обязательно; если в файле для колонки
  типа нет типа тары — ошибка парсинга.
- `ParsedSheet.header_row_number` — номер строки, где найдены
  заголовки (для диагностики).
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Optional


@dataclass
class ParsedCell:
    """
    Одна ячейка строки: тип исследования + количество тары +
    тип тары + даты.

    `container_type_name` — имя типа тары из второй строки
    заголовков. Обязательно.

    `dates`:
    - пустой список — дата не указана в файле;
    - одна дата — однозначно;
    - несколько дат — спорный случай (список через запятую).
    """

    research_type_code: str
    containers_count: int
    container_type_name: str
    dates: list[date] = field(default_factory=list)


@dataclass
class ParsedRow:
    """Одна строка листа: Н/З + список ячеек по типам."""

    work_order_number: str
    cells: list[ParsedCell] = field(default_factory=list)


@dataclass
class ParsedSheet:
    """Один лист: участок + список строк."""

    sheet_name: str
    site_code: Optional[str] = None
    site_name: str = ""
    header_row_number: Optional[int] = None
    rows: list[ParsedRow] = field(default_factory=list)


@dataclass
class ParsedWorkbook:
    """
    Результат парсинга всего файла.

    `sheets` — успешно распарсенные листы.
    `errors` — список ошибок: [{sheet, row, column, error, ...}].
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