# DECISIONS.md — решения и глоссарий

> Здесь фиксируются принятые решения и термины проекта.
> Решение без причины — плохое решение. Причина обязательна.

---

## 1. Решения

### 1.1–1.34 (сводка)

Полные формулировки — в истории git. Кратко:

- **1.1–1.13** — базовые: название, стек, WorkOrders self-ref,
  Sample как единица, M:N проба↔Н/З, QR, Уровень 1 интеграции,
  фазы проекта, система разработки, SSH.
- **1.14–1.19** — инфраструктура: портативный PostgreSQL,
  `poetry run`, стандартный User, seeds ролей, Pallet «в пути»,
  PROTECT для Container.
- **1.20–1.30** — топология v2: 4 яруса A–D, «тихий» Pallet,
  QR на секции/ячейке/таре, PickList, soft-delete утилизации,
  MoveOperation, вместимость, штрих-код ЛИМС, InventoryIssue,
  керн, помощник сортировки.
- **1.31–1.34** — PostgreSQL: пересоздание миграций,
  CHECK `move_item`, Docker Compose, JWT + OpenAPI.

**Статус:** ✅ действуют.

---

### 1.35–1.50 (сводка)

Полные формулировки — в истории git. Кратко:

- **1.35–1.39** — справочники, паттерны, автоопределение участков и лабораторий.
- **1.40** — формат номера пробы (prefix/middle/sequence).
- **1.41** — оба Н/З на этикетке.
- **1.42** — отказ от `SampleDecryption`.
- **1.43** — UX ручного ввода (партия → группа тары → скважины).
- **1.44** — статусы проб на приёмке (`PRESENT`, `SELECTED`, `MISSING`).
- **1.45–1.46** — формат этикетки (устарело, заменено 1.55).
- **1.47** — статус `PENDING_PLACEMENT` (уточнено 1.62).
- **1.48** — массовая печать (корзина → PDF).
- **1.49** — Excel: формат их (не наш).
- **1.50** — Акт приёмки (PDF).

**Статус:** ✅ действуют.

---

### 1.51. 2026-10-08 — Ручной ввод доступен всегда

**Решение:** ручной ввод работает **независимо** от источника
данных (QR, Excel, OCR, ЛИМС API). Даже если данные пришли
автоматически, пользователь может поправить.

**Причина:**
- Реальность отличается от идеала.
- Ручной ввод — fallback и контроль качества.
- Работает с уже хранящимися тарами при оцифровке.

**Где:** UI — серия 2.x.
**Статус:** ✅ действует.

---

### 1.52. 2026-10-08 — Портал для лабораторий (Уровень 2 интеграции)

**Решение:** отдельный раздел веб-приложения для
лабораторий-отправителей.

**Возможности:**
- Логин по аккаунту лаборатории (создаёт наш админ).
- Создание рейса: название (автогенерируется, редактируется),
  дата, откуда, куда.
- Сборка рейса:
  - **Импорт из ЛИМС** — копипаст текстовой выгрузки, парсинг
    блоков.
  - **Ручной ввод** — форма с общим списком проб на один или
    несколько типов.
- Авторазбивка по тарам (одинаковая для каждого выбранного ТИ).
- Просмотр и редактирование тары.
- Печать этикеток (одна / массово).
- Сопроводительный документ + чек-лист для машины.
- Смена статусов (только вперёд, с защитой).

**Статусы рейса (в UI на русском):**

| Технический | Русский | Кто меняет |
|---|---|---|
| `DRAFT` | Черновик | Лаборатория |
| `ASSEMBLED` | Собран | Лаборатория |
| `SENT` | Отправлен | Лаборатория |
| `RECEIVED` | Принят | Наш кладовщик |
| `PARTIALLY_RECEIVED` | Принят с расхождениями | Наш кладовщик |
| `RETURNED` | Возвращён | Наш кладовщик |
| `CANCELLED` | Отменён | Лаборатория / админ |
| `LOST` | Утерян | Только админ |

**Обратный поток:** `Shipment.direction`:
- `OUTBOUND` — мы → лаборатория.
- `INBOUND` — лаборатория → мы.

**Справочник тары лаборатории:** `ContainerType.laboratory_id`
(FK, nullable):
- `NULL` — общий тип, доступен всем.
- Иначе — только этой лаборатории.

**Импорт из ЛИМС — формат:**
- Копипаст текста в поле.
- Разбиение на блоки: **пустая строка + Н/З** — новый блок.
- Внутри блока: Н/З (одно или два), тара (тип + номер),
  тип исследования, участок (опц.), список проб.
- Список проб: строка = `п/п + пробел + номер пробы`, например
  `2 TST1234001`.

**Уточнение терминологии (навески):**
- Проба в системе = навеска физически.
- Один номер может повторяться для разных типов исследования.
- `Sample.sample_number` **не уникален**.
- «Логическая проба» как сущность в системе **отсутствует**.

**Границы MVP (серия 2.0):**
- ✅ Логин, создание рейса, сборка, разбивка, печать, отправка.
- ✅ Обратный поток (OUTBOUND) + подтверждение получения.
- ❌ Email-уведомления.
- ❌ Интеграция с ЛИМС API (только копипаст).
- ❌ Мобильное приложение для лабораторий.

**Причина:** Уровень 2 интеграции (1.9) — даём лабораториям
наш инструмент. Данные в нашем формате → приёмка =
сканирование → замкнутый цикл.

**Статус:** ✅ действует (серия 2.0).

---

### 1.53. 2026-10-09 — Циклические импорты через строковые ссылки

