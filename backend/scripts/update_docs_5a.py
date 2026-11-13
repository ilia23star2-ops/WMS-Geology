"""Точечное обновление PROGRESS.md и PLAN.md после c-3.x-migration-5a.

Идемпотентно: если правка уже есть — пропускает.
Одноразовая утилита захода c-3.x-migration-5a-docs.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'docs' / 'PLAN.md'
PROG = ROOT / 'docs' / 'PROGRESS.md'


def patch(path: Path, replacements: list) -> None:
    text = path.read_text(encoding='utf-8')
    for label, old, new in replacements:
        if new in text:
            print(f'[{path.name}] = {label} (уже есть)')
            continue
        if old in text:
            text = text.replace(old, new, 1)
            print(f'[{path.name}] + {label}')
        else:
            print(f'[{path.name}] ? {label} — якорь не найден')
    path.write_text(text, encoding='utf-8')


# --- PROGRESS.md: вставить c-3.x-migration-5a перед c-3.x-migration-1 ---
patch(PROG, [
    ('c-3.x-migration-5a',
     '- ✅ **`c-3.x-migration-1`**',
     '- ✅ **`c-3.x-migration-5a`** (2026-11-13) — approve-API: `POST /api/v1/ocr/tasks/{id}/approve/`, сервис `apps/ocr/services/approve.py` (композиция `fill_container_with_samples` + `bulk_place_containers` + `log_audit`), сериализатор `OcrApproveSerializer` (наследник `FillSamplesSerializer` + `container_type_id` + `cell_id`), 4 эндпоинта (batches list/create, batch detail, task detail, task approve), 8 unit-тестов (`test_approve_view.py`). 23 passed total.\n'
     '- ✅ **`c-3.x-migration-1`**'),
])

# --- PLAN.md: мини-таблица про OCR перед 3.x-offline ---
patch(PLAN, [
    ('план 3.x-migration',
     '**План серии 3.x-offline:**',
     '**План серии 3.x-migration (OCR, активна):**\n\n'
     '| # | Заход | Что делает | Статус |\n'
     '|---|---|---|---|\n'
     '| c-3.x-migration-1/2 | Mobile: Tesseract→сервер | Удалён локальный OCR, `scanner_screen` без OCR-ссылок | ✅ |\n'
     '| c-3.x-migration-3 | Серверный OCR | Модели `OcrBatch`/`OcrTask`, `POST /api/v1/ocr/recognize/`, `ocr_runner.py` (EasyOCR на python312), warmup, smoke, 14 тестов | ✅ |\n'
     '| c-3.x-migration-5a | Approve API | `POST /api/v1/ocr/tasks/{id}/approve/`, 4 эндпоинта, 8 тестов | ✅ |\n'
     '| c-3.x-migration-5b | Web: экран проверки | `OcrReviewPage.tsx`, bbox-overlay, sidebar, route | ⬜ |\n'
     '\n'
     '**План серии 3.x-offline:**'),
    ('ТД-80',
     '| ТД-79 | `ocr_runner.py`: путь `python_exe = r"D:\\\\Dev\\\\python312\\\\python.exe"` захардкожен. На домашнем ПК / Linux не заведётся. Вынести в `settings.OCR_PYTHON_EXE` + `.env`. | высокий | перед выездом за пределы рабочего ПК |',
     '| ТД-79 | `ocr_runner.py`: путь `python_exe = r"D:\\\\Dev\\\\python312\\\\python.exe"` захардкожен. На домашнем ПК / Linux не заведётся. Вынести в `settings.OCR_PYTHON_EXE` + `.env`. | высокий | перед выездом за пределы рабочего ПК |\n'
     '| ТД-80 | `DATABASE.md` показывает формат `sample_number = TAA-A34076001-001` (с дефисом перед sequence), но реальный код `fill_container_with_samples` клеит `prefix + middle + sequence` без дефисов → `TAA-A34076001001`. Синхронизировать доки и код: либо править пример в `DATABASE.md`, либо добавить дефис в `fill_container_with_samples`. | средний | при следующей ревизии `samples` |'),
])

print('OK')