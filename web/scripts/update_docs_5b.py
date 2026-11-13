"""Точечное обновление PROGRESS.md, PLAN.md, CONTEXT.md после c-3.x-migration-5b.

Идемпотентно.
Одноразовая утилита захода c-3.x-migration-5b-docs.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "docs" / "PLAN.md"
PROG = ROOT / "docs" / "PROGRESS.md"
CTX = ROOT / "docs" / "CONTEXT.md"


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


# --- PROGRESS.md: вставить 5b перед 5a (свежее сверху) ---
patch(PROG, [
    (
        "c-3.x-migration-5b",
        "- ✅ **`c-3.x-migration-5a`**",
        "- ✅ **`c-3.x-migration-5b`** (2026-11-13) — Web OCR review: "
        "`OcrReviewPage.tsx` (двухпанельный layout: `<img>` + bbox-overlay + форма), "
        "`api/ocr.ts` (`useOcrTask`, `useApproveOcrTask`, `resolveImageUrl`), "
        "`utils/parseSampleGroups.ts` (`prefix | middle | from-to` → `SampleGroup[]`), "
        "6 unit-тестов (`parseSampleGroups.test.ts`), `vite.config.ts` proxy `/media`. "
        "Device-check пройден (4 стадии: media→стр→approve→verify). "
        "Container #215 создан, 3 пробы `PENDING_PLACEMENT`, `OcrTask.DONE`, "
        "`OcrBatch.COMPLETED`. Web: 24 → 30 тестов.\n"
        "- ✅ **`c-3.x-migration-5a`**",
    ),
])

# --- PLAN.md: мини-таблица 5b → ✅, + 5c ---
patch(PLAN, [
    (
        "статус 5b",
        "| c-3.x-migration-5b | Web: экран проверки | `OcrReviewPage.tsx`, bbox-overlay, sidebar, route | ⬜ |",
        "| c-3.x-migration-5b | Web: экран проверки | `OcrReviewPage.tsx`, bbox-overlay, approve, 6 тестов | ✅ |\n"
        "| c-3.x-migration-5c | Web: список батчей + sidebar + справочники в форме | `OcrBatchesPage.tsx`, `OcrBatchDetailPage.tsx`, пункт в sidebar, `useContainerTypes`/`useResearchTypes`/`useSites` в форме, placeholder `001-031` | ⬜ |",
    ),
    # ТД-80 — расширить текст (добавить про web-формат)
    (
        "ТД-80 расширен",
        "| ТД-80 | `DATABASE.md` показывает формат `sample_number = TAA-A34076001-001` (с дефисом перед sequence), но реальный код `fill_container_with_samples` клеит `prefix + middle + sequence` без дефисов → `TAA-A34076001001`. Синхронизировать доки и код: либо править пример в `DATABASE.md`, либо добавить дефис в `fill_container_with_samples`. | средний | при следующей ревизии `samples` |",
        "| ТД-80 | Расхождение формата `sample_number` в трёх местах: `DATABASE.md` — `TAA-A34076001-001` (с дефисом); реальный код `fill_container_with_samples` — `prefix + middle + sequence` без дефисов → `TAA-A34076001001`; web-форма `OcrReviewPage` строит `sequence_digits` из длины `sequence_to` (`1-3` → digits=1 → `TAA-A340760011`, `001-003` → digits=3 → `TAA-A34076001001`). Синхронизировать: править `DATABASE.md`, добавить дефис в код или явно описать поведение в UI. | средний | при следующей ревизии `samples` |",
    ),
    # ТД-81 — новый (MUI 9 build)
    (
        "ТД-81",
        "| ТД-80 |",
        "| ТД-81 | Web: `npm run build` (`tsc --noEmit`) падает на MUI 9 breaking changes в pre-existing файлах: `PoolPage.tsx`, `ShipmentsPage.tsx`, `TopologyPage.tsx`, `ContainersPage.tsx`, `SamplesTreeTable.tsx`. Типы `<Grid item>`/`<Grid container>`, `Stack justifyContent`/`alignItems` в prop-позиции, unused `CircularProgress`/`PlaylistAddCheckIcon`. Dev (`npm run dev` через vite esbuild) работает. | высокий | при следующей ревизии web |\n"
        "| ТД-80 |",
    ),
])

# --- CONTEXT.md: web 24 → 30 ---
patch(CTX, [
    (
        "web 30 тестов",
        "**Web: 24 юнит-теста.**",
        "**Web: 30 юнит-тестов.**",
    ),
])

print("OK")