**Решение:** при необходимости FK между приложениями, где один
импортирует другого, использовать строковые ссылки
(`models.ForeignKey("samples.Site", ...)`).

**Где применено:**
- `WorkOrder.site` → `"samples.Site"`.
- `Shipment.laboratory`, `Shipment.site` → `"samples.Laboratory"`,
  `"samples.Site"`.
- `ContainerType.laboratory` → `"samples.Laboratory"`.
- `Receipt.laboratory`, `Receipt.site` → `"samples.Laboratory"`,
  `"samples.Site"`.
- `Receipt.shipment` → `"picking.Shipment"`.
- `ReceiptItem.research_type` → `"samples.ResearchType"`.
- `ReceiptItem.container_type` → `"storage.ContainerType"`.
- `PrintBatchItem.container` → `"storage.Container"`.
- `Container.draft_site`, `Container.draft_research_type` →
  `"samples.Site"`, `"samples.ResearchType"`.

**Причина:**
- `samples` импортирует `work_orders` (Sample → WorkOrder).
- `work_orders` не может импортировать `samples.Site` напрямую.
- Строковые ссылки разрешают Django построить граф без циклов.

**Где:** `backend/apps/*/models.py`.
**Статус:** ✅ действует.

---

### 1.54. 2026-10-09 — UniqueConstraint с NULL: `(name, laboratory)`

**Решение:** `ContainerType.UniqueConstraint(fields=["name", "laboratory"])`.
`laboratory = NULL` разрешает дубликаты имён в разных записях.

**Причина:**
- В Postgres `NULL <> NULL`, поэтому unique не блокирует
  дубликаты с `laboratory=NULL`.
- Практика: общий тип «Коробка» может встречаться один раз;
  типы «Коробка» у разных лабораторий — разные.
- При `laboratory=NULL` мы фактически разрешаем несколько
  «общих Коробок» — но на уровне UI это контролируется.

**Альтернатива (не принято):** `UniqueConstraint` с
`nulls_distinct=False` (Postgres 15+) или частичные индексы.

**Где:** `backend/apps/storage/models.py`.
**Статус:** ✅ действует.

---

### 1.55. 2026-10-10 — Спецификация этикетки (модель 4d)

**Решение:** формат этикетки — **сетка размеров**, авто-выбор
под содержимое.

**Размеры (мм):**
- Ширина: `[110, 130, 150, 180, 210]`.
- Высота: `[37, 49, 74, 99, 148]` (все делят A4 без остатка).

**Структура:**
- Шапка фиксирована (28 мм): QR 25×25 в правом верхнем углу,
  4 строки слева (`Уч:` / `Н/З (вх.):` / `Исл:` / `№:`).
- Рабочая область — таблица `п/п | Образец`, растянутая на
  ширину, колонки поровну.
- Чекбокс в каждой строке (для физической отметки отбора).
- Пунктирный периметр этикетки — отступ 1 мм от содержимого.
- Разделитель между шапкой и таблицей.

**Шрифт — 10 pt везде**, единый.

**Продолжения:** если не влезает, вторая этикетка **без шапки**,
только список, до 3 штук. QR — только на первой.

**Раскладка на A4:** 1 в ряд, от левого верхнего угла, стопкой,
этикетка не разрывается между листами.

**Причины:**
- Один формат, но адаптивен по содержимому.
- Экономия бумаги: S-этикетка для 5 проб, XXL — для 100.
- Человекочитаемый шрифт без масштабирования вниз.
- А4 как единственный лист (A5 — отложено).

**Где:** `backend/apps/labels/services/label_service.py`.
**Статус:** ✅ действует.

---

### 1.56. 2026-10-10 — `PrintBatch`: soft-delete через `CANCELLED`

**Решение:** партия печати не удаляется физически.
Отмена — `status = CANCELLED`. Напечатанную партию
(`PRINTED`) отменить нельзя.

**Статусы:** `DRAFT / READY / PRINTED / CANCELLED`.
Русские названия (UI): Черновик / Готов к печати / Напечатан /
Отменён.

**Причина:**
- История печати сохраняется (кто, когда, что).
- Единообразно с `Shipment` (`CANCELLED`) и `Sample` (`DISPOSED`).
- Hard-delete теряет аудит.

**Где:** `backend/apps/labels/models.py`.
**Статус:** ✅ действует.

---

### 1.57. 2026-10-10 — `PrintBatchItem.container` — PROTECT

**Решение:** при удалении тары, которая фигурирует в партии
печати, Django выбрасывает `ProtectedError`.

**Причина:**
- Тару, по которой печатали документы, не удаляем молча.
- Единообразно с `Sample → Container`, `ContainerType → Container`.

**При удалении партии** (`PrintBatch.delete()`): items уходят
каскадом, тара остаётся.

**Где:** `backend/apps/labels/models.py`.
**Статус:** ✅ действует.

---

### 1.58. 2026-10-13 — Синхронизация статусов Sample ↔ Container — явный сервис

**Решение:** синхронизация статуса `Sample` со статусом
`Container` выполняется **явным вызовом** функции
`sync_sample_status_for_container(container)` из сервисного слоя.
Django signals **не используются**.

**Правила:**
- Маппинг: `Container.STATUS_ACTIVE → Sample.STATUS_IN_STORAGE`,
  `PENDING_PLACEMENT → PENDING_PLACEMENT`,
  `IN_TRANSIT → IN_TRANSIT`.
- «Защищённые» статусы проб — `DISPOSED`, `CONSUMED`,
  `SELECTED` — не перезаписываются.
