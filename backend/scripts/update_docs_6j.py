"""Точечное обновление PROGRESS/PLAN/CONTEXT после 6j + план 6f/6e.

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
        "6j",
        "- ✅ **`c-3.x-migration-6i`**",
        "- ✅ **`c-3.x-migration-6j`** (2026-11-16) — OCR: bbox scale "
        "(preprocess → tuple `(path, sx, sy)`; `ocr_runner` масштабирует bbox "
        "обратно к оригиналу), prefix filter (valid_prefixes = site+lab+match_patterns; "
        "ST→TST через Levenshtein≤1; ILM11 отбрасывается), OCR-fix `O→0`, `I/l→1` "
        "в trailing, Latin↔Cyrillic в research_type. 80 `apps/ocr`.\n"
        "- ✅ **`c-3.x-migration-6i`**",
    ),
])

patch(PLAN, [
    (
        "6f/6e",
        "| c-3.x-migration-6j | OCR correction: prefix + OCR-замены |",
        "| c-3.x-migration-6f-1 | Backend: approve с `batch.cell_id` | `batch.cell_id` → `Pallet.get_or_create` + `Container.ACTIVE`; иначе `PENDING_PLACEMENT`. Удалить `well` из `ZONE_TYPES`. | ⬜ |\n"
        "| c-3.x-migration-6e-1 | Mobile: новый экран «Оцифровка» | список ячеек + фото per cell (state в памяти) → одна отправка = один batch. | ⬜ |\n"
        "| c-3.x-migration-6f-2 | Web: `OcrBatchReviewPage` | `/ocr/batches/:id/review` → `?batch=N&index=K`, стрелки + счётчик. `OcrBatchDetailPage`: delete task + фильтр. | ⬜ |\n"
        "| c-3.x-migration-6e-2 | Mobile: разметка зон на фото | free-draw (тап → прямоугольник → тип). Удаление зон. | ⬜ |\n"
        "| c-3.x-migration-6f-3 | Web: интерактивные bbox | 4 цвета (серая/синяя/жёлтая/зелёная), тап ↔ список, scroll-to-field. | ⬜ |\n"
        "| c-3.x-migration-6e-3 | Mobile: SyncQueue для OCR | офлайн-накопление → отправка при возврате сети. | ⬜ |\n"
        "| c-3.x-migration-6j | OCR correction: prefix + OCR-замены |",
    ),
    (
        "ТД-87",
        "| ТД-86 |",
        "| ТД-87 | Скважины: добавить в справочники (`Well`) с FK `site` + `work_order` + `container`. UI в web (`CatalogsPage` → 4-я вкладка). Проверка скважин в помощнике сортировки. Не для MVP. | средний | после 6e |\n"
        "| ТД-86 |",
    ),
])

patch(CTX, [
    (
        "6j",
        "- **Backend:**\n  - `ocr_preprocess.py`",
        "- **Backend:**\n"
        "  - `mapping.py`: OCR-fix (`O→0`, `I/l→1`), `_fix_prefix` (ST→TST), "
        "фильтр по `valid_prefixes` (site+lab+match_patterns), Latin↔Cyrillic.\n"
        "  - `ocr_preprocess.py`",
    ),
])

print("OK")