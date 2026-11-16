"""Тесты 6j: valid_prefixes фильтр, ST→TST коррекция, fallback Н/З."""
from apps.ocr.services.mapping import extract_fields, _fix_prefix, _fix_ocr_digits


def _ocr(text: str) -> dict:
    return {"words": [], "text": text}


_VP = {"TST", "BRS"}


# -------------------- _fix_prefix --------------------

def test_fix_prefix_ST_to_TST():
    assert _fix_prefix("ST120902", _VP) == "TST120902"


def test_fix_prefix_already_valid():
    assert _fix_prefix("TST120902", _VP) == "TST120902"


def test_fix_prefix_too_far():
    """XXXX — distance >1 от TST/BRS — не трогаем."""
    assert _fix_prefix("XXXX120902", _VP) == "XXXX120902"


# -------------------- extract_fields: Н/З prefix filter --------------------

def test_work_order_ilm11_rejected():
    """ILM11 — не валидный prefix (ILM ≠ TST/BRS), Н/З не пишется.

    В тексте НЕТ TST1209 — только ILM11 + пробы.
    """
    text = "ILM11 TST120901 TST120902"
    result = extract_fields([], _ocr(text), valid_prefixes=_VP)
    # ILM11 отброшен (нет валидного prefix), Н/З = None.
    assert result["work_order_coded"] is None
    # Пробы TST120901/2 — в samples.
    assert "TST120901" in result["samples"]
    assert "TST120902" in result["samples"]


def test_work_order_tst_kept():
    """TST1209 — валидный prefix, записан как Н/З."""
    text = "TST1209 TST120901 TST120902"
    result = extract_fields([], _ocr(text), valid_prefixes=_VP)
    assert result["work_order_coded"] == "TST1209"


def test_samples_ST_to_TST():
    """ST120902 → TST120902 через _fix_prefix."""
    text = "ST120902 ST120910 TST120903"
    result = extract_fields([], _ocr(text), valid_prefixes=_VP)
    assert "TST120902" in result["samples"]
    assert "TST120910" in result["samples"]
    assert "TST120903" in result["samples"]
    assert "ST120902" not in result["samples"]
    assert "ST120910" not in result["samples"]


def test_work_order_real_task_10_no_ilm():
    """Реальный task #10 (без TST1209 в тексте после фикса ILM11)."""
    text = "ILmll TST120901 TST120902 TST120903"
    result = extract_fields([], _ocr(text), valid_prefixes=_VP)
    # ILmll — без цифр, не _WORK_ORDER_RE. Н/З = None.
    assert result["work_order_coded"] is None
    assert len(result["samples"]) == 3