- Неизвестный статус тары → 0 обновлений, без исключений.
- Возвращает количество обновлённых проб.

**Причина:**
- Signals невидимы, ломают читаемость, тяжело отлаживаются.
- Явный вызов из view / сервиса — прозрачно.
- Возврат количества — удобно для тестов и логирования.

**Уточнение (1.62):** для `PENDING_FILLING` маппинг **не задан** —
у такой тары проб быть не должно, sync их не трогает.

**Уточнение (2f-9c):** `ISSUED` и `PENDING_DECRYPTION` удалены из
`Sample.STATUS_CHOICES`, маппинга для них нет.

**Где:** `backend/apps/samples/services.py`.
**Статус:** ✅ действует.

---

### 1.59. 2026-10-13 — Разделение bulk-create на два эндпоинта

**Решение:** вместо одного `POST /storage/containers/bulk-create/`
(тара + пробы) — **два эндпоинта**:
- `POST /storage/containers/bulk-create/` — только тары
  (статус `PENDING_FILLING`, см. 1.62).
- `POST /storage/containers/{id}/fill-samples/` — пробы для
  существующей тары.

**Правила:**
- Одна тара = один тип исследования. При попытке добавить пробы
  другого ТИ в тару, где уже есть пробы — 400.
- Повторное заполнение тем же ТИ — разрешено.
- Статус проб синхронизируется со статусом тары (см. 1.58).

**Причина:**
- Web-форма создания тары идёт в два шага (сначала тары, потом
  пробы из реестра). Единый эндпоинт этого не давал.
- Явное разделение = проще UX и валидация.
- Меньше параметров в одном запросе.

**Где:** `backend/apps/storage/bulk_create.py`, `views.py`,
`serializers.py`.
**Статус:** ✅ действует.

---

### 1.60. 2026-10-13 — Container: draft-поля + nullable `container_number`

**Решение:**
- `Container.container_number` → **nullable** + `UNIQUE`
  (много NULL разрешено).
- +4 draft-поля: `draft_site` (FK → Site, SET_NULL),
  `draft_research_type` (FK → ResearchType, SET_NULL),
  `draft_work_order_coded` (CharField(100), default ""),
  `draft_work_order_incoming` (CharField(100), default "").

**Жизненный цикл тары:**
1. **Заготовка.** Создаётся через `bulk-create`.
   `container_number = NULL`. Draft-поля заполнены.
   Статус — `PENDING_FILLING` (1.62).
2. **Заполнение.** Через `fill-samples`. `container_number`
   присваивается (опционально). Draft-поля обновляются
   значениями из запроса (1.69). Создаются `Sample`,
   `WorkOrder`, `Well`. Статус → `PENDING_PLACEMENT`.

**Причина:**
- Кладовщик вводит данные шапки (участок, Н/З, ТИ, тип тары)
  на шаге создания — это «заказ на тару».
- Номер тары известен позже — когда тара физически маркируется.
- Единый эндпоинт не позволял этого — потребовалось разделение.

**Где:** `backend/apps/storage/models.py`,
`migrations/0005_*`, `bulk_create.py`, `serializers.py`, `views.py`.
**Статус:** ✅ действует. **Уточнение:** пункт про `UNIQUE`
пересмотрен в 1.61 — unique снят. **Уточнение 1.69:** draft-поля
не обнуляются, а обновляются из запроса.

---

### 1.61. 2026-10-15 — `Container.container_number` без глобальной уникальности

**Решение:** снять `unique=True` с `Container.container_number`
(миграция `storage/0006_alter_container_container_number`).

**Семантика:**
- Номер тары — **метка внутри группы (Н/З × ТИ)**, не глобальный
  идентификатор.
- У `TST00469/ГД` тары `1, 2, 3, 4`; у `TST00470/ГД` тоже
  `1, 2, 3, 4` — корректно.
- Идентификатор тары — `id`. В QR: `WMSG:CONTAINER:<id>`.
- Уникальность внутри группы — **не проверяем**: два `1` в одной
  группе = ошибка кладовщика, но не критична. Модель это не
  блокирует. Контроль — на уровне процесса/пользователя.

**Причины:**
- Глобальная `unique=True` давала ложные срабатывания:
  «Номер `10` уже занят тарой #10» при корректных данных.
- В реестре `/containers` добавлены колонки «Н/З», «ТИ» — чтобы
  различать одинаковые номера из разных групп.
- Снятие — семантически верное; `BulkCreateSerializer` сохраняет
  проверку уникальности номеров **в одном запросе** и коллизий
  с уже существующими — этого достаточно для UX.

**Что не сделали:** составной `UniqueConstraint((Н/З, ТИ, номер))`
отвергнут — модель не хранит группу на уровне `Container` (draft-
поля обнуляются после fill-samples), а привязка через `ReceiptItem`
не всегда возможна. Отложено до серии `2.x-lifecycle`.

**Где:** `backend/apps/storage/models.py`, миграция
`storage/0006_*`, тесты `test_container_filters.py` (2f-1),
`test_models.py`, `test_serializers.py` (stale fix в 3f-1b),
`test_bulk_create.py::test_bulk_create_duplicate_number_allowed`,
`test_fill_samples.py::test_fill_samples_duplicate_number_allowed`
(`2f-8-fix-2`).

**Источник:** пачка `receiving-3d-3-fix-2`, 2026-10-15.
**Статус:** ✅ действует.

---

### 1.62. 2026-10-16 — Новый статус `Container.STATUS_PENDING_FILLING`

**Решение:** ввести статус **`PENDING_FILLING`** («Ожидает
заполнения») — тара создана (импортом или вручную), но пробы
в неё ещё не положены.

