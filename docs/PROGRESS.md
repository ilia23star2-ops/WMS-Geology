# PROGRESS.md — история закрытых заходов

> Хронология. Свежее — сверху.
> Метрики раз в серию — в конце каждого раздела.

---

## Серия `feature/3.x-offline`

**Дата:** 2026-10-28 — активна.
**Ветка:** `fix/2.x-mobile-bundle-c-2`.
**Контекст:** Офлайн-режим для мобильного приложения. SQLite + SyncQueue.

### Что закрыто (mobile)

- ✅ **`c-1`** — SQLite: таблицы `containers`, `samples`, DAO (`ContainerDao`, `SampleDao`), инициализация БД.
- ✅ **`c-2`** (2026-10-29) — `SyncService` (Pull): постраничная синхронизация с сервера (по 50 записей), DI для тестов (передача `saveContainers` / `saveSamples`).
  - `mobile/lib/services/sync_service.dart` — написан.
  - `mobile/test/services/sync_service_test.dart` — 4 теста (пустой ответ, одна страница, несколько страниц, ошибка).
  - **Сборка:** успешно собрано на домашнем ПК (Flutter 3.47.6, JDK 17, Gradle 9.3.1).
  - **Рабочий ПК:** подготовлена папка `work-pc-setup` для обхода прокси (сертификаты, `maven-local`, скрипт `setup.ps1`).

### В работе

- 🟡 **`c-3`** — Push-синхронизация (`SyncQueue`).
- 🟡 **`c-4`** — UI для офлайн-режима.

### Метрики

- **Mobile: 36 юнит-тестов** (было 32, +4 `sync_service_test.dart`).
- Backend: 779 тестов.
- Web: 24 юнит-теста.

---

## Серия `feature/2.x-web-v2`

**Дата:** 2026-10-12 — 2026-10-27.
**Ветка:** `feature/2.x-web-v2` (влита в `main`, архив).
**Контекст:** Расширение web-клиента: приёмка, ручной ввод тары
с пробами, полный CRUD в интерфейсе, полировка. Стратегия —
Web первый, Mobile по требованию. Backend на старте серии —
552 теста.

### Что закрыто (backend)

- ✅ **`bundle-1`** — `current_location` в `SampleSerializer`,
  фильтры `?q=` (icontains), `?no_work_order=`.
- ✅ **`bundle-2`** — `GET /samples/grouped/` (пагинация по
  группам Н/З + тип исследования).
- ✅ **`bundle-5`** — `POST /storage/containers/bulk-create/`
  (тара + пробы одним запросом). Позже переработан в 7a-1 / 7a-2.
- ✅ **`bundle-6a`** — фильтр по дате в Excel-импорте,
  поле `expected_date`.
- ✅ **`bundle-6b`** — `target_date` (обязательно),
  `duplicate_action` (cancel/overwrite/create), 409 на дубликат.
- ✅ **`bundle-7a-1`** — `Sample.STATUS_PENDING_PLACEMENT` +
  сервис `sync_sample_status_for_container` (явный вызов, без
  Django signals, см. решение 1.58). +12 тестов.
- ✅ **`bundle-7a-2`** — разделение bulk-create на два эндпоинта:
  `POST /storage/containers/bulk-create/` (только тары) +
  `POST /storage/containers/{id}/fill-samples/` (пробы для
  существующей тары). См. решение 1.59. −8 старых тестов,
  +18 новых.
- ✅ **`bundle-7a-2b`** — `Container`: 4 draft-поля
  (`draft_site`, `draft_research_type`, `draft_work_order_coded`,
  `draft_work_order_incoming`) + `container_number` → nullable.
  Заготовка создаётся без номера, номер присваивается в
  `fill-samples`, draft-поля обнуляются. См. решение 1.60.
  Миграция `0005_*`. −19 старых тестов, +26 новых.
- ✅ **`receiving-1a`** — backend: парсер — группы
  «типы + Дата», список дат в ячейке, составное количество `1+1`.
- ✅ **`receiving-1a-2`** — backend: парсер — поиск строки
  заголовков в первых `MAX_HEADER_SEARCH=20` строках, строка
  типа тары (обязательна для каждой колонки типа),
  `MISSING_CONTAINER_TYPE`.
