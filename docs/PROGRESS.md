# PROGRESS.md — история закрытых заходов

> Хронология. Свежее — сверху.
> Метрики раз в серию — в конце каждого раздела.

---

## Серия `feature/2.1-label-generator`

**Дата:** 2026-10-09 — 2026-10-10
**Ветка:** `feature/2.1-label-generator` (влита в `main`, архив).
**Контекст:** Генератор этикеток тары. QR, PDF, партии печати,
раскладка на A4, API печати.

### Что закрыто

- ✅ **`bundle-1`** — QR-сервис: `generate_qr_png`, `generate_qr_svg`,
  `make_payload` (payload `WMSG:<TYPE>:<id>`).
- ✅ **`bundle-2`** — PDF-этикетка через fpdf2, шрифт `DejaVuSans.ttf`
  (в `.gitignore`, ставится локально).
- ✅ **`bundle-3`** — API `GET /storage/containers/{id}/label.pdf/`.
- ✅ **`bundle-4a`** — модели `PrintBatch` + `PrintBatchItem`,
  миграция, тесты.
- ✅ **`bundle-4b`** — API партии печати: сериализаторы, ViewSet,
  actions (`add-containers`, `remove-container`, `mark-ready`,
  `cancel`), сервис генерации `batch_number`.
- ✅ **`bundle-4d-1`** — раскладка этикеток:
  - сетка ширин `[110, 130, 150, 180, 210]` мм;
  - сетка высот `[37, 49, 74, 99, 148]` мм (делители A4);
  - шапка 28 мм: QR 25×25 справа, 4 строки слева;
  - авто-ширина колонки по самому длинному номеру пробы;
  - список проб колонками, шрифт 10 pt;
  - чекбоксы, рамка таблицы, пунктирный периметр;
  - упаковка на A4: от левого верхнего угла, стопкой;
  - продолжения: вторая этикетка без шапки, до 3 штук.
- ✅ **`bundle-4d-3`** — QR-сетка `QR_ONLY`:
  - 8 × 11 = 88 QR 25×25 на A4;
  - зазор 1 мм, отступ от края 1 мм;
  - общие пунктирные линии реза (одна между соседними QR).
- ✅ **`bundle-4d-4`** — API печати партии:
  - `GET /labels/print-batches/{id}/pdf/` — генерирует PDF,
    автоматически переводит `READY → PRINTED`;
  - `POST /labels/print-batches/{id}/mark-printed/` — ручной override;
  - повторное скачивание не переписывает первую печать;
  - `total_pages`, `total_items` заполняются.

### Метрики

- Заходов закрыто: 7.
- «Не норм» на первом прогоне: 4 (шрифт отсутствовал, префетч-кэш,
  тесты по константам, ALLOWED_HOSTS в standalone-скрипте).
- Откатов: 0.
- **Итог: 552 теста (было 433 → +119).**

---

## Серия `feature/2.0-excel-parser`

**Дата:** 2026-10-09
**Ветка:** `feature/2.0-excel-parser` (влита в `main`, архив).
**Контекст:** Парсер Excel-приёмки (формат лабораторий, решение 1.49).

### Что закрыто

- ✅ **`bundle-1`** — парсер `.xlsx` (`openpyxl`), структура листов.
- ✅ **`bundle-2`** — сервис импорта: разбор → предзаполнение
  `Receipt` + `ReceiptItem`.
- ✅ **`bundle-3`** — API `POST /receiving/import-sessions/upload/`.

### Метрики

- Заходов: 3.
- «Не норм» на первом прогоне: 0.
- Откатов: 0.
- **Итог: 433 теста (было 400 → +33).**

---

## Серия `feature/1.3-backend-v2`

**Дата:** 2026-10-08 — 2026-10-09
**Ветка:** влита в `main`, архив.
**Контекст:** Справочники, FK-миграции Sample, Container/WorkOrder,
модели приёмки, Shipment-расширение, ContainerType.laboratory.

### Что закрыто

- ✅ **`bundle-1`** — справочники: `ResearchType`, `Site`,
  `Laboratory`, `ContainerComment` + admin.
- ✅ **`bundle-2`** — тесты справочников + сериализаторы.
- ✅ **`bundle-3`** — API справочников.
- ✅ **`bundle-3a`** — восстановление тестов views.
- ✅ **`bundle-4`** — seeds: `seed_catalogs`, `seed_container_comments`.
- ✅ **`bundle-5`** — Sample: FK на `ResearchType` и `Site`.
- ✅ **`bundle-5a`** — восстановление тестов.
- ✅ **`bundle-6a`** — Container: `comment`, `comment_template`,
  `PENDING_PLACEMENT`.
- ✅ **`bundle-6b`** — WorkOrder: `site` FK.
- ✅ **`bundle-7a`** — модели приёмки: `Receipt`, `ReceiptItem`,
  `ImportSession`.
- ✅ **`bundle-7b`** — API приёмки.
- ✅ **`bundle-8a`** — Shipment: `direction`, статусы, лаборатория,
  рейс.
- ✅ **`bundle-8b`** — ContainerType: `laboratory`.

### Метрики

- Заходов: 13.
- «Не норм» на первом прогоне: 2.
- Откатов: 0.
- **Итог: 400 тестов (было 268 → +132).**

---

## Серия `feature/1.2-mobile-init`

**Дата:** 2026-10-08
**Ветка:** `feature/1.2-mobile-init` (на паузе).
**Контекст:** Инициализация Flutter-проекта.

### Что закрыто

- ✅ **`bundle-1`** — Flutter init + структура проекта, `main.dart`,
  `pubspec.yaml`, README.
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
- «Не норм» на первом прогоне: 1.
- Откатов: 0.
- **Итог: 268 тестов (было 128 → +140).**

---

## Серия `feature/1.0a-topology-v2`

**Дата:** 2026-10-07
**Ветка:** влита в `main`, архив.
**Контекст:** Переработка моделей под топологию v2.

### Что закрыто

- ✅ **`bundle-1`** — storage v2: `ContainerType`, `Section.qr_code`,
  `Cell.cell_type`, `Pallet` OneToOne, `Container.container_type`,
  `position_on_pallet`.
- ✅ **`bundle-2`** — samples (soft-delete) + inventory (`raw_barcode`,
  `InventoryIssue`).
- ✅ **`bundle-3`** — `picking` + `movements`.

### Метрики

- Заходов: 3 код + 4 docs.
- «Не норм» на первом прогоне: 2.
- Откатов: 0.
- **Итог: 128 тестов (было 78 → +50).**

---

## Серия `feature/1.0-backend-init`

**Дата:** 2026-10-07
**Ветка:** влита в `main`, архив.
**Контекст:** Инициализация Django-проекта.

### Что закрыто

- ✅ **`bundle-1`** — Poetry init.
- ✅ **`bundle-2`** — Django skeleton: `manage.py`, settings, urls.
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
- «Не норм» на первом прогоне: 2.
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

- ✅ **`Стартовые доки`** — README, LICENSE, .gitignore, PROJECT,
  CONTEXT, DECISIONS.
- ✅ **`DATABASE.md`** (v1).
- ✅ **`API.md`**.
- ✅ **`SCENARIOS.md`** (v1).
- ✅ **`TESTING.md`**.

### Метрики

- Заходов: 1. Откатов: 0.