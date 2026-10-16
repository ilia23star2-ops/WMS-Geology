# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-10-16

---

## Где мы

**Активная серия:** `feature/2.x-web-v2` — расширение web-клиента.

**Текущий заход:** серия `2f` (полный CRUD в web + полировка).
Закрыто: `2f-1`, `2f-2a`, `2f-2b`, `2f-2c`, `2f-3a`, `2f-4a`,
`2f-4b`, `2f-4c-1`, `2f-4c-2`, `2f-5a-1`, `2f-5a-2`, `2f-5b-fix`,
`2f-5c-1`, `2f-5c-2`, `2f-5c-3`. Следующий — `2f-6`.

**Предыдущие заходы:**
- `receiving-3` (3a → 3d-3): экран сверки, `/questions` удалён,
  `conflicts` / `check` / `complete`, PDF «Акт приёмки».
- `3f-1` / `3f-1b` / `3f-2`: PDF акта, stale tests, кнопка в web.
- **2f-1**: колонки «Н/З», «ТИ», фильтры, edit/delete тары.
- **2f-2a**: группированный список проб (Н/З × ТИ).
- **2f-2b**: CRUD + dispose/restore/delete проб.
- **2f-2c**: dev-логирование API-запросов.
- **2f-3a**: CRUD справочников (ТИ, участки, лаборатории).
- **2f-4a**: топология (Room → Rack → Section → Tier → Cell).
- **2f-4b**: поддоны в ячейках (`PalletDialog`).
- **2f-4c-1**: автогенерация QR Section/Cell + PDF-рендер
  (сетка 2×3, QR 65×65).
- **2f-4c-2**: QR-кнопки в UI топологии (одиночные + batch ячеек).
- **2f-5a-1**: backend — каскадное удаление `ReceiptItem`.
- **2f-5a-2**: web — edit/delete строк приёмки, отмена партии.
- **2f-5b-fix**: после импорта с вопросами → сразу на экран сверки.
- **2f-5c-1**: backend — статус `PENDING_FILLING` + data-migration.
- **2f-5c-2**: web — статус «Ожидает заполнения» в UI.
- **2f-5c-3**: web — draft-поля в `ContainerEditDialog`.

**Что готово (backend, серия 2.x-web-v2):**
- `current_location` в `SampleSerializer` + фильтры (`?q=`,
  `?no_work_order=`).
- `GET /samples/grouped/` — группировка по Н/З + тип.
- `Sample.STATUS_PENDING_PLACEMENT` + сервис
  `sync_sample_status_for_container`.
- `POST /storage/containers/bulk-create/` — только тары
  (заготовки, `container_number` опционален, draft-поля).
- `POST /storage/containers/{id}/fill-samples/` — пробы для тары
  (присваивает `container_number`, обнуляет draft-поля).
- Excel-импорт: `target_date` (обязательно), `duplicate_action`
  (cancel/overwrite/create), 409 на дубликат.
- **Серия 2.x-receiving (2026-10-14):**
  - Парсер с группами «типы + Дата», шапка до `MAX_HEADER_SEARCH`,
    строка типа тары, `1+1`, список дат.
  - Сервис `apply_shipment_import`: `Shipment INBOUND` + `Receipt`
    + `ReceiptItem` + `Container` (draft).
  - Эндпоинт `POST /import-sessions/import-shipment/`.
- **Серия receiving-3 (2026-10-14 — 2026-10-15):**
  - `ReceiptItem.container_type` (FK, nullable) — миграция `0002`.
  - `GET /receipts/{id}/conflicts/` — неразобранные
    `NEEDS_CONFIRMATION` + `suggested_count`.
  - `POST /receipts/{id}/resolve-conflicts/` — разбор конфликтов.
  - `POST /receipts/{id}/check/` — сверка тары (batch).
  - `POST /receipts/{id}/complete/` — завершение приёмки.
  - `Container.container_number` — **без unique** (миграция
    `storage/0006`). Семантика: номер тары внутри группы
    (Н/З × ТИ), идентификатор — `id`.
