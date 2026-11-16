"""Тесты fuzzy match справочников в extract_fields (6a-fix5a).

Справочники передаются как list[dict] — pure-Python, без БД.
Site: {"code", "name", "match_patterns"}
ResearchType: {"code", "name"}
ContainerType: {"name"}
"""
from apps.ocr.services.mapping import extract_fields

_SITES = [
    {"code": "TST", "name": "Тестовый участок", "match_patterns": ["TST", "Тест"]},
    {"code": "BRS", "name": "Березовский", "match_patterns": ["BRS", "Берез"]},
]
_RTS = [
    {"code": "ICP", "name": "ICP"},
    {"code": "ШЛ", "name": "Шлифы"},
]
_CTS = [
    {"name": "Ящик"},
    {"name": "Коробка"},
    {"name": "Биг-бэг"},
]


def _ocr(text: str) -> dict:
    return {"words": [], "text": text}


def test_find_site_by_match_pattern():
    result = extract_fields([], _ocr("Тестовый участок, Н/З TST1234"), sites=_SITES)
    assert result["site"] == "TST"


def test_find_site_by_code():
    result = extract_fields([], _ocr("BRS что-то"), sites=_SITES)
    assert result["site"] == "BRS"


def test_find_site_none():
    result = extract_fields([], _ocr("Неизвестный участок"), sites=_SITES)
    assert result["site"] is None


def test_find_research_type_by_code():
    result = extract_fields([], _ocr("Исл: ICP"), research_types=_RTS)
    assert result["research_type"] == "ICP"


def test_find_research_type_by_name():
    result = extract_fields([], _ocr("шлифы на анализ"), research_types=_RTS)
    assert result["research_type"] == "ШЛ"


def test_find_container_type_exact():
    result = extract_fields([], _ocr("Коробка с пробами"), container_types=_CTS)
    assert result["container_type"] == "Коробка"


def test_find_container_type_root():
    """Тип «Ящик» в тексте «Ящики» — root-match."""
    result = extract_fields([], _ocr("Тип: Ящики"), container_types=_CTS)
    assert result["container_type"] == "Ящик"


def test_fuzzy_full_label():
    """Реальная этикетка: все поля + fuzzy."""
    text = (
        "Тестовый участок Н/З TST1234 Исл: ICP "
        "Тип: Ящики 1 TST1234501 TST1234502 TST1234503"
    )
    result = extract_fields(
        [], _ocr(text),
        sites=_SITES, research_types=_RTS, container_types=_CTS,
    )
    assert result["site"] == "TST"
    assert result["research_type"] == "ICP"
    assert result["container_type"] == "Ящик"
    assert result["work_order_coded"] == "TST1234"
    assert len(result["samples"]) == 3
    assert result["source"] == "fallback"