- ✅ **`receiving-1b`** — backend: сервис `apply_shipment_import`:
  `Shipment` (INBOUND, SENT) + `Receipt` (site=NULL) +
  `ReceiptItem` + N `Container` (status=IN_TRANSIT, draft-поля).
  Спорные ячейки — в `parse_errors` с
  `code=NEEDS_CONFIRMATION` (3 reason). +16 тестов.
- ✅ **`receiving-1c`** — backend: эндпоинт
  `POST /import-sessions/import-shipment/`. +12 тестов views.
- ✅ **`receiving-3a`** — `multi_date_match` создаёт только
  вопрос `NEEDS_CONFIRMATION`, без `ReceiptItem`/`Container`.
- ✅ **`receiving-3b-1`** — `GET /receipts/{id}/conflicts/`
  + `POST /receipts/{id}/resolve-conflicts/` + `suggested_count`.
- ✅ **`receiving-3b-1-2a`** — `ReceiptItem.container_type`
  (FK на `ContainerType`, nullable), миграция `receiving/0002`.
- ✅ **`receiving-3b-2`** — `POST /receipts/{id}/check/`
  (сверка тары, batch). +14 тестов.
- ✅ **`receiving-3c`** — `POST /receipts/{id}/complete/`
  (завершение приёмки; блокирует при unresolved/EXPECTED).
- ✅ **`receiving-3d-3-fix-2`** — снять `unique=True`
  с `Container.container_number`, миграция `storage/0006`.
  См. решение 1.61.
- ✅ **`3f-1`** — `GET /receipts/{id}/act/` — PDF «Акт приёмки»
  (только `status=CONFIRMED`). `apps/labels/services/act_service.py`.
  +9 тестов (`test_receipt_act_endpoint.py`).
- ✅ **`3f-1b`** — stale tests: `Container.container_number`
  без unique (переделаны `test_container_number_unique` и
  `test_container_number_unique_validation`).
- ✅ **`2f-1`** — фильтры `?draft_work_order_coded=` (icontains)
  + `?draft_research_type_id=` в `/storage/containers/`;
  `DELETE /storage/containers/{id}/` → 409 при `ProtectedError`.
  +5 тестов (`test_container_filters.py`).
- ✅ **`2f-2b`** — `POST /samples/{id}/dispose/` +
  `POST /samples/{id}/restore/` (soft-утилизация с аудитом);
  `DELETE /samples/{id}/` → 409 при `ProtectedError`.
  +7 тестов (`test_sample_actions.py`).
- ✅ **`2f-4c-1`** — автогенерация `qr_code` для `Section` и
  `Cell` (`WMSG:SECTION:<id>` / `WMSG:CELL:<id>`);
  `GET /storage/sections/{id}/qr.pdf/` +
  `GET /storage/cells/{id}/qr.pdf/` +
  `POST /storage/sections/qr-batch/`; PDF через
  `apps/storage/services/qr_topology.py` (A4, сетка 2×3,
  QR 65×65). Миграция `storage/0007` (AlterField по help_text).
  +10 тестов (`test_qr_topology.py`).
- ✅ **`2f-5a-1`** — каскадное удаление `ReceiptItem`:
  `DELETE /receipt-items/{id}/` одной транзакцией удаляет
  пробы → тару → строку; `ProtectedError` на пробе → 409.
  +5 тестов (`test_receipt_item_delete.py`).
- ✅ **`2f-5c-1`** — новый статус `Container.STATUS_PENDING_FILLING`
  («Ожидает заполнения»); `bulk-create` и `check_receipt`
  создают тары в этом статусе; `fill-samples` переводит
  `PENDING_FILLING → PENDING_PLACEMENT`. Миграция `storage/0008`
  + data-migration (старые `PENDING_PLACEMENT` без проб →
  `PENDING_FILLING`). Обновлены тесты `test_bulk_create.py`,
  `test_fill_samples.py`, `test_receipt_check.py`.
- ✅ **`2f-10`** — `POST /storage/containers/bulk-place/`
  (размещение в ячейку или на пол).
- ✅ **`2f-11c`** — `SampleGroupSerializer` и `ContainerSerializer`
  отдают `cell_id` и `pallet_id` для перехода в Топологию.
- ✅ **`2f-12a`** — `POST /storage/containers/create-in-cell/` —
  атомарное создание тары, проб и размещение.
  `?force=true` в `DELETE` тары (1.65, 1.67).
