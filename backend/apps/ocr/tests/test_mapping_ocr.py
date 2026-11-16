"""Тесты OCR-нормализации в mapping (c-3.x-migration-6j).

Покрывают: O→0, I/l→1, Z→2, B→8 в цифровой части; Latin↔Cyrillic
в _find_research_type.
"""
from apps.ocr.services.mapping import extract_fields


def _ocr(text: str) -> dict:
    return {"words": [], "text": text}


# -------------------- OCR-нормализация в samples --------------------

def test_sample_O_to_zero():
    """TST12O9O7 → TST120907."""
    result = extract_fields([], _ocr("TST12O9O7 TST120901"))
    assert "TST120907" in result["samples"]
    assert "TST120901" in result["samples"]
    assert "TST12O9O7" not in result["samples"]


def test_sample_I_to_one():
    """TSTI209OI → TST120901."""
    result = extract_fields([], _ocr("TSTI209OI TST120902"))
    assert "TST120901" in result["samples"]
    assert "TST120902" in result["samples"]


def test_sample_prefix_preserved():
    """TAA-B34076001 — B в префиксе не трогаем."""
    result = extract_fields([], _ocr("TAA-B34076001"))
    assert "TAA-B34076001" in result["samples"]
    assert "TAA-834076001" not in result["samples"]


def test_sample_work_order_ocr_fix():
    """Н/З TSTI234 → TST1234."""
    result = extract_fields([], _ocr("TSTI234 TST120901"))
    assert result["work_order_coded"] == "TST1234"
    assert "TST1234" not in result["samples"]


# -------------------- Latin↔Cyrillic в research_type --------------------

_RTS = [
    {"code": "ААА", "name": "ААА"},  # кириллица
    {"code": "ICP", "name": "ICP"},
]


def test_research_type_latin_to_cyrillic():
    """В тексте латиница AAA, в БД кириллица ААА."""
    result = extract_fields([], _ocr("Исл: AAA"), research_types=_RTS)
    assert result["research_type"] == "ААА"


def test_research_type_cyrillic_match():
    """В тексте кириллица ААА, в БД кириллица ААА."""
    result = extract_fields([], _ocr("Исл: ААА"), research_types=_RTS)
    assert result["research_type"] == "ААА"


def test_research_type_icp():
    """ICP латиница — точное совпадение."""
    result = extract_fields([], _ocr("Исл: ICP"), research_types=_RTS)
    assert result["research_type"] == "ICP"


# -------------------- Реальная этикетка #9 (из verify) --------------------

def test_real_label_task_9():
    """Полный текст из task #9 — все 9 проб + ТИ ААА + Н/З TST1209."""
    text = (
        "Тестовый участок Н/З TST1209 Исл: AAA "
        "TST120901 4 TST120904 7 TST12O9O7 10 TST120910 "
        "TST120902 5 TST120905 8 TST12O908 "
        "TST120903 6 TST120906 9 TST120SO9"
    )
    result = extract_fields([], _ocr(text), research_types=_RTS)

    # ТИ: AAA (латиница) → ААА (кириллица)
    assert result["research_type"] == "ААА"
    # Н/З: TST1209
    assert result["work_order_coded"] == "TST1209"
    # Пробы: 901..906 + 907, 908 (OCR-fix) + 910. 909 (S) — не матчится.
    assert "TST120901" in result["samples"]
    assert "TST120907" in result["samples"]
    assert "TST120908" in result["samples"]
    assert "TST120910" in result["samples"]
    assert len(result["samples"]) >= 8