"""
Тесты парсера Excel-файлов приёмки.

Покрывают:
- простой файл (1 лист, 2 Н/З);
- пустые ячейки — пропускаются;
- несколько листов;
- неизвестный тип исследования;
- разные форматы даты;
- отсутствие колонки Н/З;
- пустые строки — пропускаются;
- нечисловое значение в ячейке;
- альтернативные названия колонки Н/З;
- нулевое количество — пропускается;
- пустой файл.
"""

from datetime import date
from io import BytesIO

from openpyxl import Workbook

from apps.receiving.parsers import parse_excel


def _make_xlsx(rows: list[list], sheet_name: str = "Тестовый") -> BytesIO:
    """Создаёт XLSX-файл в памяти с одним листом."""
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def test_parse_simple_file():
    """Простой файл: 1 лист, 2 Н/З, типы ШЛ и ХА."""
    f = _make_xlsx([
        ["Наряд", "ШЛ", "ХА", "Дата"],
        ["Тест001", 5, 3, "2026-10-08"],
        ["Тест002", 2, 4, "2026-10-09"],
    ])
    result = parse_excel(f)
    assert len(result.sheets) == 1
    assert len(result.sheets[0].rows) == 2
    assert result.sheets[0].rows[0].work_order_number == "Тест001"
    assert len(result.sheets[0].rows[0].cells) == 2
    assert result.sheets[0].rows[0].cells[0].research_type_code == "ШЛ"
    assert result.sheets[0].rows[0].cells[0].containers_count == 5


def test_parse_with_empty_cells():
    """Пустые ячейки — пропускаются."""
    f = _make_xlsx([
        ["Наряд", "ШЛ", "ХА", "Дата"],
        ["Тест001", 5, None, "2026-10-08"],
    ])
    result = parse_excel(f)
    assert len(result.sheets[0].rows[0].cells) == 1
    assert result.sheets[0].rows[0].cells[0].research_type_code == "ШЛ"


def test_parse_multiple_sheets():
    """Несколько листов — несколько участков."""
    wb = Workbook()
    ws1 = wb.active
    ws1.title = "Тестовый"
    ws1.append(["Наряд", "ШЛ", "Дата"])
    ws1.append(["Тест001", 5, "2026-10-08"])

    ws2 = wb.create_sheet("Северный")
    ws2.append(["Наряд", "ШЛ", "Дата"])
    ws2.append(["Сев001", 3, "2026-10-08"])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    result = parse_excel(buf)
    assert len(result.sheets) == 2
    assert result.sheets[0].sheet_name == "Тестовый"
    assert result.sheets[1].sheet_name == "Северный"


def test_parse_with_unknown_type():
    """Неизвестный тип — записывается в errors, парсинг продолжается."""
    f = _make_xlsx([
        ["Наряд", "ШЛ", "НЕИЗВ", "Дата"],
        ["Тест001", 5, 3, "2026-10-08"],
    ])
    result = parse_excel(f, research_type_codes={"ШЛ", "ХА"})
    assert len(result.errors) == 1
    assert "НЕИЗВ" in result.errors[0]["error"]
    assert len(result.sheets[0].rows[0].cells) == 1


def test_parse_with_different_date_formats():
    """Разные форматы даты обрабатываются."""
    f = _make_xlsx([
        ["Наряд", "ШЛ", "Дата"],
        ["Тест001", 5, "08.10.2026"],
        ["Тест002", 3, "2026-10-09"],
    ])
    result = parse_excel(f)
    assert result.sheets[0].rows[0].date == date(2026, 10, 8)
    assert result.sheets[0].rows[1].date == date(2026, 10, 9)


def test_parse_no_work_order_column():
    """Без колонки Н/З — ошибка, лист пропускается."""
    f = _make_xlsx([
        ["Что-то", "ШЛ", "Дата"],
        ["x", 5, "2026-10-08"],
    ])
    result = parse_excel(f)
    assert len(result.errors) >= 1
    assert "колонка Н/З" in result.errors[0]["error"]
    assert result.sheets == []


def test_parse_skips_empty_rows():
    """Пустые строки пропускаются."""
    f = _make_xlsx([
        ["Наряд", "ШЛ", "Дата"],
        ["Тест001", 5, "2026-10-08"],
        [None, None, None],
        ["Тест002", 3, "2026-10-09"],
    ])
    result = parse_excel(f)
    assert len(result.sheets[0].rows) == 2


def test_parse_total_containers():
    """Свойства total_containers и total_rows считают суммы."""
    f = _make_xlsx([
        ["Наряд", "ШЛ", "ХА", "Дата"],
        ["Тест001", 5, 3, "2026-10-08"],
        ["Тест002", 2, 4, "2026-10-09"],
    ])
    result = parse_excel(f)
    assert result.total_containers == 14
    assert result.total_rows == 2


def test_parse_invalid_number_in_cell():
    """Нечисловое значение — ошибка, парсинг продолжается."""
    f = _make_xlsx([
        ["Наряд", "ШЛ", "Дата"],
        ["Тест001", "abc", "2026-10-08"],
        ["Тест002", 3, "2026-10-09"],
    ])
    result = parse_excel(f)
    assert len(result.errors) >= 1
    assert len(result.sheets[0].rows) == 1
    assert result.sheets[0].rows[0].work_order_number == "Тест002"


def test_parse_alt_work_order_headers():
    """Альтернативные названия колонки Н/З."""
    for header in ["Н/З", "Наряд-Заказ", "наряд заказ", "НЗ"]:
        f = _make_xlsx([
            [header, "ШЛ", "Дата"],
            ["Тест001", 5, "2026-10-08"],
        ])
        result = parse_excel(f)
        assert len(result.sheets[0].rows) == 1, (
            f"Header '{header}' не распознан"
        )


def test_parse_zero_count_skipped():
    """Нулевое количество — ячейка пропускается."""
    f = _make_xlsx([
        ["Наряд", "ШЛ", "ХА", "Дата"],
        ["Тест001", 0, 5, "2026-10-08"],
    ])
    result = parse_excel(f)
    assert len(result.sheets[0].rows[0].cells) == 1
    assert result.sheets[0].rows[0].cells[0].research_type_code == "ХА"


def test_parse_empty_file():
    """Файл без данных — пустой результат."""
    f = _make_xlsx([["Наряд", "ШЛ", "Дата"]])
    result = parse_excel(f)
    assert result.sheets == []
    assert result.errors == []