**Семантика жизненного цикла:**
1. **`PENDING_FILLING`** — тара создана, проб нет.
   Пользователь кликает по таре → открывается форма
   заполнения. Присваивается номер (если был пуст).
2. **`PENDING_PLACEMENT`** — пробы добавлены через
   `fill-samples`. Место хранения ещё не назначено.
3. **`ACTIVE`** — тара размещена в ячейке (отдельный шаг).

**Где создаются `PENDING_FILLING`:**
- `bulk-create` (заготовка через UI).
- `check_receipt` при приёмке (`matched=true`).

**Где переходит в `PENDING_PLACEMENT`:**
- `fill_container_with_samples`: если `status == PENDING_FILLING`
  → после создания проб ставит `PENDING_PLACEMENT`.

**Где переходит в `ACTIVE`:**
- Отдельным действием «Разместить» (`bulk-place` или отдельный
  заход).

**Что не делаем:**
- Не задаём маппинг `PENDING_FILLING → Sample.status` в
  `sync_sample_status_for_container`. У такой тары проб нет,
  sync ничего не обновит. Если по какой-то причине пробы
  появятся — они останутся в своём статусе.

**Миграция:** `storage/0008_alter_container_status` +
data-migration `RunPython`:
- старые тары `PENDING_PLACEMENT` **без проб** →
  `PENDING_FILLING`;
- тары `PENDING_PLACEMENT` **с пробами** — не трогаем
  (они уже заполнены, ждут размещения).

**Причины:**
- Была проблема: тара после импорта имела номер, но не имела
  проб — клик по ней в реестре ничего не открывал (условие
  было `container_number == null`). Заполнить её было нельзя.
- Разделение «создана, но пустая» (PENDING_FILLING) и «заполнена,
  ждёт места» (PENDING_PLACEMENT) — семантически корректно.

**Где:** `backend/apps/storage/models.py` (статус),
`apps/storage/services/bulk_create.py`,
`apps/receiving/services/import_service.py` (`check_receipt`),
`apps/storage/migrations/0008_*`.
UI: `web/src/api/containers.ts` (метки + типы),
`web/src/pages/ContainersPage.tsx` (клик → `FillContainerDialog`).

**Источник:** пачка `2f-5c-1` (backend) + `2f-5c-2` (web),
2026-10-16.
**Статус:** ✅ действует.

---

### 1.63. 2026-10-16 — PDF QR топологии (Section, Cell)

**Решение:** автогенерация `qr_code` для `Section` и `Cell`
при создании + отдельный PDF-рендер для печати наклеек.

**Автогенерация:**
- `Section.save()` и `Cell.save()` — двойной `super().save()`.
  Первый создаёт запись, второй пишет `qr_code`.
- Payload: `WMSG:SECTION:<id>` / `WMSG:CELL:<id>`.
- Если `qr_code` задан явно — не перезаписывается.
- Миграция `storage/0007_alter_cell_qr_code_alter_section_qr_code`
  (только `AlterField` по `help_text`).

**PDF-рендер** (`apps/storage/services/qr_topology.py`):
- A4 portrait.
- Сетка **2 × 3** = 6 QR на лист.
- QR **65 × 65 мм** (компромисс: клеится на стеллаж/ячейку,
  крупный, но помещается на лист).
- Под QR — адрес (10 мм, шрифт 10 pt, обрезка «…»).
- Для Section адрес = `Room / Rack / Section`.
- Для Cell адрес = `full_address`.
- Если элементов не влезает на лист — новый лист.

**Эндпоинты:**
- `GET /storage/sections/{id}/qr.pdf/` — одиночный PDF.
- `GET /storage/cells/{id}/qr.pdf/` — одиночный PDF.
- `POST /storage/sections/qr-batch/` — партия, тело
  `{"items": [{"type": "SECTION"|"CELL", "id": int}, ...]}`.
  Адреса собираются на сервере.

**Не используем** полные этикетки (`label_service`) — только
QR + адрес снизу. Формат этикеток тары не подходит для
наклеек на секции/ячейки.

**Задел на будущее:** сканирование Section QR должно
открывать обзор секции (какие ячейки заняты, что внутри) —
отдельная серия сканирования.

**Где:** `backend/apps/storage/models.py`,
`apps/storage/services/qr_topology.py`,
`apps/storage/views.py` (actions `qr_pdf`, `qr_batch`).
UI: `web/src/pages/TopologyPage.tsx`, `web/src/api/topology.ts`.

**Источник:** пачки `2f-4c-1` (backend) + `2f-4c-2` (web),
2026-10-16.
**Статус:** ✅ действует.

---

### 1.64. 2026-10-16 — Каскадное удаление `ReceiptItem`

**Решение:** `DELETE /receipt-items/{id}/` удаляет строку приёмки
**вместе с тарой и её пробами** — одной транзакцией.

**Алгоритм:**
1. Если у строки есть `Container`:
   - удалить все `Sample` этой тары (по одной, чтобы поймать
     `ProtectedError` на конкретной пробе);
   - удалить `Container`.
2. Удалить саму `ReceiptItem`.

**Ошибки:**
- 404 — строки нет.
- 409 — если какая-то проба защищена (в `PickListItem` /
  `ShipmentItem`), или если тара защищена
  (`PrintBatchItem`). Текст ошибки называет конкретную пробу.

**Причины:**
- Кладовщик часто хочет удалить ошибочно загруженную строку
  целиком — с тарой и пробами.
- Каскад в одной транзакции = атомарно: либо всё уходит,
  либо ничего.
