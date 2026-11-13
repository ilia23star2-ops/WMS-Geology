"""Точечное обновление PROGRESS.md, PLAN.md после c-3.x-migration-5f.

Идемпотентно.
Одноразовая утилита захода c-3.x-migration-5f-docs.
"""
import sys

# Windows CP1251 не кодирует эмодзи (✅) в print → UnicodeEncodeError.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "docs" / "PLAN.md"
PROG = ROOT / "docs" / "PROGRESS.md"


def patch(path: Path, replacements: list) -> None:
    text = path.read_text(encoding="utf-8")
    for label, old, new in replacements:
        if new in text:
            print(f"[{path.name}] = {label} (уже есть)")
            continue
        if old in text:
            text = text.replace(old, new, 1)
            print(f"[{path.name}] + {label}")
        else:
            print(f"[{path.name}] ? {label} — якорь не найден")
    path.write_text(text, encoding="utf-8")


# --- PROGRESS.md: пропустится, уже применён ---
patch(PROG, [
    (
        "c-3.x-migration-5f",
        "- ✅ **`c-3.x-migration-5b`**",
        "- ✅ **`c-3.x-migration-5f`** (2026-11-13) — Web OCR review v2: "
        "предзаполнение формы из `raw_ocr_data.extracted`, "
        "двусторонняя подсветка `bbox ↔ поле` (`activeField`), "
        "диапазоны проб через `SmartAutocomplete` + `baseSampleOptions` "
        "(как в `FillContainerContent`), `RangeEditDialog` (skip/selected), "
        "группировка по скважинам (авто из `parseSampleInput`). "
        "Web: 30 тестов. Backend 44 `apps/ocr` + 44 в других (918 всего).\n"
        "- ✅ **`c-3.x-migration-5b`**",
    ),
])

# --- PLAN.md: 5f ✅, мини-таблица с 6/7/8, ТД-82/83 ---
patch(PLAN, [
    (
        "5f ✅",
        "| c-3.x-migration-5b | Web: экран проверки | `OcrReviewPage.tsx`, bbox-overlay, approve, 6 тестов | ✅ |\n"
        "| c-3.x-migration-5c | Web: список батчей + sidebar + справочники в форме | `OcrBatchesPage.tsx`, `OcrBatchDetailPage.tsx`, пункт в sidebar, `useContainerTypes`/`useResearchTypes`/`useSites` в форме, placeholder `001-031` | ⬜ |",
        "| c-3.x-migration-5b | Web: экран проверки | `OcrReviewPage.tsx`, bbox-overlay, approve, 6 тестов | ✅ |\n"
        "| c-3.x-migration-5c | Web: список батчей + sidebar + справочники | `OcrBatchesPage.tsx`, `OcrBatchDetailPage.tsx`, sidebar «Оцифровка», `SmartAutocomplete` в форме | ✅ |\n"
        "| c-3.x-migration-5d | Web: `Н/З (входящий)` подсказки | `/storage/suggestions/` + `work_orders_incoming`, +2 backend-теста | ✅ |\n"
        "| c-3.x-migration-5e | Backend: `zones` + mapping | `OcrTask.zones`, `POST /zones/`, `mapping.py`, `extracted`, +14 тестов | ✅ |\n"
        "| c-3.x-migration-5f | Web: `extracted` + подсветка + диапазоны | `api/ocr.ts` (типы), `OcrReviewPage.tsx` v10, `RangeEditDialog`, группировка по скважинам | ✅ |\n"
        "| c-3.x-migration-6 | Mobile: экран «Оцифровка» | ячейка → фото → зоны → `POST /recognize/` (image + zones_json) | ⬜ |\n"
        "| c-3.x-migration-7 | Mobile: SyncQueue для зон | офлайн-разметка → отправка при возврате сети | ⬜ |\n"
        "| c-3.x-migration-8 | Web: fallback без зон (regex) | если зон нет — эвристика по тексту (TST\\d+, T-\\d+, TAA-A\\d+) | ⬜ |",
    ),
    (
        "ТД-82",
        "| ТД-81 |",
        "| ТД-82 | Связь номера тары ↔ диапазон проб: при вводе номера тары (`T-001`) — автозаполнение начального/конечного диапазона (и наоборот). Требует бизнес-решения (1 к 1 / 1 к N / по последнему созданному). | низкий | по запросу |\n"
        "| ТД-81 |",
    ),
    (
        "ТД-83",
        "| ТД-81 |",
        "| ТД-83 | Зачистка мёртвого кода после 5f: `utils/parseSampleGroups.ts` (+тест) — не используется в `OcrReviewPage` v10. Проверить использование в других файлах, удалить если не нужно. | низкий | следующая ревизия web |\n"
        "| ТД-81 |",
    ),
])

print("OK")