- **Пачка 3f-1 (2026-10-15):**
  - `GET /receipts/{id}/act/` — PDF «Акт приёмки»
    (только для `status=CONFIRMED`).
- **Пачка 2f-1 (2026-10-16):**
  - Фильтры `?draft_work_order_coded=` (icontains) +
    `?draft_research_type_id=` в `/storage/containers/`.
  - `DELETE /storage/containers/{id}/` → 409 при `ProtectedError`.
- **Пачка 2f-2b (2026-10-16):**
  - `POST /samples/{id}/dispose/` — soft-утилизация с аудитом.
  - `POST /samples/{id}/restore/` — вернуть из утилизации.
  - `DELETE /samples/{id}/` → 409 при `ProtectedError`.
- **Пачка 2f-4c-1 (2026-10-16):**
  - `Section.save()`, `Cell.save()` — автогенерация `qr_code`
    (payload `WMSG:SECTION:<id>` / `WMSG:CELL:<id>`).
  - `GET /storage/sections/{id}/qr.pdf/` — PDF с QR секции.
  - `GET /storage/cells/{id}/qr.pdf/` — PDF с QR ячейки.
  - `POST /storage/sections/qr-batch/` — PDF с партией QR
    (Section + Cell, сетка 2×3, QR 65×65).
- **Пачка 2f-5a-1 (2026-10-16):**
  - `DELETE /receipt-items/{id}/` — каскадное удаление
    (тара + её пробы + строка) одной транзакцией.
- **Пачка 2f-5c-1 (2026-10-16):**
  - `Container.STATUS_PENDING_FILLING` («Ожидает заполнения») —
    новый начальный статус. Миграция `storage/0008` +
    data-migration: старые `PENDING_PLACEMENT` без проб →
    `PENDING_FILLING`.
  - `bulk-create` и `check_receipt` создают тары в этом статусе.
  - `fill-samples` переводит `PENDING_FILLING → PENDING_PLACEMENT`.

**Что готово (web):**
- Логин, layout, главная, тара, пробы, печать, справочники
  (серия `2.x-web`).
- **Серия 7a (2026-10-13 — 2026-10-14):**
  - Форма «Создать тару» — заготовки с draft-полями.
  - Парсер строки ввода проб (`parseSampleInput`, 18 юнит-тестов).
  - Хук `useFillSamples`.
  - Форма «Заполнить тару пробами» — шапка read-only, номер тары,
    парсер диапазонов, блокировка дубликатов.
  - Диалог предпросмотра `ContainerPreviewDialog` — 3 вкладки
    (Список / Этикетка / QR) + кнопки «В партию печати».
  - Интеграция: после save → автоматически открывается preview.
- **Серия receiving-3 + 3f-2 (2026-10-14 — 2026-10-15):**
  - Экран сверки `/receiving/:id/check` (`ReceiptCheckPage`).
  - Разбор конфликтов, сверка тары, завершение приёмки.
  - Кнопка «Акт приёмки» — открывает PDF в новой вкладке
    (только для `CONFIRMED`).
- **Пачка 2f-1 (2026-10-16):**
  - Колонки «Н/З» (draft) и «ТИ» (draft) в реестре тары.
  - Фильтры «Н/З» (текст) и «ТИ» (селект).
  - `ContainerEditDialog` — edit тары.
  - Delete тары (с confirm, обработка 409).
- **Пачка 2f-2a (2026-10-16):**
  - `SamplesGroupedList` — группированный список (Н/З × ТИ),
    аккордеоны, карточки тар, чипы проб.
  - Единый вид для `/samples` — без вкладок.
- **Пачка 2f-2b (2026-10-16):**
  - `SampleEditDialog` — edit / dispose / restore / delete пробы.
  - Клик по чипу пробы в группированном списке.
- **Пачка 2f-2c (2026-10-16):**
  - Dev-логирование API-запросов в консоль (`import.meta.env.DEV`).
