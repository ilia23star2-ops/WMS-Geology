"""
Тесты генератора QR.

Покрывают:
- make_payload: формат, валидация.
- generate_qr_png: BytesIO, PNG-сигнатура, разные размеры.
- generate_qr_svg: строка, содержит SVG.
- Ошибки на пустом payload / невалидном entity_id.
"""

import pytest

from apps.labels.services import (
    generate_qr_png,
    generate_qr_svg,
    make_payload,
)


# ============================================================
# make_payload
# ============================================================
def test_make_payload_container():
    """Payload для тары."""
    assert make_payload("CONTAINER", 123) == "WMSG:CONTAINER:123"


def test_make_payload_lowercase_type():
    """Тип приводится к верхнему регистру."""
    assert make_payload("container", 5) == "WMSG:CONTAINER:5"


def test_make_payload_all_types():
    """Все поддерживаемые типы."""
    assert make_payload("CELL", 1) == "WMSG:CELL:1"
    assert make_payload("SECTION", 2) == "WMSG:SECTION:2"
    assert make_payload("SAMPLE", 3) == "WMSG:SAMPLE:3"


def test_make_payload_empty_type_raises():
    """Пустой тип — ошибка."""
    with pytest.raises(ValueError):
        make_payload("", 1)


def test_make_payload_invalid_id_raises():
    """Невалидный ID — ошибка."""
    with pytest.raises(ValueError):
        make_payload("CONTAINER", 0)
    with pytest.raises(ValueError):
        make_payload("CONTAINER", -5)


# ============================================================
# generate_qr_png
# ============================================================
def test_generate_qr_png_returns_bytesio():
    """Возвращает BytesIO с PNG."""
    buf = generate_qr_png("WMSG:CONTAINER:123")
    assert hasattr(buf, "read")
    assert hasattr(buf, "seek")


def test_generate_qr_png_has_png_signature():
    """Первые 8 байт — сигнатура PNG."""
    buf = generate_qr_png("WMSG:CONTAINER:123")
    data = buf.read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"


def test_generate_qr_png_pointer_at_start():
    """После вызова указатель — в начале (для stream)."""
    buf = generate_qr_png("WMSG:CONTAINER:1")
    data = buf.read()
    assert len(data) > 0


def test_generate_qr_png_different_sizes():
    """box_size влияет на размер картинки."""
    small = generate_qr_png("WMSG:CONTAINER:1", box_size=5).read()
    large = generate_qr_png("WMSG:CONTAINER:1", box_size=15).read()
    assert len(large) > len(small)


def test_generate_qr_png_empty_raises():
    """Пустой payload — ошибка."""
    with pytest.raises(ValueError):
        generate_qr_png("")


# ============================================================
# generate_qr_svg
# ============================================================
def test_generate_qr_svg_returns_string():
    """Возвращает строку."""
    svg = generate_qr_svg("WMSG:CONTAINER:123")
    assert isinstance(svg, str)


def test_generate_qr_svg_contains_svg_tag():
    """Содержит <svg."""
    svg = generate_qr_svg("WMSG:CONTAINER:123")
    assert "<svg" in svg


def test_generate_qr_svg_empty_raises():
    """Пустой payload — ошибка."""
    with pytest.raises(ValueError):
        generate_qr_svg("")