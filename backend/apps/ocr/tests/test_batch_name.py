"""Тесты имени пакета OCR (6e-3-backend)."""
from datetime import date

from apps.ocr.services.batch_name import display_name, make_batch_name


def test_name_with_cell_address():
    assert make_batch_name("A-01-02", date(2026, 11, 19)) == "A-01-02 2026-11-19"


def test_name_without_cell_address():
    assert make_batch_name(None, date(2026, 11, 19)) == "OCR 2026-11-19"
    assert make_batch_name("", date(2026, 11, 19)) == "OCR 2026-11-19"


def test_name_strips_spaces():
    assert make_batch_name("  A-01-02  ", date(2026, 1, 5)) == "A-01-02 2026-01-05"


def test_display_name_falls_back_to_id():
    assert display_name("Моя тара", 7) == "Моя тара"
    assert display_name("", 7) == "Пакет #7"
    assert display_name(None, None) == "Пакет"