- **Пачка 2f-3a (2026-10-16):**
  - `CatalogsPage` — CRUD справочников (ТИ, участки, лаборатории).
  - `CatalogEntityDialog` — единый диалог создания/правки.
  - Удаление с обработкой PROTECT (409).
  - Деактивация (`is_active=false`).
- **Пачка 2f-4a (2026-10-16):**
  - Новая страница `/topology` — двухпанельный вид: дерево
    (Room → Rack → Section → Tier) слева, таблица ячеек справа.
  - CRUD на всех пяти уровнях: Room, Rack, Section, Tier, Cell.
  - `TopologyEntityDialog` — единый диалог для всех сущностей.
  - Автогенерация `Cell.full_address` из пути + ручная правка.
  - Пункт «Топология» в sidebar.
- **Пачка 2f-4b (2026-10-16):**
  - `PalletDialog` — создание/правка/удаление поддона в ячейке.
  - Колонка «Поддон» в таблице ячеек.
- **Пачка 2f-4c-2 (2026-10-16):**
  - Иконка «QR» у Section в дереве (одиночный PDF).
  - Иконка «QR» в таблице ячеек (одиночный PDF).
  - Чекбоксы в таблице ячеек + кнопка «Печать QR (N)»
    (batch, `POST /storage/sections/qr-batch/`).
- **Пачка 2f-5a-2 (2026-10-16):**
  - `ReceiptItemEditDialog` — edit строки приёмки.
  - Иконки Edit/Delete в таблице тар на `/receiving/:id`.
  - Кнопка «Отменить партию» на `/receiving/:id` и `/check`.
  - Обработка 409 при удалении (проба в отгрузке).
- **Пачка 2f-5b-fix (2026-10-16):**
  - После импорта Excel с вопросами → сразу переход
    на `/receiving/:id/check`, где карточки конфликтов.
- **Пачка 2f-5c-2 (2026-10-16):**
  - Статус `PENDING_FILLING` в UI: метка «Ожидает заполнения».
  - Клик по таре в этом статусе → открывает форму заполнения
    пробами (независимо от того, есть ли номер).
  - Фильтр «Статус» на `/containers` — 5 значений.
- **Пачка 2f-5c-3 (2026-10-16):**
  - `ContainerEditDialog` — добавлены draft-поля (участок, ТИ,
    Н/З вх./тек.).

**Что нужно добавить (web, серия 2f — осталось):**
- **2f-6:** рейсы — edit/delete/отмена.
- **2f-7:** партии печати — hard-delete черновиков,
  сопроводительный PDF; ТД-30.
- **2f-7b:** «+ Добавить тару» на экране сверки (3b-3).
- **2f-7c:** QR топологии в партиях печати (обсудить в 2f-7).
- **2f-8:** Н/З — новая вкладка (создание/правка).
- **2f-9:** перемещения — 3 подзахода (пул / экран / печать QR).
- **2f-10:** инвентаризация — новая вкладка.
- **2f-11:** глобальный поиск `/search` (ТД-22).
- **2f-12:** макет 4 — редактирование скважины.
- **2f-4c-3:** batch QR секций (то же, что для ячеек).
- **2f-14:** история операций с тарой (создание, перемещения).
- ТД-28 (fallback в парсере), ТД-29 (hint префиксов) — низкий
  приоритет.

**Что готово (mobile):**
- Логин, logout, refresh токенов.
- Сканер QR, карточка тары, список проб внутри (серия `2.x-mobile`).

**Backend:** 762 теста.
**Web:** 24 юнит-теста.
**Mobile:** 32 юнит-теста.

**Ближайшая работа:**
- `2f-6` — рейсы (Shipment): edit/delete/cancel.
- Дальше — по таблице 2f в `PLAN.md`.
- ТД-28, ТД-29 — отложить до появления реальной необходимости.

---

## Стратегия разработки

> **Web — основной клиент. Mobile — по требованию.**

