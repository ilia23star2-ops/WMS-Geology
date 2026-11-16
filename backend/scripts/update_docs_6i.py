"""Точечное обновление PROGRESS/PLAN/CONTEXT после c-3.x-migration-6i.

Идемпотентно. CP1251-safe.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "docs" / "PLAN.md"
PROG = ROOT / "docs" / "PROGRESS.md"
CTX = ROOT / "docs" / "CONTEXT.md"


def patch(path: Path, replacements: list) -> None:
    text = path.read_text(encoding="utf-8")
    for label, old, new in replacements:
        if new in text:
            print(f"[{path.name}] = {label}")
            continue
        if old in text:
            text = text.replace(old, new, 1)
            print(f"[{path.name}] + {label}")
        else:
            print(f"[{path.name}] ? {label} — anchor not found")
    path.write_text(text, encoding="utf-8")


patch(PROG, [
    (
        "6i",
        "- ✅ **`c-3.x-migration-6a-fix5a`**",
        "- ✅ **`c-3.x-migration-6i`** (2026-11-16) — `ocr_preprocess.py`: "
        "EXIF auto-rotate, resize (MAX=2000, MIN short=800), grayscale, "
        "autocontrast cutoff=2, unsharp mask. Вызывается из `ocr_runner.py` "
        "перед EasyOCR, temp-файл удаляется в `finally`. Замер: `ST12345013` → "
        "`TST120901` (без потери T). 4 pure-теста, 65 `apps/ocr`.\n"
        "- ✅ **`c-3.x-migration-6a-fix5a`**",
    ),
])

patch(PLAN, [
    (
        "6i ✅",
        "| c-3.x-migration-6i | OCR preprocess на сервере | EXIF rotate + resize + grayscale + autocontrast + sharpen в `ocr_runner.py` (Python 3.12). На фото с бликом/муаром — большой прирост. | ⬜ |",
        "| c-3.x-migration-6i | OCR preprocess на сервере | EXIF rotate + resize + grayscale + autocontrast + unsharp в `ocr_runner.py` | ✅ |\n"
        "| c-3.x-migration-6j | OCR correction: prefix + OCR-замены | `ocr_correction.py`: valid prefixes (site+lab) → Levenshtein fix, `I→1`, `O→0` в цифровой части. Интеграция в `views.py` после `extract_fields`. | ⬜ |",
    ),
    (
        "ТД-86",
        "| ТД-85 |",
        "| ТД-86 | `OcrReviewPage`: `ТИ` пустое после prefill — race condition (`prefilled=true` до загрузки `researchTypes.data`). Также `Участок` показывает код (`TST`) вместо `TST — Тестовый участок`. Чинится в `6a-fix5c`. | средний | `6a-fix5c` |\n"
        "| ТД-85 |",
    ),
])

patch(CTX, [
    (
        "6i",
        "- **Backend:**\n  - `POST /api/v1/ocr/recognize/`",
        "- **Backend:**\n"
        "  - `ocr_preprocess.py`: EXIF rotate + resize + gray + autocontrast + unsharp, вызывается из `ocr_runner.py`.\n"
        "  - `POST /api/v1/ocr/recognize/`",
    ),
])

print("OK")