- `ProtectedError` → 409 сохраняет защиту для «настоящих»
  связей (проба уже в отгрузке).

**Где:** `backend/apps/receiving/views.py`
(`ReceiptItemViewSet.destroy`), +5 тестов
(`test_receipt_item_delete.py`).

**Источник:** пачка `2f-5a-1`, 2026-10-16.
**Статус:** ✅ действует.

---

### 1.65. 2026-10-27 — Force-удаление тары (2f-12b)

**Решение:** `DELETE /storage/containers/{id}/?force=true` принудительно
удаляет тару, даже если в ней есть пробы. Сначала удаляются все
пробы тары, затем сама тара, в одной транзакции.

**Ошибки:**
- 404 — тары нет.
- 409 — если тара защищена `PrintBatchItem` (её нельзя удалить,
  пока она фигурирует в партии печати), или если проба защищена
  `PickListItem` / `ShipmentItem`.

**Причины:**
- Облегчение тестирования и очистки ошибочных данных без похода
  в БД / админку.
- Позволяет кладовщику удалить тару, созданную по ошибке, вместе
  с пробами.

**Где:** `backend/apps/storage/views.py` (`ContainerViewSet.destroy`),
`web/src/api/containers.ts` (`useDeleteContainer`),
`web/src/pages/ContainersPage.tsx` (обработка 409 + force).
**Статус:** ✅ действует.

---

### 1.66. 2026-10-27 — Статус `Sample.STATUS_SELECTED` (2f-9b)

**Решение:** пробы, отмеченные пользователем как «Выбранные»
(на доп. исследование), получают статус `SELECTED`.

**Свойства:**
- На этикетке такие пробы помечаются черной галочкой (в отличие
  от обычных проб, у которых пустой квадратик).
- Статус `SELECTED` является «защищенным» — он не перезаписывается
  на `IN_STORAGE` при синхронизации со статусом тары
  (`sync_sample_status_for_container`).
- В `SampleSerializer` отдается как `"SELECTED"`.

**Причины:**
- Отражение бизнес-процесса: проба есть физически, но она отобрана
  для доп. исследований (может быть вывезена или помечена).
- Защита от затирания: если тару размещают на полку, статус
  «Выбрана» не должен теряться.

**Где:** `backend/apps/samples/models.py`,
`apps/samples/services.py` (защита), `apps/labels/services/label_service.py`
(черная галочка). UI: `web/src/api/samples.ts`,
`FillContainerDialog.tsx` (пропуски/выбранные).
**Статус:** ✅ действует.

---

### 1.67. 2026-10-27 — Создание тары прямо в ячейке (2f-12a)

**Решение:** реализован эндпоинт `POST /storage/containers/create-in-cell/`,
который выполняет три операции в одной транзакции:
1. Создает тару (заготовку).
2. Заполняет её пробами.
3. Привязывает тару к поддону в указанной ячейке (создавая поддон,
   если его нет).

**Причины:**
- Ускорение работы кладовщика: не нужно создавать тару, потом
  заполнять, потом размещать. Всё делается в один шаг из окна ячейки.
- Гарантия консистентности: если что-то упадет, тара не останется
  «висеть» без пробы или без привязки к ячейке.

**Где:** `backend/apps/storage/views.py` (`ContainerViewSet.create_in_cell`),
`backend/apps/storage/serializers.py` (`CreateInCellSerializer`).
UI: `web/src/components/CellContentsDialog.tsx`,
`web/src/components/CreateInCellDialog.tsx`.
**Статус:** ✅ действует.

---

### 1.68. 2026-10-27 — Переиспользование ID (BigAutoField)

**Решение:** ID объектов (например, тары) **не переиспользуются**
после удаления. При использовании стандартного `BigAutoField` в
Django/PostgreSQL ID всегда инкрементируется.

**Причины:**
- Защита от путаницы: если ID `150` был напечатан на QR-коде и
  тару удалили, новый объект с ID `150` может случайно
  отсканироваться по старой наклейке.
- 64-битного лимита хватит на миллионы лет работы (даже при
  создании 1000 объектов в секунду).

**Где:** стандартное поведение Django.
**Статус:** ✅ норма (не требует изменений).

---

### 1.69. 2026-10-27 — `fill-samples` обновляет draft-поля из запроса (2f-7f, 2f-8-fix-2)

**Решение:** после успешного `POST /storage/containers/{id}/fill-samples/`
draft-поля тары (`draft_site_id`, `draft_research_type_id`,
`draft_work_order_coded`, `draft_work_order_incoming`)
**обновляются значениями из запроса**, а не обнуляются и не
сохраняются «как были».