1. **Web-фичи — первый приоритет.**
2. **Mobile — по требованию** (если web-фича требует проверки
   на устройстве — сканер, камера).
3. **Роли и права — после.** Пока CRUD в UI открыт всем.
4. **`Receipt`** — только для Excel и акта приёмки.

---

## Что готово

### Инфраструктура
- Python 3.14 + Poetry + Django 5.2 + DRF.
- PostgreSQL: Docker (домашний ПК) / портативный (рабочий).
- JWT, OpenAPI, 10 приложений.
- Node 20+, Vite 8, React 19, MUI 9.
- Flutter 3.47 + Dart 3.13.

### Backend (762 теста)

| Приложение | Что внутри |
|---|---|
| `storage` | Топология A–D, Pallet, ContainerType, Container (+draft-поля, nullable number, **без unique**, `PENDING_FILLING`), ContainerComment, QR-этикетка (PDF), QR топологии (`/qr.pdf/` для Section/Cell, `qr-batch`), bulk-create + fill-samples |
| `samples` | ResearchType, Site, Laboratory, Well, Sample (+`PENDING_PLACEMENT`, dispose/restore), SampleWorkOrder, sync-сервис |
| `work_orders` | WorkOrder (self-ref + site) |
| `receiving` | Receipt, ReceiptItem (+`container_type`, каскадное удаление), ImportSession + Excel-парсер (+группы, тип тары) + сервис импорта + `apply_shipment_import` + `import-shipment`; actions `conflicts`, `resolve-conflicts`, `check`, `complete`, `act` |
| `picking` | PickList, PickListItem, Shipment (+ direction, статусы), ShipmentItem |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, InventoryIssue |
| `users` | Role, UserProfile, AuditLog + JWT auth |
| `labels` | QR-сервис, PDF-этикетки, QR-сетка, `PrintBatch` + `PrintBatchItem`, API корзины и печати, `act_service` (PDF «Акт приёмки») |

### Web (React, 24 юнит-теста)

| Раздел | Что внутри |
|---|---|
| Аутентификация | Zustand-стор, login-форма, protected routes, JWT-интерцептор с авто-refresh |
| Layout | MUI sidebar + header, адаптив |
| Главная | 4 карточки со счётчиками |
| Тара | DataGrid, фильтры (статус, тип, «Н/З», «ТИ»), edit (включая draft-поля), delete, PDF-этикетка, выбор в партию печати, форма «Создать тару», форма «Заполнить пробами», preview с 3 вкладками |
| Пробы | **Группированный список** (Н/З × ТИ), `SampleEditDialog` (edit / dispose / restore / delete) |
| Печать | Список партий, детали, add/remove тар, PDF |
| Справочники | **CRUD** (ТИ, участки, лаборатории) — создать/править/деактивировать/удалить |
| Приёмка | Список рейсов, детали, экран сверки `/receiving/:id/check`, кнопка «Акт приёмки», edit/delete строк, отмена партии |
| **Топология** | Дерево Room→Rack→Section→Tier + таблица ячеек, CRUD всех уровней, поддоны, QR-печать (одиночная + batch) |
| Dev-инфра | Логирование API в консоль (`import.meta.env.DEV`) |

**Чего нет:** экраны Н/З / перемещений / инвентаризации, глобальный поиск, экран отправки (OUTBOUND).

### Mobile (Flutter, 32 юнит-теста)

