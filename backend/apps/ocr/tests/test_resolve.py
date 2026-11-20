"""Тесты резолвера значений зон (resolve.py)."""
from apps.ocr.services.resolve import resolve_by_code, resolve_by_number


def test_resolve_site_canonical_hit():
    r = resolve_by_code("site", "ТЗТ", ("TST", "AAA"))
    assert r.resolved and r.value == "TST"


def test_resolve_site_snap_prefix_hit():
    r = resolve_by_code("site", "ST", ("TST",))
    assert r.resolved and r.value == "TST"


def test_resolve_site_miss_needs_input():
    r = resolve_by_code("site", "QQQ", ("TST",))
    assert not r.resolved and r.needs_input


def test_resolve_site_ambiguous_needs_input():
    r = resolve_by_code("site", "TST", ("TST", "TST"))
    assert not r.resolved and r.needs_input


def test_resolve_number_digit_fix_hit():
    r = resolve_by_number("work_order_incoming", "132O9", ("13209",))
    assert r.resolved and r.value == "13209"


def test_resolve_number_miss_needs_input():
    r = resolve_by_number("work_order_incoming", "999", ("13209",))
    assert not r.resolved and r.needs_input