- ✅ **`2f-8 (backend)`** — `WorkOrder`: admin-регистрация
  (`apps/work_orders/admin.py` — новый), миграция
  `0003_alter_workorder_linked_order_and_more`, сериализаторы
  с `samples_count`, `containers`, `linked_order_number`,
  `prefetch_related` в `views.py`, `TYPE_CODED` label → «Текущий».
- ✅ **`2f-8-fix`** — stale-импорты в `test_label_service.py`:
  удалены `A4_LABEL_GAP_MM` (удалён в 2f-9b) и `_qr_grid_capacity`
  (удалён в 2f-9b), `test_qr_grid_capacity_88` переписан
  через `_qr_grid_dimensions()`.
- ✅ **`2f-8-fix-2`** — stale-тесты под правки прошлых заходов:
  - `test_patch_non_draft_fails` → `..._comment_non_draft_allowed`
    (2f-7e: `name`/`comment` в любом статусе);
  - `test_bulk_create_existing_container` → `..._duplicate_number_allowed`
    (1.61: глобальный UNIQUE снят);
  - `test_fill_samples_number_conflict` → `..._duplicate_number_allowed` (1.61);
  - `test_fill_samples_active_container` → `..._still_creates_pending_placement`
    (2f-5c-1);
  - `test_fill_samples_clears_draft_fields` → `..._updates_draft_fields`
    (2f-7f: draft-поля обновляются из запроса, не обнуляются);
  - `test_issued_container_sets_sample_issued` → `..._does_not_touch_sample`
    (2f-9c: маппинга нет);
  - `test_pending_decryption_sample_not_touched` — **удалён**
    (2f-9c: статуса нет);
  - `test_work_order_str_coded` — «Зашифрованный» → «Текущий»
    (2f-8: `TYPE_CODED` label).
- ✅ **`2f-14a`** — аудит операций с тарой: сервис
  `log_audit()` в `apps/users/services.py`, вызовы в 6 actions
  `ContainerViewSet` (`bulk_create`, `fill_samples`,
  `bulk_place`, `create_in_cell`, `perform_create`/`update`,
  `destroy`), action `history` → `GET /storage/containers/{id}/history/`,
  сериализатор `AuditLogSerializer` (с `username`, `action_display`).
  Снимок `_container_snapshot` — компактный (6 полей). См. 1.70.
  +8 тестов (`test_container_history.py`).
- ✅ **`2f-17b`** — `ContainerSerializer.print_batch_status`
  (`SerializerMethodField`) — статус последней не-CANCELLED
  партии печати. `prefetch_related("print_batch_items",
  to_attr="active_print_items")` в `ContainerViewSet.get_queryset` —
  без N+1. См. 1.71. +4 теста (`test_container_print_status.py`).

### Что закрыто (web)

- ✅ **`bundle-7a-3`** — форма «Создать тару» (заготовки).
  Кнопка на `/containers` → диалог с полями Участок, Н/З, чекбокс
  вх. Н/З, ТИ, Тип тары, Кол-во. Создаёт N заготовок через
  `bulk-create`.
- ✅ **`bundle-7a-4ab`** — парсер `parseSampleInput` +
  хук `useFillSamples`. 18 юнит-тестов парсера.
- ✅ **`bundle-7a-4c-1`** — форма «Заполнить тару пробами».
  Шапка read-only из draft-полей, поле номера тары, парсер
  диапазонов, блокировка дубликатов.
- ✅ **`bundle-7a-4c-2a`** — `useContainer`, `container_id`
  в фильтре проб, `fetchLabelPdfUrl`, `PENDING_PLACEMENT` в
  `SamplesPage`.
- ✅ **`bundle-7a-4c-2b`** — диалог `ContainerPreviewDialog`
  (3 вкладки: Список проб / Этикетка / QR).
- ✅ **`bundle-7a-4c-2c`** — интеграция — после save
  автоматически открывается preview.
- ✅ **`receiving-3d-1`** — API-хуки: `useReceiptConflicts`,
  `useResolveConflicts`, `useCheckReceipt`, `useCompleteReceipt`.
- ✅ **`receiving-3d-2`** — `ReceiptCheckPage`
  (страница сверки приёмки, `/receiving/:id/check`).
