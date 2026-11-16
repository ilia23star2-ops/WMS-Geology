"""Точечное обновление PROGRESS/PLAN/CONTEXT после c-3.x-migration-6a.

Идемпотентно. CP1251-safe (reconfigure).
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


# PROGRESS: 6a перед 5b
patch(PROG, [
    (
        "6a",
        "- ✅ **`c-3.x-migration-5b`**",
        "- ✅ **`c-3.x-migration-6a`** (2026-11-16) — Mobile «Оцифровка»: "
        "экран `OcrNewScreen` (камера / галерея / QR ячейки / отправка), "
        "`OcrService.recognize()`, `ApiClient.uploadMultipart()`, "
        "`QrCellScannerDialog`, `models/ocr_task.dart`. "
        "Backend: `recognize` принимает `cell_id`; `mapping.py` — расширенный regex "
        "(`TST1234501`, `TST-1234501`, `TAA-A-34076001`) + fallback `work_order_coded`. "
        "Backend: 52 `apps/ocr`; Mobile: 231 тестов; Web: 30.\n"
        "- ✅ **`c-3.x-migration-5b`**",
    ),
])

# PLAN: мини-таблица — 6a ✅, + 6b..6h
patch(PLAN, [
    (
        "6a",
        "| c-3.x-migration-6 | Mobile: экран «Оцифровка» | ячейка → фото → зоны → `POST /recognize/` (image + zones_json) | ⬜ |",
        "| c-3.x-migration-6a | Mobile: экран «Оцифровка» | камера / галерея / QR ячейки / `POST /recognize/` | ✅ |\n"
        "| c-3.x-migration-6a-fix5 | Extraction+Web prefill | fuzzy match `Site`/`ResearchType`/`ContainerType` в тексте; web prefill + `parseSampleInput` fallback + bbox↔field для `words[]` | ⬜ |\n"
        "| c-3.x-migration-6e | Mobile: группировка фото по ячейкам | свёрнутый список `OcrBatch`, чекбоксы проб | ⬜ |\n"
        "| c-3.x-migration-6f | Mobile: прогресс между фото | SyncQueue для OCR (офлайн + отложенная отправка) | ⬜ |\n"
        "| c-3.x-migration-6g | Детекция галочек в чекбоксах | OpenCV template matching (☑ / ☐) | ⬜ |\n"
        "| c-3.x-migration-6h | Web: подсветка «подозрительных» слов | low-confidence bbox → клик → scroll to field | ⬜ |\n"
        "| c-3.x-migration-6c | Mobile: ручная разметка зон | free-draw → тип зоны → `zones_json` в recognize | ⬜ |",
    ),
    (
        "ТД-84",
        "| ТД-82 |",
        "| ТД-84 | `parseSampleInput` на web: жёстко `DEFAULT_DIGITS=3`, не понимает `TST1234501` (без дефиса, 7 цифр). Нужен fallback-парсер или `sequence_digits` из extracted. Баг в `OcrReviewPage`, но не блокер 6a (mobile работает). | средний | следующая ревизия web |\n"
        "| ТД-82 |",
    ),
])

# CONTEXT: дата + 6a в «Что готово (OCR)»
patch(CTX, [
    ("дата", "**Дата обновления:** 2026-11-13", "**Дата обновления:** 2026-11-16"),
    (
        "6a",
        "- **Web:**\n  - Sidebar «Оцифровка» → `/ocr/batches`.",
        "- **Mobile:**\n  - Drawer «Оцифровка» → `OcrNewScreen`: камера / галерея / QR ячейки → `POST /recognize/`.\n"
        "  - `OcrService.recognize()`, `ApiClient.uploadMultipart()`, `QrCellScannerDialog`.\n"
        "- **Web:**\n  - Sidebar «Оцифровка» → `/ocr/batches`.",
    ),
])

print("OK")