**Логика:**
- `views.py`, `ContainerViewSet.fill_samples` — после вызова
  сервиса:
  ```python
  container.draft_site_id = data.get("site_id")
  container.draft_research_type_id = data["research_type_id"]
  container.draft_work_order_coded = data["work_order_coded"]
  container.draft_work_order_incoming = data.get("work_order_incoming", "")
  container.save(update_fields=[...draft-поля...])
Сервис fill_container_with_samples draft-поля не трогает.

Семантика 2f-7f: «draft-поля не обнулять, чтобы они оставались
в интерфейсе». Значения — актуальные (из запроса), а не исходные
(до заполнения).

Причина:

Пользователь может повторно заполнить тару (тот же ТИ, другой
диапазон) — draft-поля должны отражать последние введённые
значения.

Тест, ожидавший «сохранение старых OLD-*», был ошибочным —
правка в 2f-8-fix-2 (test_fill_samples_updates_draft_fields).

Где: backend/apps/storage/views.py, bulk_create.py
(комментарий «draft-поля НЕ обнуляем, чтобы они оставались
в интерфейсе (фикс 2f-7f)»), test_fill_samples.py
(test_fill_samples_updates_draft_fields).

Источник: 2f-7f + уточнение в 2f-8-fix-2, 2026-10-27.
Статус: ✅ действует.

1.70. 2026-10-27 — Аудит операций с тарой (2f-14a)
Решение: журнал всех значимых действий с тарой ведётся в
AuditLog. Запись — явным вызовом сервиса log_audit() из
actions ViewSet (Django signals не используем, см. 1.58).

Покрытие: 6 действий в ContainerViewSet:

CREATE — bulk-create и perform_create (обычный POST);

UPDATE — perform_update (PUT/PATCH);

DELETE — destroy (с force и без);

FILL_SAMPLES — fill-samples (с created_samples в new_value);

PLACE — bulk-place (в ячейку или на пол);

CREATE_IN_CELL — create-in-cell (создание + заполнение + размещение в одной записи).

Snapshot: компактный — 6 полей:

python
{
    "status": "ACTIVE",
    "container_number": "T-001",
    "container_type_id": 3,
    "pallet_id": 7,
    "floor_room_id": None,
    "sample_count": 5,
}
Для CREATE — old_value = None, new_value = snapshot.

Для UPDATE — old_value = snapshot до, new_value = snapshot после.

Для DELETE — old_value = snapshot до удаления (вызывается до
perform_destroy, пока pk не обнулился), new_value = None.

Для FILL_SAMPLES — new_value = snapshot + created_samples.

Для PLACE — old_value / new_value (status и место меняются).

Для CREATE_IN_CELL — new_value = snapshot + created_samples + cell_id.

Endpoint: GET /storage/containers/{id}/history/ (action
history на ContainerViewSet). Возвращает AuditLog по
entity_type="Container", entity_id=id, отсортированный по
-created_at. Сериализатор — AuditLogSerializer (с
username, action_display — русские метки).

Сервис: apps/users/services.py::log_audit — тонкая обёртка
над AuditLog.objects.create. Аноним → user = NULL
(системное действие).

Причина:

Кладовщику нужна прозрачность «кто, когда, что делал с тарой» —
полезно при инвентаризации и разборе ошибок.

Compact snapshot (вариант А) — читаемо в UI, diff old → new
по ключам генерируется на фронте.

Явный сервис — прозрачно, без сигналов (1.58).

Где: backend/apps/users/services.py (новый),
apps/users/serializers.py (AuditLogSerializer),
apps/storage/views.py (_container_snapshot, вызовы
log_audit, action history),
apps/storage/tests/test_container_history.py (8 тестов).
UI: web/src/components/ContainerHistoryTab.tsx (2f-14b).

Источник: 2f-14a (backend) + 2f-14b (web), 2026-10-27.
Статус: ✅ действует.

1.71. 2026-10-27 — print_batch_status в ContainerSerializer (2f-17b)
Решение: в ответ GET /storage/containers/ и
GET /storage/containers/{id}/ добавлено поле
print_batch_status — статус последней не-CANCELLED партии
печати, в которую входит тара.

Значения:

null — тары нет ни в одной активной партии (или только в
CANCELLED).

"DRAFT" — в черновике.

"READY" — готова к печати.

"PRINTED" — напечатана.

Вариант А из трёх: берётся последняя не-CANCELLED партия
(.exclude(batch__status="CANCELLED")). Если тара в
DRAFT → CANCELLED → DRAFT — показывается DRAFT (в работе
снова). Если только в CANCELLED — null.

Реализация:

ContainerSerializer.print_batch_status — SerializerMethodField.

ContainerViewSet.get_queryset — prefetch_related(Prefetch( "print_batch_items", queryset=PrintBatchItem.objects .select_related("batch").exclude(batch__status="CANCELLED") .order_by("-batch__created_at"), to_attr="active_print_items")).
Без N+1.

get_print_batch_status — getattr(obj, "active_print_items", None): если prefetch был — items[0].batch.status, иначе —
fallback через точечный запрос (одиночный GET).

Важно: PrintBatchItem.container имеет
related_name="print_batch_items" (не дефолтный
printbatchitem_set). Учитывать при prefetch.

Причина:

Кладовщику в реестре тары нужна информация «в какой партии
тара и на какой стадии печать» — одной иконкой (4 цвета).

Раньше был только label_printed_at («напечатана / нет»).

Prefetch — чтобы не было N+1 на списке (50 тар).

Где: backend/apps/storage/serializers.py
(ContainerSerializer.print_batch_status),
backend/apps/storage/views.py (Prefetch в ContainerViewSet.get_queryset),
backend/apps/storage/tests/test_container_print_status.py
(4 теста), web/src/api/containers.ts (print_batch_status
в типе Container, PrintBatchStatus).

Источник: 2f-17b, 2026-10-27.
Статус: ✅ действует.

1.72. 2026-10-27 — ContainerDetailDialog: единое окно тары (2f-17c)
Решение: клик по таре в /containers (и в CellContentsDialog
в топологии) открывает единое окно ContainerDetailDialog
с шапкой, кнопками и 3 вкладками. Цепочка
Fill → Save → ContainerPreview убрана.

Шапка:

номер, Н/З, ТИ, участок, статус.

Кнопки справа:

[Предпросмотр] — всегда, открывает ContainerPreviewDialog
(2 вкладки: Этикетка / QR);

[Разместить] — только для PENDING_FILLING / PENDING_PLACEMENT,
открывает PlaceContainerDialog;

[Местоположение] — только для ACTIVE с cell_id,
navigate('/topology?cell_id=...').

Вкладки:

Пробы — таблица с фильтром, edit/delete, массовая смена
статуса (как раньше в ContainerPreviewDialog).

Редактирование — FillContainerContent (из 2f-17a):
сверху — строка добавления диапазонов + таблица добавленных;
ниже — список существующих проб; внизу — Итого + Сохранить / Отмена.

История — ContainerHistoryTab (из 2f-14b).

ContainerPreviewDialog переделан: из 4 вкладок (Список /
Этикетка / QR / История) осталось 2 вкладки: Этикетка / QR.
Открывается только из шапки ContainerDetailDialog по
«Предпросмотр».

AddToPrintBatchDialog доработан: выбор «Новая партия /
Существующая (DRAFT)» через usePrintBatches({status: "DRAFT"}).
После успешного add-containers инвалидирует
["containers"], ["container"], ["container-history"],
["print-batches"], ["print-batch", id] — иконка печати в
реестре обновляется автоматически (2f-17c-fix).

ContainersPage:

handleRowClick → ContainerDetailDialog (вместо
FillContainerDialog).

Колонка «Этикетка» → иконка по print_batch_status
(4 цвета: серая / жёлтая / синяя / зелёная).

Кнопка [Создать тару] (CreateContainersDialog) остаётся
отдельной.

CellContentsDialog:

клик на тару → ContainerDetailDialog;

CreateInCellDialog + FillContainerDialog (создание тары в
ячейке) — без изменений, после заполнения →
ContainerDetailDialog.

FillContainerContent:

кнопка «Предпросмотр» внизу убрана — она теперь только в
шапке ContainerDetailDialog.

Порядок блоков: добавление диапазонов вверху, существующие
пробы — ниже.

Причина:

Цепочка Save → Preview избыточна: пользователь хочет видеть
всё в одном окне, переключать вкладки.

Иконка печати по print_batch_status — полезная информация в
реестре.

Выбор существующей партии печати — реальная потребность
(сейчас можно было только создать новую).

Где: web/src/components/ContainerDetailDialog.tsx (новый),
web/src/components/ContainerPreviewDialog.tsx,
web/src/components/AddToPrintBatchDialog.tsx,
web/src/components/FillContainerContent.tsx,
web/src/pages/ContainersPage.tsx,
web/src/components/CellContentsDialog.tsx.

Источник: 2f-17c (+ фиксы в процессе), 2026-10-27.
Статус: ✅ действует.

2. Что не делаем и почему
Не используем SampleParts. Разделение — вне WMS.

Не храним две колонки для Н/З. Не масштабируется.

Не заставляем лаборатории использовать наш формат.

Не переклеиваем старые этикетки.

Не используем закрытые лицензии в ядре.

Не создаём кастомную модель User.

Не используем Django fixtures для seeds.

Не запускаем Django-команды через кнопку «Run» в VS Code.

Не клеим QR на поддоны и пробы в MVP.

Не удаляем пробы физически (soft — DISPOSED; hard —
только через явный DELETE с обработкой ProtectedError,
в составе ReceiptItem — каскадом, в составе Container —
через ?force=true).

Не блокируем размещение при превышении вместимости.

Не реализуем bin packing и учёт веса в MVP.

Не реализуем логику керна в MVP.

Не патчим миграции v1 через 0002.

Не требуем не-NULL для pallet/container в move item.

Не используем session-based auth для API.

Не пишем OpenAPI вручную.

Не создаём SampleDecryption на MVP.

Не парсим номер пробы позиционно.

Не навязываем свой формат Excel.

Не используем pillow 10.4. Версия 11.3.

Не храним email-уведомления в MVP Портала.

Не полагаемся на сортировку кириллицы в БД.

Не импортируем модели напрямую при циклах.

Не печатаем ID под QR (внутри payload, дубль не нужен).

Не масштабируем шрифт этикетки вниз — 10 pt всегда.

Не разрываем этикетку между листами A4.

Не используем A5 как лист печати — отложено (2.x).

Не используем Django signals для sync-логики (см. 1.58).

Не используем Django signals для аудита (см. 1.70).

Не создаём тару с обязательным container_number на шаге
bulk-create — заготовка создаётся без номера, номер
присваивается на шаге fill-samples (см. 1.60).

Не считаем Container.container_number глобально
уникальным (см. 1.61). Не полагаемся на него как на
идентификатор — для этого есть id.

Не задаём маппинг PENDING_FILLING → Sample.status в
sync_sample_status_for_container (см. 1.62) — у такой тары
проб быть не должно.

Не используем полные этикетки тары для QR секций/ячеек
(см. 1.63) — отдельный PDF-рендер, только QR + адрес.

Не обнуляем draft-поля после fill-samples (см. 1.69) —
обновляем актуальными значениями из запроса, чтобы они
оставались в интерфейсе.

Не используем baseUrl в tsconfig.json — deprecated
в TS 6, удалён в TS 7. paths работают от самого tsconfig
(TS ≥ 4.4), 2f-8-fix.

Не пишем аудит через Django signals — только явный
вызов log_audit() из actions (1.70).

Не считаем print_batch_status = CANCELLED — только
последняя не-CANCELLED партия, иначе null (1.71).

3. Глоссарий
Данные
Термин	Что значит
Проба (Sample)	Физическая единица хранения = навеска.
Навеска	То же, что Проба.
Наряд-заказ (Н/З)	Группа проб. INCOMING / CODED.
Входящий Н/З	Название до шифровки.
Зашифрованный Н/З	Название после шифровки.
Тип исследования (ТИ)	ResearchType. ШЛ, ХА, ИЗ.
Участок (Site)	Место отбора проб.
Лаборатория (Laboratory)	Откуда пришла проба.
Тара (Container)	Физический контейнер.
Тара-заготовка	Container без container_number, с draft-полями. Создана через bulk-create в статусе PENDING_FILLING.
Draft-поля тары	draft_site, draft_research_type, draft_work_order_coded, draft_work_order_incoming — «черновые» атрибуты, заполняются на шаге заготовки, обновляются актуальными значениями из запроса после fill-samples (1.69). В интерфейсе остаются, чтобы не терять контекст.
Тип тары (ContainerType)	Общий или для конкретной лаборатории.
Поддон (Pallet)	«Тихий» объект. OneToOne с ячейкой.
Ячейка (Cell)	Место на ярусе. 1 поддон.
Секция	Пролёт с 4 ярусами A–D.
Скважина (Well)	Источник пробы.
Партия (Receipt)	Группа тары, приехавшая одной машиной.
Рейс (Shipment)	Отправка. INBOUND / OUTBOUND.
Партия печати (PrintBatch)	Корзина тар для массовой печати этикеток.
Группа (Н/З × ТИ)	Контекст, внутри которого номер тары уникален (см. 1.61).
AuditLog	Журнал значимых действий (создание, изменение, удаление, заполнение, размещение). Пишется вручную через log_audit() (1.70).
print_batch_status	Статус последней не-CANCELLED партии печати, в которую входит тара. 4 значения: null / DRAFT / READY / PRINTED (1.71).
Процесс
Термин	Что значит
Шифровка	Присвоение Н/З нового названия.
Приёмка	Поступление тары.
Двухфазная приёмка	Excel → предзаполнение → подтверждение.
Акт приёмки	PDF с расхождениями (см. 1.50).
Формирование поддона	Сбор тар на поддон.
Выборка (picking)	Извлечение проб по списку.
Отправка (shipment)	Группа проб.
Утилизация	Soft-delete (DISPOSED).
Инвентаризация	Сверка физического наличия.
Расхождение (issue)	Проблема по инвентаризации.
Помощник по сортировке	Рекомендация места.
Префикс	Код участка или лаборатории в номере пробы.
Партия (шифр)	5 цифр в шифрованном номере.
Порядковый номер (sequence)	Последние цифры номера пробы.
Портал лаборатории	Веб-раздел для лабораторий.
Продолжение этикетки	Вторая этикетка без шапки, только список проб.
Sync-сервис	Явная функция синхронизации статусов (см. 1.58).
Аудит	Журнал действий с объектом, доступный через GET /containers/{id}/history/ (1.70).
Инфраструктура
Термин	Что значит
Docker Compose	PG в контейнере (домашний ПК).
Портативный PostgreSQL	PG без установки (рабочий ПК).
poetry run	Запуск в venv.
JWT	JSON Web Token.
drf-spectacular	Генератор OpenAPI 3.
fpdf2	Библиотека для генерации PDF (чистый Python).
UI
Термин	Что значит
Дашборд	Главный экран.
Сканер	Экран сканирования.
Виртуальный вид секции	Ярусы A–D и ячейки.
Корзина печати	Пул тар для массовой печати.
Рабочая область рейса	Основной экран сборки рейса.
Единое окно тары	ContainerDetailDialog (шапка + 3 вкладки + кнопки), 1.72.
Модалка предпросмотра	ContainerPreviewDialog (2 вкладки: Этикетка / QR), 1.72.
4. Что НЕ значат эти термины
«Часть пробы» — не используется. Есть навеска.

«Логическая проба» — не сущность в системе.

«Ячейка» — не слот на 3 поддона. 1 поддон.

«Поддон» — «тихий» объект, без QR и pallet_code.

«Наряд-заказ» — входящий и зашифрованный — разные строки.

«Проба» — не уникальна по номеру.

«User» — Django-овский.

«Справочник» — редактируемый, не жёсткий choices.

«Префикс» — не часть sequence.

«Партия в номере» — не Receipt.

«Рейс» — не одна тара.

«ContainerType.laboratory = NULL» — не «без лаборатории»,
а «общий тип, доступный всем».

«Тара-заготовка» — не «пустая тара физически». Это Container
без container_number, ожидающий заполнения пробами.

«Container.container_number» — не уникален глобально
(см. 1.61). Не идентификатор — это метка внутри группы
(Н/З × ТИ). Идентификатор — id (в QR: WMSG:CONTAINER:<id>).

«PENDING_FILLING» — не «просто пустая тара физически»,
а состояние в системе: тара создана, пробы ещё не заведены.
Нормальное состояние сразу после импорта/создания. См. 1.62.

«Draft-поля тары» — не «черновик, который надо удалить
после сохранения». Обновляются актуальными значениями и
остаются в интерфейсе. См. 1.69.

«baseUrl в tsconfig.json» — не используется.
paths резолвятся от самого tsconfig.json (TS ≥ 4.4).
baseUrl deprecated в TS 6, удалён в TS 7. См. 2f-8-fix.

«AuditLog» — не Django signals, не «автоматически на всё».
Только явные вызовы log_audit() из actions. См. 1.70.

«print_batch_status» — не «все партии, где была тара».
Только последняя не-CANCELLED. См. 1.71.

«ContainerDetailDialog» — не «редактор». Это просмотр +
действия в одном окне (пробы / редактирование / история).
См. 1.72.