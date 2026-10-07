# PROGRESS.md — история закрытых заходов

> Хронология. Свежее — сверху.
> Метрики раз в серию — в конце каждого раздела.

---

## Серия `feature/1.0a-topology-v2`

**Дата:** 2026-10-07 — 2026-10-07
**Ветка:** влита в `main`, архив.
**Контекст:** Переработка моделей под топологию v2 после уточнения
требований (4 яруса A–D, 1 поддон в ячейке, «тихий» Pallet, без QR
на поддонах, выборка, отправка, пул перемещений, soft-delete,
инвентаризация с расхождениями).

### Что закрыто

- ✅ **`bundle-1`** — storage v2: `ContainerType`, `Section.qr_code`,
  `Cell.cell_type`, `Pallet` OneToOne с `Cell`, `Container.container_type`,
  `position_on_pallet`. Тесты: 26.
- ✅ **`bundle-2`** — samples (soft-delete: `disposed_at/by/reason`) +
  inventory (`raw_barcode`, `InventoryIssue`). Тесты: 39.
- ✅ **`bundle-3`** — `picking` (`PickList`, `PickListItem`, `Shipment`,
  `ShipmentItem`) + `movements` (`MoveOperation`, `MoveOperationItem`).
  Тесты: 32.

### Дополнительно

- ✅ **Docs-заход 1** — `DECISIONS.md`: 1.20–1.30.
- ✅ **Docs-заход 2** — `DATABASE.md` v2.
- ✅ **Docs-заход 3** — `SCENARIOS.md` v2.
- ✅ **Docs-заход закрытия серии** — `CONTEXT`, `PLAN`, `PROGRESS`,
  `DECISIONS`.

### Метрики

- Заходов: 3 код + 4 docs.
- «Не норм» на первом прогоне: 2 (bundle-1: тест QR; bundle-3:
  CHECK паллет/контейнер).
- Откатов: 0.
- Правил нарушено: 0.
- Идей отложено в `PLAN.md`: 3.
- **Итог: 128 тестов (было 78 → +50).**

---

## Серия `feature/1.0-backend-init`

**Дата:** 2026-10-07 — 2026-10-07
**Ветка:** влита в `main`, архив.
**Контекст:** Инициализация Django-проекта.

### Что закрыто

- ✅ `bundle-1` — Poetry init.
- ✅ `bundle-2` — Django skeleton.
- ✅ `bundle-3` — приложения storage, samples, work_orders.
- ✅ `bundle-4` — приложения inventory, labels, users.
- ✅ `bundle-5` — модели storage (v1) + 19 тестов.
- ✅ `bundle-6` — модели users + 14 тестов.
- ✅ `bundle-7` — модель work_orders + 12 тестов.
- ✅ `bundle-8` — модели samples + 15 тестов.
- ✅ `bundle-9` — модели inventory + 13 тестов.
- ✅ `bundle-10` — seeds ролей + 5 тестов.

### Метрики

- Заходов: 11. Откатов: 0.
- **Итог: 78 тестов.**

---

## Серия `feature/0.2-prep-code`

**Дата:** 2026-10-07
**Ветка:** docs → `main` (commit `0a72c9f`)
**Контекст:** Подготовка структуры под кодовую фазу.

### Что закрыто

- ✅ Структура папок (`backend/`, `mobile/`, `web/`, `label-generator/`).
- ✅ `.env.example`.
- ✅ `.github/workflows/ci.yml`.
- ✅ `TEMPLATES-PROJECT.md`.

### Метрики

- Заходов: 3. Откатов: 0.

---

## Серия `feature/0.1-foundation`

**Дата:** 2026-10-07
**Ветка:** docs → `main` (commit `2e7ea42`)
**Контекст:** Фундамент репозитория.

### Что закрыто

- ✅ Стартовые доки (README, LICENSE, .gitignore, PROJECT, CONTEXT, DECISIONS).
- ✅ `DATABASE.md` (v1).
- ✅ `API.md`.
- ✅ `SCENARIOS.md` (v1).
- ✅ `TESTING.md`.

### Метрики

- Заходов: 1. Откатов: 0.