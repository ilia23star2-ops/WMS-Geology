"""Точечное обновление docs/PLAN.md, docs/PROGRESS.md, docs/CONTEXT.md.

Идемпотентно: если правка уже есть — пропускает.
Одноразовая утилита захода c-3.x-migration-3d.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'docs' / 'PLAN.md'
PROG = ROOT / 'docs' / 'PROGRESS.md'
CTX = ROOT / 'docs' / 'CONTEXT.md'


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


# --- PLAN.md ---
patch(PLAN, [
    ('активная серия',
     '**Активная серия:** не выбрана (следующая — `feature/2.x-rbac`).',
     '**Активная серия:** `feature/3.x-migration` (OCR, активна с 2026-11-13).'),
    ('ветка',
     '**Ветка:** `feature/2.x-lab-portal`.',
     '**Ветка:** `feature/3.x-migration`.'),
    ('статус 3.x-migration',
     '| 4 | `feature/3.x-migration` | Миграция старых этикеток (OCR) | 4–5 |',
     '| 4 | `feature/3.x-migration` | Миграция старых этикеток (OCR) | 4–5 — 🟡 активна |'),
    ('ТД-78, ТД-79',
     '| ТД-74 | Механизм сквозной валидации статусов (Data Integrity Checker). Проверка соответствия статусов проб статусам тары при сохранении или фоновой задачей. | средний | при следующей ревизии домена |',
     '| ТД-74 | Механизм сквозной валидации статусов (Data Integrity Checker). Проверка соответствия статусов проб статусам тары при сохранении или фоновой задачей. | средний | при следующей ревизии домена |\n'
     '| ТД-78 | `apps/ocr/services/`: 4 «спящих» файла (`auto_detector.py`, `mark_detector.py`, `ocr_engine.py`, `sample_parser.py`) + `services/models.py` — старый OCR-пайплайн, не используется `views.py`. Решить: удалить или интегрировать. | средний | при следующей ревизии OCR |\n'
     '| ТД-79 | `ocr_runner.py`: путь `python_exe = r"D:\\\\Dev\\\\python312\\\\python.exe"` захардкожен. На домашнем ПК / Linux не заведётся. Вынести в `settings.OCR_PYTHON_EXE` + `.env`. | высокий | перед выездом за пределы рабочего ПК |'),
])

# --- PROGRESS.md ---
patch(PROG, [
    ('шапка 3.x-migration',
     '## Серия `feature/3.x-migration` (OCR)\n\n**Дата:** 2026-11-11 — закрыта.',
     '## Серия `feature/3.x-migration` (OCR)\n\n**Дата:** 2026-11-13 — 🟡 активна (переоткрыта).'),
    ('c-3.x-migration-3',
     '### Что закрыто\n- ✅ **`c-3.x-migration-1`**',
     '### Что закрыто\n'
     '- ✅ **`c-3.x-migration-3`** (2026-11-13) — серверный OCR: модели `OcrBatch`/`OcrTask`, `POST /api/v1/ocr/recognize/`, `ocr_runner.py` (EasyOCR на портативном Python 3.12), `scripts/ocr_warmup.py` (warmup с монитором), `scripts/ocr_smoke.sh` (сквозной smoke с JWT + DB-verify), 14 unit-тестов (`test_bbox.py`, `test_ocr_recognize_view.py`). Fix: `safe_bbox` вынесен в `services/bbox.py` — numpy-типы в bbox не сериализовались в JSON.\n'
     '- ✅ **`c-3.x-migration-1`**'),
])

# --- CONTEXT.md ---
patch(CTX, [
    ('дата', '**Дата обновления:** 2026-11-10', '**Дата обновления:** 2026-11-13'),
    ('активная серия',
     '**Активная серия:** не выбрана. Все запланированные на текущий момент серии закрыты.',
     '**Активная серия:** `feature/3.x-migration` (OCR, переоткрыта 2026-11-13).'),
    ('ветка', '**Ветка:** `main`.', '**Ветка:** `feature/3.x-migration`.'),
    ('текущий заход',
     '**Текущий заход:** серия `feature/2.x-lifecycle-4` — ✅ закрыта и влита в `main`.',
     '**Текущий заход:** `feature/3.x-migration` — `c-3.x-migration-3` (серверный OCR) закрыт; `c-3.x-migration-1/2` (мобилка Tesseract→сервер) закрыты.'),
    ('backend тесты',
     '**Backend: 904 теста.**',
     '**Backend: 918 тестов.** (+14 `apps.ocr`)'),
])

print('OK')