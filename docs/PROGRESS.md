# PROGRESS.md — история закрытых заходов

> Хронология. Свежее — сверху.
> Метрики раз в серию — в конце каждого раздела.

---

## Серия `feature/1.3-backend-v2`

**Дата:** 2026-10-08 — 2026-10-09
**Ветка:** `feature/1.3-backend-v2` (закрывается, вливается в `main`).
**Контекст:** Справочники, FK-миграции Sample, Container/WorkOrder,
модели приёмки, Shipment-расширение, ContainerType.laboratory.

### Что закрыто

- ✅ **`bundle-1`** — справочники: `ResearchType`, `Site`,
  `Laboratory`, `ContainerComment` + admin.
- ✅ **`bundle-2`** — тесты справочников + сериализаторы.
- ✅ **`bundle-3`** — API справочников.
- ✅ **`bundle-3a`** — восстановление тестов views.
- ✅ **`bundle-4`** — seeds: `seed_catalogs`,
  `seed_container_comments`.
- ✅ **`bundle-5`** — Sample: FK на `ResearchType` и `Site`.
- ✅ **`bundle-5a`** — восстановление тестов.
- ✅ **`bundle-6a`** — Container: `comment`, `comment_template`,
  `PENDING_PLACEMENT`.
- ✅ **`bundle-6b`** — WorkOrder: `site` FK.
- ✅ **`bundle-7a`** — модели приёмки: `Receipt`, `ReceiptItem`,
  `ImportSession`.
- ✅ **`bundle-7b`** — API приёмки.
- ✅ **`bundle-8a`** — Shipment: `direction`, статусы,
  лаборатория, рейс.
- ✅ **`bundle-8b`** — ContainerType: `laboratory`.

### Метрики

- Заходов: 13.
- «Не норм» на первом прогоне: 2 (сортировка кириллицы,
  фантом `mobile/android/`).
- Откатов: 0.
- Правил нарушено: 0.
- **Итог: 400 тестов (было 268 → +132).**

---

## Серия `feature/1.2-mobile-init`

**Дата:** 2026-10-08
**Ветка:** `feature/1.2-mobile-init` (на паузе).
**Контекст:** Инициализация Flutter-проекта. Приостановлена
для серии 1.3 (backend).

### Что закрыто

- ✅ **`bundle-1`** — Flutter init + структура проекта,
  `main.dart`, `pubspec.yaml`, README.
- ✅ **`bundle-1b`** — `widget_test.dart` под `WmsGeologyApp`.
- ✅ **`bundle-2`** — API-клиент: `config.dart`, `ApiClient`
  с JWT-интерцептором, `ApiException`.

### Что осталось

- ⬜ bundle-3: `AuthService` (login/refresh/logout).
- ⬜ bundle-4: Экран логина.
- ⬜ bundle-5: Сканер QR.
- ⬜ bundle-6: Поиск проб.
- ⬜ bundle-7: Инвентаризация.
- ⬜ bundle-8: Виртуальный вид секции.

### Метрики

- Заходов: 3. Откатов: 0.
- **Итог: 12 тестов mobile.**

---

## Серия `feature/1.1-backend-api`

**Дата:** 2026-10-07 — 2026-10-08
**Ветка:** влита в `main`, архив (commit `d693ffd`).
**Контекст:** REST API по `docs/API.md`, JWT, OpenAPI.

### Что закрыто

- ✅ **`bundle-1`** — сериализаторы storage (8 моделей).
- ✅ **`bundle-2`** — ViewSets + роутеры storage.
- ✅ **`bundle-3`** — API work_orders + custom `link`.
- ✅ **`bundle-4`** — API samples + фильтр `?work_order=`.
- ✅ **`bundle-5`** — API inventory.
- ✅ **`bundle-6`** — API picking (PickList, Shipment).
- ✅ **`bundle-7`** — API movements (MoveOperation).
- ✅ **`bundle-8`** — JWT-аутентификация.
- ✅ **`bundle-9`** — OpenAPI (drf-spectacular) + contract-тесты.

### Метрики

- Заходов: 9.
- «Не норм» на первом прогоне: 1 (serializer для APIView).
- Откатов: 0.
- **Итог: 268 тестов (было 128 → +140).**

---

## Серия `feature/1.0a-topology-v2`

**Дата:** 2026-10-07
**Ветка:** влита в `main`, архив.
**Контекст:** Переработка моделей под топологию v2.

### Что закрыто

- ✅ **`bundle-1`** — storage v2: `ContainerType`,
  `Section.qr_code`, `Cell.cell_type`, `Pallet` OneToOne,
  `Container.container_type`, `position_on_pallet`.
- ✅ **`bundle-2`** — samples (soft-delete) + inventory
  (`raw_barcode`, `InventoryIssue`).
- ✅ **`bundle-3`** — `picking` (`PickList`, `PickListItem`,
  `Shipment`, `ShipmentItem`) + `movements`
  (`MoveOperation`, `MoveOperationItem`).

### Метрики

- Заходов: 3 код + 4 docs.
- «Не норм» на первом прогоне: 2 (тест QR, CHECK паллет).
- Откатов: 0.
- **Итог: 128 тестов (было 78 → +50).**

---

## Серия `feature/1.0-backend-init`

**Дата:** 2026-10-07
**Ветка:** влита в `main`, архив.
**Контекст:** Инициализация Django-проекта.

### Что закрыто

- ✅ **`bundle-1`** — Poetry init.
- ✅ **`bundle-2`** — Django skeleton: `manage.py`, settings,
  urls, wsgi, asgi.
- ✅ **`bundle-3`** — приложения storage, samples, work_orders.
- ✅ **`bundle-4`** — приложения inventory, labels, users.
- ✅ **`bundle-5`** — модели storage (v1) + 19 тестов.
- ✅ **`bundle-6`** — модели users + 14 тестов.
- ✅ **`bundle-7`** — модель work_orders + 12 тестов.
- ✅ **`bundle-8`** — модели samples + 15 тестов.
- ✅ **`bundle-9`** — модели inventory + 13 тестов.
- ✅ **`bundle-10`** — seeds ролей + 5 тестов.

### Метрики

- Заходов: 11.
- «Не норм» на первом прогоне: 2 (CHECK Pallet, pytest args).
- Откатов: 0.
- **Итог: 78 тестов.**

---

## Серия `feature/0.2-prep-code`

**Дата:** 2026-10-07
**Ветка:** docs → `main` (commit `0a72c9f`).
**Контекст:** Подготовка структуры под кодовую фазу.

### Что закрыто

- ✅ **`Структура папок`** — `backend/`, `mobile/`, `web/`,
  `label-generator/` с README в каждой.
- ✅ **`.env.example`** — переменные окружения backend.
- ✅ **`.github/workflows/ci.yml`** — условный CI.
- ✅ **`TEMPLATES-PROJECT.md`** — дополнения к шаблонам.

### Метрики

- Заходов: 3. Откатов: 0.

---

## Серия `feature/0.1-foundation`

**Дата:** 2026-10-07
**Ветка:** docs → `main` (commit `2e7ea42`).
**Контекст:** Фундамент репозитория.

### Что закрыто

- ✅ **`Стартовые доки`** — README, LICENSE, .gitignore,
  PROJECT, CONTEXT, DECISIONS.
- ✅ **`DATABASE.md`** (v1).
- ✅ **`API.md`**.
- ✅ **`SCENARIOS.md`** (v1).
- ✅ **`TESTING.md`**.

### Метрики

- Заходов: 1. Откатов: 0.