- ✅ **`receiving-3d-3`** — интеграция: роут, кнопка
  «Начать сверку», удаление `/questions`.
- ✅ **`3f-2`** — web: кнопка «Акт приёмки» на
  `ReceiptCheckPage` (`fetchReceiptActBlob` +
  `PictureAsPdfIcon`), открывает PDF в новой вкладке.
  Отдельно добавлен `fetchReceiptActBlob` в `api/index.ts`.
- ✅ **`2f-1`** — реестр тары: колонки «Н/З» (draft) и «ТИ»
  (draft), фильтры «Н/З» (текст) и «ТИ» (селект),
  `ContainerEditDialog` (edit), `Delete` с confirm
  и обработкой 409.
- ✅ **`2f-2a`** — группированный список проб:
  `SamplesGroupedList` (аккордеоны по Н/З × ТИ, карточки тар,
  чипы проб). Единый вид `/samples`, без вкладок.
- ✅ **`2f-2b`** — `SampleEditDialog` (edit / dispose / restore /
  delete пробы), клик по чипу пробы в группированном списке.
- ✅ **`2f-2c`** — dev-логирование API-запросов в консоль
  (`import.meta.env.DEV`). React Query Devtools **не ставили** —
  корпоративная сеть рабочего ПК блокирует `registry.npmjs.org`
  (ТД-36).
- ✅ **`2f-3a`** — справочники: CRUD для ТИ, участков,
  лабораторий. `CatalogEntityDialog` (единый диалог),
  `CatalogsPage` (3 вкладки), деактивация (`is_active=false`),
  hard-delete с confirm, обработка 409 при `ProtectedError`.
- ✅ **`2f-4a`** — топология: новая страница `/topology`
  (двухпанельный вид: дерево Room → Rack → Section → Tier
  слева, таблица ячеек справа). CRUD всех 5 уровней через
  `TopologyEntityDialog`. Автогенерация `Cell.full_address`
  из пути. Пункт «Топология» в sidebar. UI-защита: нельзя
  удалить узел с детьми (кнопка disabled).
- ✅ **`2f-4b`** — поддоны: `PalletDialog` (создание/правка/
  удаление поддона в ячейке), колонка «Поддон» в таблице
  ячеек, `usePalletByCell`.
- ✅ **`2f-4c-2`** — QR топологии в UI: иконка «QR» у Section
  в дереве (одиночный PDF); иконка «QR» в таблице ячеек
  (одиночный PDF); чекбоксы в таблице ячеек + кнопка
  «Печать QR (N)» (batch через `POST /storage/sections/qr-batch/`).
- ✅ **`2f-5a-2`** — `ReceiptItemEditDialog` (edit строки);
  колонка действий в таблице тар на `/receiving/:id`
  (Edit / Delete с обработкой 409); кнопка «Отменить партию»
  на `/receiving/:id` и на `/receiving/:id/check`.
- ✅ **`2f-5b-fix`** — после импорта Excel с вопросами
  (`PARSED` + `questions_count > 0`) → сразу переход
  на `/receiving/:id/check`, где карточки конфликтов.
  При `APPLIED` → на карточку рейса.
- ✅ **`2f-5c-2`** — новый статус `PENDING_FILLING` в UI:
  метка «Ожидает заполнения», фильтр «Статус» на `/containers`
  (5 значений), клик по таре в этом статусе → открывает
  форму заполнения пробами (независимо от того, есть ли
  номер). Если номер есть — поле предзаполнено и disabled.
- ✅ **`2f-5c-3`** — `ContainerEditDialog`: добавлены
  draft-поля (участок, ТИ, Н/З вх./тек.). `UpdateContainerPayload`
  расширен теми же полями.
- ✅ **`2f-7h`** — компактный реестр тары: иконки статусов,
  тултипы, убраны лишние колонки.
- ✅ **`2f-8a`** (историч., ранее `2f-8`) — дерево-таблица проб
  (`SamplesTreeTable`): группы Н/З × ТИ, тары, пробы.
  Единый вид `/samples`.
- ✅ **`2f-9a`** — пропуски и редактирование диапазонов
  (`RangeEditDialog`), карандашик.
- ✅ **`2f-9b`** — выбранные пробы (`SELECTED`), черная галочка
  на этикетке.
