"""Тесты preprocess OCR (c-3.x-migration-6i + 6j: tuple return).

PIL есть в backend venv — гоняем через pytest без python312.
"""
import os
from pathlib import Path

import pytest
from PIL import Image

from apps.ocr.services.ocr_preprocess import (
    MAX_SIDE,
    MIN_SIDE,
    preprocess_image,
)


def _make_img(path: Path, size: tuple, mode: str = "RGB") -> Path:
    img = Image.new(mode, size, "white")
    img.save(path)
    img.close()
    return path


def test_preprocess_large_image_resized(tmp_path):
    """4000×3000 → max side = 2000, scale_x=2, scale_y=2."""
    src = _make_img(tmp_path / "big.jpg", (4000, 3000))
    out, sx, sy = preprocess_image(str(src))
    try:
        with Image.open(out) as img:
            assert max(img.size) == MAX_SIDE
            assert img.mode == "L"
        assert abs(sx - 2.0) < 0.01
        assert abs(sy - 2.0) < 0.01
    finally:
        if os.path.exists(out):
            os.unlink(out)


def test_preprocess_small_image_upscaled(tmp_path):
    """400×300 → min side = 800."""
    src = _make_img(tmp_path / "small.jpg", (400, 300))
    out, _sx, _sy = preprocess_image(str(src))
    try:
        with Image.open(out) as img:
            assert min(img.size) >= MIN_SIDE
    finally:
        if os.path.exists(out):
            os.unlink(out)


def test_preprocess_output_grayscale(tmp_path):
    src = _make_img(tmp_path / "rgb.jpg", (1200, 800), "RGB")
    out, _sx, _sy = preprocess_image(str(src))
    try:
        with Image.open(out) as img:
            assert img.mode == "L"
    finally:
        if os.path.exists(out):
            os.unlink(out)


def test_preprocess_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        preprocess_image(str(tmp_path / "nope.jpg"))