# PROGRESS.md — история закрытых заходов

> Хронология. Свежее — сверху.
> Метрики раз в серию — в конце каждого раздела.

---

## Серия `feature/1.1-backend-api`

**Дата:** 2026-10-07 — 2026-10-07
**Ветка:** вливается в `main`, архив.
**Контекст:** REST API по `docs/API.md`. Полный CRUD + custom actions,
JWT-аутентификация, OpenAPI-схема.

### Что закрыто

- ✅ **`bundle-1`** — сериализаторы storage (8 моделей) + 19 тестов.
- ✅ **`bundle-2`** — ViewSets + роутеры storage + 17 тестов.
- ✅ **`bundle-3`** — API work_orders + custom `link` + 14 тестов.
- ✅ **`bundle-4`** — API samples + **фильтр `?work_order=`** с учётом
  linked_order + 20 тестов.
- ✅ **`bundle-5`** — API inventory: сессии, сканы, расхождения +
  custom `complete`, `resolve` + 16 тестов.
- ✅ **`bundle-6`** — API picking: PickList, PickListItem, Shipment +
  custom `activate`, `complete`, `pick`, `add-from-pick-list` + 18 тестов.
- ✅ **`bundle-7`** — API movements: MoveOperation + custom `execute` +
  15 тестов.
- ✅ **`bundle-8`** — JWT-аутентификация: `simplejwt`, login/refresh/
  logout/me + 12 тестов.
- ✅ **`bundle-9`** — OpenAPI (drf-spectacular) + contract-тесты + 7 тестов.

### Метрики

- Заходов: 9.
- «Не норм» на первом прогоне: 1 (bundle-9: serializer для APIView).
- Откатов: 0.
- Правил нарушено: 0.
- **Итог: 268 тестов (было 128 → +140).**

---

## Серия `feature/1.0a-topology-v2`

**Дата:** 2026-10-07
**Ветка:** влита в `main`, архив.
**Контекст:** Переработка моделей под топологию v2.

### Что закрыто

- ✅ `bundle-1` — storage v2 (ContainerType, Pallet OneToOne, Section.qr_code).
- ✅ `bundle-2` — samples soft-delete + inventory raw_barcode/InventoryIssue.
- ✅ `bundle-3` — picking + movements.
- ✅ Docs-заходы (DECISIONS, DATABASE v2, SCENARIOS v2, PROJECT v2).

### Метрики

- Заходов: 3 код + 4 docs. Откатов: 0.
- **Итог: 128 тестов (было 78 → +50).**

---

## Серия `feature/1.0-backend-init`

**Дата:** 2026-10-07
**Ветка:** влита в `main`, архив.
**Контекст:** Инициализация Django-проекта.

### Что закрыто

- ✅ bundle-1 — Poetry init.
- ✅ bundle-2 — Django skeleton.
- ✅ bundle-3 — приложения storage, samples, work_orders.
- ✅ bundle-4 — приложения inventory, labels, users.
- ✅ bundle-5 — модели storage + 19 тестов.
- ✅ bundle-6 — модели users + 14 тестов.
- ✅ bundle-7 — модель work_orders + 12 тестов.
- ✅ bundle-8 — модели samples + 15 тестов.
- ✅ bundle-9 — модели inventory + 13 тестов.
- ✅ bundle-10 — seeds ролей + 5 тестов.

### Метрики

- Заходов: 11. Откатов: 0.
- **Итог: 78 тестов.**

---

## Серия `feature/0.2-prep-code`

**Дата:** 2026-10-07
**Ветка:** docs → `main` (commit `0a72c9f`)
**Контекст:** Подготовка структуры под кодовую фазу.

### Что закрыто

- ✅ Структура папок.
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

- ✅ Стартовые доки.
- ✅ `DATABASE.md` (v1).
- ✅ `API.md`.
- ✅ `SCENARIOS.md` (v1).
- ✅ `TESTING.md`.

### Метрики

- Заходов: 1. Откатов: 0.