- ✅ **`2f-9c`** — управление пробами в таре
  (`FillContainerDialog` для существующих тар).
- ✅ **`2f-10`** — `PlaceContainerDialog` (в ячейку / на пол),
  массовое перемещение из `ContainersPage`.
- ✅ **`2f-11a`** — `CellContentsDialog` (поиск, группировка,
  чекбоксы, массовое перемещение).
- ✅ **`2f-11b`** — `ContainerPreviewDialog` (фильтр по пробам,
  массовая смена статуса).
- ✅ **`2f-11c`** — переходы из дерева проб и реестра тары
  в Топологию (`?cell_id=`).
- ✅ **`2f-12b`** — `CreateInCellDialog` (создание тары прямо
  в ячейке) + предпросмотр после заполнения, force-удаление тары.
- ✅ **`2f-8`** (закрыт 2026-10-27) — Наряд-заказы:
  - страница `/work-orders` (`WorkOrdersPage.tsx`);
  - `WorkOrderDialog`, `LinkWorkOrderDialog` (фильтр по номеру +
    «создать новый»), `WorkOrderContainersDialog` (список тар Н/З);
  - `workOrders.ts` — хуки React Query;
  - колонка «Проб» с числом, кнопка «Глаз»;
  - sidebar — пункт «Наряд-заказы»;
  - Топология: force-удаление Room / Rack / Section / Tier / Cell
    в дереве, автораскрытие, `?cell_id=` в `CellContentsDialog`;
  - `ContainersPage` — фикс `any` в force-удалении.
- ✅ **`2f-8-fix (tsconfig)`** — `web/tsconfig.json`: убран
  deprecated `baseUrl` (TS 6 → 7 миграция). `paths` не тронуты.
- ✅ **`2f-15`** — предпросмотр этикетки до создания тары.
  `LocalPreviewDialog` расширен: `container` стал опционален,
  добавлен `previewData` (mock-данные формы) + плейсхолдер
  «QR появится после сохранения». Кнопка «Предпросмотр» в
  `CreateContainersDialog` и `CreateInCellDialog`. В `FillContainerDialog`
  регресс: настоящий QR (реальный `container.id`).
- ✅ **`2f-14b`** — web: вкладка «История» в `ContainerPreviewDialog`.
  `ContainerHistoryTab` (новый) — таблица событий (дата / кто /
  действие / diff old → new по ключам). `useContainerHistory`
  в `containers.ts` + `index.ts`. 4 цвета иконок действий.
- ✅ **`2f-17a`** — рефакторинг `FillContainerDialog` →
  `FillContainerContent` (тело без `Dialog`-обёртки). 0
  функциональных изменений. `FillContainerDialog` — тонкая
  обёртка `<Dialog>`.
- ✅ **`2f-17c`** — единое окно `ContainerDetailDialog`
  (шапка + 3 вкладки: Пробы / Редактирование / История +
  кнопки `[Предпросмотр] [Разместить / Местоположение]`).
  `ContainerPreviewDialog` → переделан в модалку предпросмотра
  (2 вкладки: Этикетка / QR). `AddToPrintBatchDialog` — добавлен
  выбор «Новая партия / Существующая (DRAFT)». `ContainersPage` —
  клик по таре → `ContainerDetailDialog`, иконка «Этикетка»
  по `print_batch_status` (4 цвета: серая / жёлтая / синяя /
  зелёная) + инвалидация кэша `containers` / `container` /
  `container-history` после add-containers. `CellContentsDialog` —
  клик по таре → `ContainerDetailDialog`. См. 1.72.

### Что закрыто (docs)

- ✅ **`docs/2.x-web-v2-update`** — API.md (bulk-create +
  fill-samples, разделение), DECISIONS 1.58/1.59,
  CONTEXT / PLAN / PROGRESS.
- ✅ **`docs/2.x-web-v2-update-2`** — API.md (draft-поля,
  опциональный `container_number`), DATABASE.md (v6),
  DECISIONS 1.60, CONTEXT / PLAN / PROGRESS.
- ✅ **`docs/2.x-web-v2-update-3`** (2026-10-16) — CONTEXT / PLAN /
  DECISIONS (1.50 «закрыто», 1.61) / API (receiving-3, 3f,
  2f-1/2a/2b/2c) / PROGRESS / TESTING (ТД-26).