| Раздел | Что внутри |
|---|---|
| Аутентификация | `AuthProvider`, login, `TokenStorage` на `flutter_secure_storage` |
| API | `ApiClient` (Dio), JWT-интерцептор, `ContainerService`, `SampleService` |
| Главная | Приветствие + кнопка «Сканировать QR» + выход |
| Сканер | `mobile_scanner`, прицел, payload `WMSG:<TYPE>:<ID>` |
| Карточка тары | Поля тары + список проб внутри (pull-to-refresh) |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS` (64), `DATABASE` (v6), `API`,
  `SCENARIOS`, `UI` (v2), `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`.

---

## Известные грабли

### PostgreSQL
- **Домашний ПК:** Docker (`docker compose up -d`).
- **Рабочий ПК:** портативный `pg_ctl`, запуск вручную.
- **После `git pull` с миграциями — всегда `migrate`.**
- `wms_user` имеет право `CREATEDB`.

### Django
- Все команды — только через `poetry run python manage.py ...`.
- `CheckConstraint(condition=...)`, не `check=`.
- CHECK с NULL: `NULL = NULL` не TRUE.
- `ProtectedError` при удалении Container с пробами, ContainerType
  с контейнерами, Sample из PickListItem и ShipmentItem,
  Container из PrintBatchItem. ViewSets отдают 409 (2f-1, 2f-2b).
- **Каскадное удаление `ReceiptItem`** (2f-5a-1): view сам удаляет
  пробы → тару → строку в одной транзакции. `ProtectedError` на
  пробе → 409 с текстом.
- **`poetry lock`** после изменения `pyproject.toml`.
- **Циклические импорты** — использовать строковые ссылки.
- **Сортировка кириллицы в БД** — использовать `sort_order`.
- **`poetry env remove --all && poetry install`** после переезда проекта.
- **`apps/storage/services/` — пакет**, не модуль
  (`__init__.py` + `bulk_create.py` + `qr_topology.py`).
- **`apps/receiving/parsers/` — пакет** (`__init__.py` +
  `excel_parser.py` + `types.py`).
- **`apps/receiving/services/` — пакет** (`__init__.py` +
  `import_service.py`).
- **Django signals для sync-логики — не используем** (см. 1.58).
- **`transaction.set_rollback(True)` несовместим с `import_session.save()`
  внутри одного `atomic`** — использовать «сухой прогон» + `with
  transaction.atomic()` на блок записи (receiving-1b).
- **`get_object()` уважает фильтры `get_queryset`.** Для действий,
  которым нужны «скрытые» объекты (утилизированные пробы) —
  брать `Model.objects.filter(pk=pk).first()` напрямую (2f-2b,
  `SampleViewSet._get_sample_any`).
- **`Section.save()` / `Cell.save()` — двойной `super().save()`**:
  первый создаёт запись, второй пишет `qr_code` (2f-4c-1).

### API
- Аутентификация — JWT (`Authorization: Bearer <access>`).
- Pagination — `PageNumberPagination`, `PAGE_SIZE=50`.
- **Ключевой фильтр** `?work_order=` — учитывает linked_order.
- Custom actions: `link`, `complete`, `resolve`, `activate`, `pick`,
  `add-from-pick-list`, `execute`, `confirm`, `cancel`, `assemble`,
  `add-containers`, `remove-container`, `mark-ready`, `pdf`,
  `mark-printed`, `bulk-create`, `fill-samples`, `upload`,
  `import-shipment`, `conflicts`, `resolve-conflicts`, `check`,
  `act`, `dispose`, `restore`, `qr.pdf`, `qr-batch`.
- **URL-схема:** `/api/v1/storage/...`, `/api/v1/labels/...`,
  остальные приложения — **без префикса** (`/api/v1/samples/...`,
  `/api/v1/research-types/...`, `/api/v1/work-orders/...`,
  `/api/v1/receipts/...`, `/api/v1/import-sessions/...`).

### Домен
- Проба в системе = **навеска**. Не уникальна по номеру.
- Одна тара = один тип исследования.
- `Pallet` — «тихий» объект (OneToOne с Cell, без QR).
- `WorkOrders.linked_order_id` — self-ref INCOMING ↔ CODED.
- `Shipment.direction` — `INBOUND` / `OUTBOUND`.
- `ContainerType.laboratory` — NULL = общий.
- `PrintBatch.status` — soft через `CANCELLED`.
- `PrintBatchItem.container` — `PROTECT`.
- **Sample.STATUS_PENDING_PLACEMENT** синхронизируется со
  статусом тары через `sync_sample_status_for_container`.
- **Тара-заготовка**: `container_number = NULL`, draft-поля
  заполнены. После `fill-samples` — номер присвоен, draft обнулён.
- **Импорт рейса** (`import-shipment`): `Receipt.site = NULL`
  (участок — на `ReceiptItem.site`); один `Receipt` на рейс;
  `Shipment.status = SENT`; `Container.status = IN_TRANSIT`.
- **`Container.container_number` — НЕ уникален глобально**
  (DECISIONS 1.61).
- **`Container.STATUS_PENDING_FILLING`** — новый начальный статус
  (DECISIONS 1.62): тара создана, пробы ещё не положены.
  После `fill-samples` → `PENDING_PLACEMENT`.

### Генератор этикеток
- QR 25×25 мм в правом верхнем углу шапки.
- Ширина этикетки — из сетки `[110, 130, 150, 180, 210]` мм.
- Высота — из сетки `[37, 49, 74, 99, 148]` мм (делители A4).
- Авто-ширина колонок списка, шрифт 10 pt везде.
- Продолжения: вторая этикетка без шапки, только список.
- Лист A4: 1 в ряд, от левого верхнего угла, не разрывается.
- **QR-сетка:** 8 × 11 = 88 QR 25×25 на A4, общие линии реза.
- В QR — внутренний ID тары (`WMSG:CONTAINER:94`), не номер.
- **Печать партии: гибрид.** `GET /pdf/` при `READY` автоматически
  ставит `PRINTED`, `printed_at`, `printed_by`. Повторное скачивание
  не переписывает первую печать. Ручной override —
  `POST /mark-printed/`.
- Шрифт `DejaVuSans.ttf` — в `static/fonts/`, не в git.
- **Акт приёмки (3f-1):** `apps/labels/services/act_service.py`.
  Переиспользует `FONT_PATH`, `_check_font`, `_truncate_to_width`
  из `label_service`. A4 portrait: шапка / метаданные / сводка /
  таблица неприехавших / подписи.
- **QR топологии (2f-4c-1):** `apps/storage/services/qr_topology.py`.
  A4, сетка 2×3 = 6 QR на лист, QR 65×65 мм, адрес под QR
  (10 мм, шрифт 10 pt, обрезка «…»). `render_topology_qr_pdf(items)`.
  Для Section адрес = `Room / Rack / Section`, для Cell —
  `full_address`.

### Web
- **Vite proxy:** `/api/*` → `http://localhost:8000`. Backend должен
  быть запущен отдельно.
- **MUI X v9:** `GridRowSelectionModel = { type, ids: Set<GridRowId> }`,
  не массив. Импорт `GridRowId`.
- **MUI X v9:** `DataGrid` с `paginationMode="server"` требует
  `rowCount` и `paginationModel`.
- **MUI 9:** `Grid size={{ xs, sm, md }}` — новый синтаксис.
- **MUI 9:** `Stack alignItems` и `justifyContent` — через `sx`,
  не проп (TS ругается).
- **MUI 9:** `Object.keys(...) as Type[]` внутри JSX ломает парсер.
  Выносить в константу модуля (пример: `ALL_STATUSES` в
  `ContainerEditDialog` / `SampleEditDialog` / `PalletDialog`).
- **React Router v7:** API совместим с v6.
- **Zustand:** при F5 состояние сбрасывается — race condition
  закрыт флагом `isBootstrapping`.
- **Vite build:** warning «chunks > 500 kB» — ожидаемо.
  Code-splitting отложен (ТД-21 / ТД-35). Бандл ~1300 kB
  (gzip ~389 kB).
- **URL справочников:** `/research-types/`, `/sites/`,
  `/laboratories/` — **без префикса** `/samples/`.
- **MUI icons:** `DeleteOutline` **не существует**, использовать
  `Delete` (`@mui/icons-material/Delete`). Для топологии: `AccountTree`.
- **`parseSampleInput`:** префикс ищется **точно** в
  `Laboratory.prefixes` + `Site.match_patterns`. Fallback — ТД-28.
- **Диалог заполнения:** `fillContainerWithSamples` **обнуляет
  draft-поля** тары. `ContainerPreviewDialog` после save
  подтягивает обновлённую тару (с номером, без draft).
- **`FileResponse` в тестах:** у него нет `.content`, читать
  `streaming_content` (3f-1).
- **React Query Devtools не ставим:** рабочий ПК за корпоративной
  сетью, `registry.npmjs.org` недоступен (ТД-36). Вместо панели —
  dev-логирование в `client.ts` (`import.meta.env.DEV`).
- **Ветка `fix/2.x-web-v2-bundle-7`** — WIP, не мержить, форма
  создания тары переделана в 7a-3.
- **`TopologyPage`**: `CellPalletChip` делает N+1 запрос (по одному
  на ячейку). Для 3–5 ячеек яруса — норм. Если будет 50 — добавить
  `pallet` в `CellSerializer`.

### Mobile
- **URL API:** `config.dart`, `_apiHostOverride` — **в git**.
  При смене сети — править. На эмуляторе — `null` (идёт на `10.0.2.2`).
- **Backend должен слушать `0.0.0.0:8000`** (не `localhost`), иначе
  телефон/планшет не подключится.
- **`DJANGO_ALLOWED_HOSTS`** в `.env` должен включать IP машины
  (или `*` для dev). `.env` — **не в git**.
- **Dio + `post`/`patch`:** обязательно `Content-Type: application/json`.
- **`flutter_secure_storage`:** используется для JWT-токенов
  (Android Keystore).
- **`mobile_scanner`:** `DetectionSpeed.noDuplicates`.
- **Конфликт имён `Container`:** Flutter-виджет vs наша модель.
  Решение: `import 'package:flutter/material.dart' hide Container;`.
- **NDK 28.2.13676358** — обязателен для Flutter 3.47.
- **Android SDK Platform 36** — обязателен.
- **Кириллица в пути** проекта ломает Dart-анализатор.
- **`flutter pub get`** после каждого `pubspec.yaml`.

### Инструменты
- Git — только терминал.
- **Домашний ПК:** UCRT64 (MSYS2), SSH `github.com:22`.
- **Рабочий ПК:** Git Bash (MINGW64), SSH через порт 443.
- VS Code может дописывать `.vscode/settings.json` — откатывать.
- **UCRT64 (MSYS2)** ломает `manage.py shell -c "..."` — использовать
  временный скрипт или одной строкой.
- **`cat > file << 'EOF'`** — надёжный способ заменить файл в
  MSYS2-терминале (Ctrl+V в REPL ломается).
- **`ipconfig`** в MSYS2 ломается на кодировке — использовать
  `powershell -Command "(Get-NetIPAddress ...).IPAddress"` или
  `ipconfig | iconv -f CP866 -t UTF-8 | grep -a "IPv4"`.
- **Пути git-команд из `backend/`** — без префикса `backend/`
  (терминал уже в `backend/`).
- **Пути git-команд из корня проекта** — с префиксом `backend/`
  или `web/` (в зависимости от места).
- **`git checkout -b` может упасть** на «already exists» — тогда
  проверить `git branch --show-current` перед коммитом.

---

## Не трогать

- `RULES.md` — универсальные правила.
- `TEMPLATES.md` — базовые шаблоны.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` (только `.env.example`).
- Ветка `fix/2.x-web-v2-bundle-7` (WIP) — не мержить, не удалять.

---

## Правила текущей сессии

- Кодовая фаза.
- Каждый заход — 1–3 файла (пачки-исключения для boilerplate).
- Файлы выдаются единым блоком.
- Все Django-команды — через `poetry run`.
- Все web-команды — `cd web && npm ...`.
- Все mobile-команды — `cd mobile && flutter ...`.
- Docs — отдельной пачкой.

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`

Остальное — по запросу.