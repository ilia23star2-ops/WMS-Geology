"""Точечное обновление PROGRESS/PLAN/CONTEXT после 6a-fix5a + 6a-fix5b.

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


# PROGRESS: 6a-fix5a + 6a-fix5b перед 6a
patch(PROG, [
    (
        "6a-fix5a+b",
        "- ✅ **`c-3.x-migration-6a`**",
        "- ✅ **`c-3.x-migration-6a-fix5a`** (2026-11-16) — extraction: `mapping.py` "
        "fuzzy match `Site`/`ResearchType`/`ContainerType` в тексте. Справочники "
        "передаются из `views.py` параметром. +8 pure-тестов +1 db-интеграция.\n"
        "- ✅ **`c-3.x-migration-6a-fix5b`** (2026-11-16) — web `OcrReviewPage`: "
        "prefill `site`/`container_type` из `extracted`; fallback проб "
        "(если `parseSampleInput` упал — raw с warning); `words[]` клики "
        "(клик по слову → подсветка поля; клик в поле → подсветка слов). "
        "Backend: 61 `apps/ocr`; Web: 30.\n"
        "- ✅ **`c-3.x-migration-6a`**",
    ),
])

# PLAN: +6i (preprocess), +ТД-85 (parseSampleInput для TST1234501)
patch(PLAN, [
    (
        "6i preprocess",
        "| c-3.x-migration-6e | Mobile: группировка фото по ячейкам |",
        "| c-3.x-migration-6i | OCR preprocess на сервере | EXIF rotate + resize + grayscale + autocontrast + sharpen в `ocr_runner.py` (Python 3.12). На фото с бликом/муаром — большой прирост. | ⬜ |\n"
        "| c-3.x-migration-6e | Mobile: группировка фото по ячейкам |",
    ),
    (
        "ТД-85",
        "| ТД-84 |",
        "| ТД-85 | `parseSampleInput` (web): жёстко `DEFAULT_DIGITS=3`, не понимает `TST1234501` (7 цифр после TST, без дефиса). Fallback проб в `OcrReviewPage` сохраняет raw, но `approve` отправит `prefix=''`, `middle=TST1234501` — сервер создаст пробу с `sample_number = TST1234501`, что может не совпасть с реальным форматом. Нужен парсер для `TST<digits>` без дефиса. | средний | следующая ревизия web |\n"
        "| ТД-84 |",
    ),
])

# CONTEXT: Mobile/Web — обновить под 6a-fix5b
patch(CTX, [
    (
        "web prefill",
        "- **Web:**\n  - Sidebar «Оцифровка» → `/ocr/batches`.",
        "- **Web:**\n"
        "  - Sidebar «Оцифровка» → `/ocr/batches`.\n"
        "  - `OcrReviewPage`: prefill `site`/`research_type`/`container_type` из `extracted`; "
        "fallback проб (raw с warning); клики `words[]` ↔ поля.",
    ),
])

print("OK")