- ✅ **`docs/2.x-web-v2-update-4`** (2026-10-16) — CONTEXT / PLAN /
  DECISIONS (1.62 PENDING_FILLING, 1.63 PDF QR топологии,
  1.64 каскадное удаление ReceiptItem) / API (qr.pdf, qr-batch,
  delete receipt-items) / PROGRESS / TESTING.
- ✅ **`docs/2.x-web-v2-update-5`** (2026-10-27) — CONTEXT / PLAN /
  DECISIONS (1.65-1.68) / API (bulk-place, create-in-cell,
  force-удаление, cell_id) / PROGRESS / TESTING.
- ✅ **`docs/2f-8-closed`** (2026-10-27) — CONTEXT / PLAN /
  PROGRESS / TESTING / DECISIONS (1.69 — draft-поля после
  fill-samples; переименование `2f-8` (дерево-таблица) →
  `2f-8a`).
- ✅ **`docs/2f-14-17-closed`** (2026-10-27) — CONTEXT / PLAN /
  PROGRESS / TESTING / DECISIONS (1.70 аудит тары, 1.71
  print_batch_status, 1.72 ContainerDetailDialog).

### В работе

- 🟡 **`bundle-7`** — web-форма «Создать тару» (WIP, неверный UX,
  переделана в 7a-3 / 7a-4). Ветка
  `fix/2.x-web-v2-bundle-7` — **не закрыта, не мержить**.

### Что дальше

Серия `2f` — закрыта. Следующие серии (см. PLAN.md):

- ⬜ **`3.x-offline`** — мобильный офлайн (SQLite + SyncQueue).
- ⬜ **`2.x-lifecycle`** — пересмотр статусов Container / Sample.
- ⬜ **`2.x-rbac`** — роли и права.
- ⬜ **`2.x-lab-portal`** — портал лабораторий.

### Метрики

- Заходов закрыто (с 2026-10-12): 69.
  - backend: `bundle-1`, `bundle-2`, `bundle-5`, `bundle-6a`,
    `bundle-6b`, `bundle-7a-1`, `bundle-7a-2`, `bundle-7a-2b`,
    `receiving-1a`, `receiving-1a-2`, `receiving-1b`,
    `receiving-1c`, `receiving-3a`, `receiving-3b-1`,
    `receiving-3b-1-2a`, `receiving-3b-2`, `receiving-3c`,
    `receiving-3d-3-fix-2`, `3f-1`, `3f-1b`, `2f-1`, `2f-2b`,
    `2f-4c-1`, `2f-5a-1`, `2f-5c-1`, `2f-10`, `2f-11c`, `2f-12a`,
    `2f-8 (backend)`, `2f-8-fix`, `2f-8-fix-2`, `2f-14a`, `2f-17b`.
  - web: `bundle-7a-3`, `bundle-7a-4ab`, `bundle-7a-4c-1`,
    `bundle-7a-4c-2a`, `bundle-7a-4c-2b`, `bundle-7a-4c-2c`,
    `receiving-3d-1`, `receiving-3d-2`, `receiving-3d-3`,
    `3f-2`, `2f-1`, `2f-2a`, `2f-2b`, `2f-2c`,
    `2f-3a`, `2f-4a`, `2f-4b`, `2f-4c-2`, `2f-5a-2`,
    `2f-5b-fix`, `2f-5c-2`, `2f-5c-3`, `2f-7h`, `2f-8a`,
    `2f-9a`, `2f-9b`, `2f-9c`, `2f-10`, `2f-11a`, `2f-11b`,
    `2f-11c`, `2f-12b`, `2f-8`, `2f-8-fix (tsconfig)`, `2f-15`,
    `2f-14b`, `2f-17a`, `2f-17c`.
  - docs: 7 (`...-update` … `...-update-5`, `docs/2f-8-closed`,
    `docs/2f-14-17-closed`).
- «Не норм» на первом прогоне: 4.
  - 3f-1: `FileResponse` не имеет `.content` — читать
    `streaming_content`.
  - 2f-2b: `get_object()` учитывает фильтры `get_queryset`
    (утилизированные пробы → 404). Решено `_get_sample_any`.
  - 2f-3a / 2f-4b / 2f-4c-2 / 2f-5c-3: `Object.keys(...) as Type[]`
    в JSX ломает TS-парсер; вынесено в константы модуля.
  - 2f-4a: двойной костыль `setDialogKind` при edit комнаты —
    исправлено в финале.
