"""Тесты канонизатора OCR-токенов (canon.py)."""
from apps.ocr.services.canon import canon_text, fix_digits, snap_prefix


def test_canon_text_upper_and_homoglyphs():
    assert canon_text("ТЗТ") == "TST"


def test_canon_text_double_t_left_for_snap():
    # П→T и Т→T дают TTST; до TST его довёдет snap_prefix (Левенштейн 1)
    assert canon_text("ПтST") == "TTST"


def test_canon_text_drops_soft_sign():
    assert canon_text("ЬTST") == "TST"


def test_snap_prefix_fixes_short_prefix():
    assert snap_prefix("ST", ("TST",)) == "TST"


def test_snap_prefix_fixes_double_t():
    assert snap_prefix("TTST", ("TST",)) == "TST"


def test_snap_prefix_leaves_far_prefix():
    assert snap_prefix("ABC", ("TST",)) == "ABC"


def test_snap_prefix_without_dictionary():
    assert snap_prefix("ST", ()) == "ST"


def test_fix_digits_replaces_letters():
    assert fix_digits("OIL", True) == "011"


def test_fix_digits_leading_t_after_prefix():
    assert fix_digits("T3209", True) == "13209"


def test_fix_digits_keeps_t_without_prefix():
    assert fix_digits("T3209", False) == "T3209"


def test_fix_digits_keeps_normal_digits():
    assert fix_digits("13209", True) == "13209"