- Откатов: 0.
- **Backend: 779 тестов** (было 767 в `docs/2f-8-closed`; +4
  `test_container_history`, +4 `test_container_print_status`,
  +4 fix `test_history_after_create`).
- **Web: 24 юнит-теста** (без изменений).
- **Mobile: 32 юнит-теста** (без изменений).

---

## Серия `feature/2.x-mobile`

**Дата:** 2026-10-10 — 2026-10-12
**Ветка:** `feature/2.x-mobile` (влита в `main`, архив).
**Контекст:** Flutter-приложение для Android-планшетов. Стек:
Flutter 3.47 + Dart 3.13 + Dio 5 + Provider 6 +
`flutter_secure_storage` + `mobile_scanner`.

Создана через `git merge feature/1.2-mobile-init` — переиспользованы
заходы серии 1.2 (init + API-клиент).

### Что закрыто

- ✅ **`bundle-1a` / `1b`** — Flutter init (из серии 1.2).
- ✅ **`bundle-2`** — API-клиент Dio + JWT (из серии 1.2).
- ✅ **`bundle-3a`** — TokenStorage (`flutter_secure_storage`),
  AuthService (`login`/`logout`/`refresh`/`fetchMe`), модель `User`.
- ✅ **`bundle-3b`** — UI: `AuthProvider` (ChangeNotifier), экран
  логина, главная-заглушка, `AuthGate` в `main.dart`.
  Плюс — фикс `ApiClient`: `Content-Type: application/json` для
  `post`/`patch`.
- ✅ **`bundle-4a`** — парсер QR (`parseQrPayload`), модель
  `Container`, `ContainerService`.
- ✅ **`bundle-4b-1`** — разрешение камеры в `AndroidManifest.xml`,
  публичные геттеры `apiClient` (AuthService) и `service`
  (AuthProvider), `Provider<ContainerService>` в `main.dart`.
- ✅ **`bundle-4b-2`** — экран сканера (`mobile_scanner`),
  `ContainerProvider`, `ContainerDetailScreen`, кнопка
  «Сканировать QR» на главной.
- ✅ **`bundle-5`** — список проб в карточке тары. Модель `Sample`,
  `SampleService` (`GET /samples/?container_id=`), pull-to-refresh.
- ✅ **`docs/2.x-mobile-update`** — CONTEXT, PLAN, PROGRESS:
  зафиксирована mobile-серия в работе.

### Что осталось (перенесено в будущие серии)

- ⬜ Приёмка в mobile — **отменена**, переносится в web (`2.x-web-v2`).
- ⬜ Поиск проб в mobile — по требованию (после web).
- ⬜ Инвентаризация в mobile — по требованию.
- ⬜ Нижнее меню / drawer — по требованию.

### Метрики

- Заходов закрыто: 8.
- «Не норм» на первом прогоне: 5 (NDK не установлен, IP без кавычек
  в `config.dart`, `_qrPrefix` в тексте ошибок, конфликт имён
  `Container` Flutter vs модель, `DJANGO_ALLOWED_HOSTS`).
- Откатов: 0.
- **Итог: 32 юнит-теста mobile.**

### Инфраструктура

- NDK **28.2.13676358** — установлен.
- Android SDK Platform 36 — установлен.
- `config.dart` — `_apiHostOverride = '<IP домашнего ПК>'` (в git).
- `.env` (backend) — `DJANGO_ALLOWED_HOSTS=*` (не в git).

---

## Серия `feature/2.x-web`

**Дата:** 2026-10-10
**Ветка:** `feature/2.x-web` (влита в `main`, архив).
**Контекст:** React-приложение. Стек: Vite 8 + React 19 + TypeScript +
MUI 9 + Zustand + TanStack Query + React Router 7 + axios + Vitest.

### Что закрыто

- ✅ **`bundle-1a`** — инициализация: `package.json`, `vite.config.ts`,
  `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.gitignore`.
- ✅ **`bundle-1b`** — ESLint (flat config), Prettier, MUI-тема
  (seed `#1E3A5F`), `main.tsx`, `App.tsx`, `vite-env.d.ts`.
- ✅ **`bundle-2`** — API-клиент: `axios`, JWT-интерцептор с
  авто-refresh, `tokenStorage` (localStorage), `auth.ts`, тесты.
- ✅ **`bundle-3`** — auth: Zustand-стор, login-форма MUI,
  `ProtectedRoute`, race condition при F5 закрыт `isBootstrapping`.
- ✅ **`bundle-4`** — layout: MUI sidebar (Drawer) + header,
  адаптив (мобильный temporary drawer), активный пункт — primary.
- ✅ **`bundle-5`** — главная: 4 карточки (Тара / Пробы / Ожидает
  размещения / Партии печати), TanStack Query provider.
- ✅ **`bundle-6`** — реестр тары: DataGrid, фильтры (статус, тип),
  пагинация, PDF-этикетка в строке.
- ✅ **`bundle-7`** — реестр проб: DataGrid, фильтры (номер, тип,
  участок, статус), «Показать утилизированные». Справочники
  (research-types, sites) подключены.
- ✅ **`bundle-8a`** — партии печати: список, детали, add/remove
  тар через диалог, mark-ready / mark-printed / cancel,
  скачивание PDF (этикетки / QR-сетка).
- ✅ **`bundle-8b`** — интеграция в реестр тары: чекбоксы, bulk-кнопка
  «В партию печати» (создать новую / добавить в черновик).
- ✅ **`bundle-9`** — справочники: типы исследования, участки,
  лаборатории (просмотр, 3 вкладки). Редактирование — Django Admin.
- ✅ **`docs/2.x-web-closed`** — CONTEXT, PLAN, PROGRESS.

### Метрики

- Заходов закрыто: 10 (bundle-1 разделён на 1a / 1b, bundle-8
  на 8a / 8b).
- «Не норм» на первом прогоне: 4 (типы GridRowSelectionModel в v9,
  Alert неиспользуемый, Stack alignItems, URL справочников
  без префикса `/samples/`).
- Откатов: 0.
- **Backend: 552 теста (без изменений).**
- **Web: 6 юнит-тестов (tokenStorage + authStore).**

---

## Серия `feature/2.1-label-generator`

**Дата:** 2026-10-09 — 2026-10-10
**Ветка:** `feature/2.1-label-generator` (влита в `main`, архив).
**Контекст:** Генератор этикеток тары. QR, PDF, партии печати,
раскладка на A4, API печати.

### Что закрыто

- ✅ **`bundle-1`** — QR-сервис: `generate_qr_png`, `generate_qr_svg`,
  `make_payload` (payload `WMSG:<TYPE>:<id>`).
- ✅ **`bundle-2`** — PDF-этикетка через fpdf2, шрифт `DejaVuSans.ttf`.
- ✅ **`bundle-3`** — API `GET /storage/containers/{id}/label.pdf/`.
- ✅ **`bundle-4a`** — модели `PrintBatch` + `PrintBatchItem`,
  миграция, тесты.
- ✅ **`bundle-4b`** — API партии печати: сериализаторы, ViewSet,
  actions (`add-containers`, `remove-container`, `mark-ready`,
  `cancel`), сервис генерации `batch_number`.
- ✅ **`bundle-4d-1`** — раскладка этикеток (сетка размеров,
  шапка 28 мм, авто-колонки, A4, продолжения).
- ✅ **`bundle-4d-3`** — QR-сетка `QR_ONLY`: 8 × 11 = 88 QR 25×25
  на A4, общие линии реза.
- ✅ **`bundle-4d-4`** — API печати партии (гибрид `pdf` +
  `mark-printed`).

### Метрики

- Заходов закрыто: 7.
- «Не норм» на первом прогоне: 4.
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
**Ветка:** `feature/1.2-mobile-init` (влита в `2.x-mobile` через
merge, 2026-10-10).
**Контекст:** Инициализация Flutter-проекта.

### Что закрыто

- ✅ **`bundle-1`** — Flutter init + структура проекта, `main.dart`,
  `pubspec.yaml`, README.
- ✅ **`bundle-1b`** — `widget_test.dart` под `WmsGeologyApp`.
- ✅ **`bundle-2`** — API-клиент: `config.dart`, `ApiClient`
  с JWT-интерцептором, `ApiException`.

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