# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-10-27

---

## Где мы

**Активная серия:** `feature/2.x-web-v2` — расширение web-клиента.

**Текущий заход:** серия `2f` (полный CRUD в web + полировка).
Закрыто: `2f-1` ... `2f-6c`, `2f-7a` ... `2f-7h`, `2f-8`, 
`2f-9a` ... `2f-9c`, `2f-10`, `2f-11a` ... `2f-11c`, `2f-12a` ... `2f-12b`.
Следующий — `2f-8` (Н/З — новая вкладка) или `2f-14` (История операций).

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
- **2f-4c-1**: автогенерация QR Section/Cell + PDF-рендер.
- **2f-4c-2**: QR-кнопки в UI топологии.
- **2f-5a-1**: backend — каскадное удаление `ReceiptItem`.
- **2f-5a-2**: web — edit/delete строк приёмки, отмена партии.
- **2f-5b-fix**: после импорта с вопросами → сразу на экран сверки.
- **2f-5c-1**: backend — статус `PENDING_FILLING` + data-migration.
- **2f-5c-2**: web — статус «Ожидает заполнения» в UI.
- **2f-5c-3**: web — draft-поля в `ContainerEditDialog`.
- **2f-7e**: название партии печати (поле `name`).
- **2f-8**: дерево-таблица проб (Группа → Тара → Проба).
- **2f-9a/9b/9c**: пропуски, выбранные пробы (`SELECTED`), карандашик, редактирование существующих.
- **2f-10**: размещение тары в ячейку (через поддон) и на пол.
- **2f-11a/b/c**: просмотр содержимого ячейки, фильтры, массовое перемещение, переходы по геометке.
- **2f-12a/b**: атомарное создание тары с пробами прямо в ячейке, предпросмотр, force-удаление.

**Что готово (backend, серия 2.x-web-v2):**
- `current_location` в `SampleSerializer` + фильтры (`?q=`, `?no_work_order=`).
- `GET /samples/grouped/` — группировка по Н/З + тип.
- `Sample.STATUS_PENDING_PLACEMENT`, `Sample.STATUS_SELECTED` + сервис `sync_sample_status_for_container`.
- `POST /storage/containers/bulk-create/` — создание заготовок.
- `POST /storage/containers/{id}/fill-samples/` — заполнение пробами.
- `POST /storage/containers/bulk-place/` — размещение в ячейку или на пол.
- `POST /storage/containers/create-in-cell/` — атомарное создание тары + проб + размещение.
- `DELETE /storage/containers/{id}/?force=true` — удаление тары вместе с пробами.
- Excel-импорт: `target_date`, `duplicate_action`, 409 на дубликат.
- **Приёмка:** `conflicts`, `resolve-conflicts`, `check`, `complete`, `act`.
- **Печать:** `pdf`, `mark-printed`, `companion.pdf`, `label_printed_at`.

**Что готово (web):**
- Логин, layout, главная, тара, пробы, печать, справочники, топология, приёмка.
- **Тара:** DataGrid, фильтры, edit, delete (с force), PDF, bulk-print, создание заготовок, заполнение (с пропусками/выбранными), предпросмотр, геометка в Топологию.
- **Пробы:** Дерево-таблица (Группа → Тара → Проба), `SampleEditDialog`, геометка в Топологию.
- **Топология:** Дерево + ячейки. `CellContentsDialog` (поиск, группировка, чекбоксы, массовое перемещение), `CreateInCellDialog` (создание тары в ячейке), переход по `?cell_id=`.

**Что нужно добавить (web, серия 2f — осталось):**
- **2f-8:** Н/З — новая вкладка (создание/правка).
- **2f-14:** История операций с тарой (аудит).
- **2f-15:** ТД-30 (предпросмотр этикетки до save).

**Что готово (mobile):**
- Логин, logout, refresh токенов.
- Сканер QR, карточка тары, список проб внутри.

**Backend:** 762+ теста.
**Web:** 24 юнит-теста.
**Mobile:** 32 юнит-теста.

**Ближайшая работа:**
- `2f-8` — Н/З (WorkOrder).
- Дальше — `3.x-offline` (мобильный офлайн).

---

## Стратегия разработки

> **Web — основной клиент. Mobile — по требованию.**

1. **Web-фичи — первый приоритет.**
2. **Mobile — по требованию.**
3. **Роли и права — после.**
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
| `storage` | Топология, Pallet, ContainerType, Container (+draft, nullable number, PENDING_FILLING), ContainerComment, QR-этикетка, QR топологии, bulk-create, fill-samples, bulk-place, create-in-cell |
| `samples` | ResearchType, Site, Laboratory, Well, Sample (+PENDING_PLACEMENT, SELECTED, dispose/restore), SampleWorkOrder, sync-сервис |
| `work_orders` | WorkOrder (self-ref + site) |
| `receiving` | Receipt, ReceiptItem (+container_type), ImportSession + Excel-парсер + apply_shipment_import, conflicts, resolve-conflicts, check, complete, act |
| `picking` | PickList, PickListItem, Shipment (+ direction, статусы), ShipmentItem |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, InventoryIssue |
| `users` | Role, UserProfile, AuditLog + JWT auth |
| `labels` | QR-сервис, PDF-этикетки, QR-сетка, PrintBatch (+name), act_service |

### Web (React, 24 юнит-теста)
| Раздел | Что внутри |
|---|---|
| Аутентификация | Zustand-стор, login, protected routes, JWT-интерцептор. |
| Layout | MUI sidebar + header. |
| Главная | 4 карточки. |
| Тара | DataGrid, фильтры, edit, delete (с force), PDF, bulk-print, создание, заполнение, предпросмотр, геометка. |
| Пробы | Дерево-таблица, `SampleEditDialog`, геометка. |
| Печать | Партии, детали, PDF, переименование. |
| Справочники | CRUD. |
| Приёмка | Список, детали, сверка, акт. |
| Топология | Дерево, ячейки, поддоны, `CellContentsDialog`, `CreateInCellDialog`. |

### Mobile (Flutter, 32 юнит-теста)
| Раздел | Что внутри |
|---|---|
| Аутентификация | `AuthProvider`, login, `TokenStorage` на `flutter_secure_storage`. |
| API | `ApiClient` (Dio), JWT-интерцептор. |
| Главная | Приветствие + кнопка «Сканировать». |
| Сканер | `mobile_scanner`, payload `WMSG:<TYPE>:<ID>`. |
| Карточка тары | Поля тары + список проб внутри. |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS` (66), `DATABASE` (v7), `API`, `SCENARIOS`, `UI` (v2), `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`.

---

## Известные грабли

### PostgreSQL
- **Домашний ПК:** Docker (`docker compose up -d`).
- **Рабочий ПК:** портативный `pg_ctl`.
- **После `git pull` с миграциями — всегда `migrate`.**
- `wms_user` имеет право `CREATEDB`.

### Django
- Все команды — только через `poetry run python manage.py ...`.
- `CheckConstraint(condition=...)`, не `check=`.
- CHECK с NULL: `NULL = NULL` не TRUE.
- `ProtectedError` при удалении Container с пробами, ContainerType с контейнерами, Sample из PickListItem и ShipmentItem. ViewSets отдают 409 (теперь есть `?force=true`).
- **Каскадное удаление `ReceiptItem`** (2f-5a-1).
- **`poetry lock`** после изменения `pyproject.toml`.
- **Циклические импорты** — использовать строковые ссылки.
- **Сортировка кириллицы в БД** — использовать `sort_order`.
- **`poetry env remove --all && poetry install`** после переезда проекта.
- **`apps/storage/services/` — пакет**, **`apps/receiving/parsers/` — пакет**, **`apps/receiving/services/` — пакет**.
- **Django signals для sync-логики — не используем** (1.58).
- **`transaction.set_rollback(True)` несовместим с `import_session.save()`**.
- **`get_object()` уважает фильтры `get_queryset`.** Для утилизированных проб — `Model.objects.filter(pk=pk).first()` (2f-2b).
- **`Section.save()` / `Cell.save()` — двойной `super().save()`**.

### API
- Аутентификация — JWT (`Authorization: Bearer <access>`).
- Pagination — `PageNumberPagination`, `PAGE_SIZE=50`.
- **Ключевой фильтр** `?work_order=` — учитывает linked_order.
- Custom actions: `link`, `complete`, `resolve`, `activate`, `pick`, `add-from-pick-list`, `execute`, `confirm`, `cancel`, `assemble`, `add-containers`, `remove-container`, `mark-ready`, `pdf`, `mark-printed`, `bulk-create`, `fill-samples`, `upload`, `import-shipment`, `conflicts`, `resolve-conflicts`, `check`, `act`, `dispose`, `restore`, `qr.pdf`, `qr-batch`, `bulk-place`, `create-in-cell`, `companion.pdf`.
- **URL-схема:** `/api/v1/storage/...`, `/api/v1/labels/...`, остальные приложения — **без префикса**.

### Домен
- Проба в системе = **навеска**. Не уникальна по номеру.
- Одна тара = один тип исследования.
- `Pallet` — «тихий» объект.
- `WorkOrders.linked_order_id` — self-ref INCOMING ↔ CODED.
- `Shipment.direction` — `INBOUND` / `OUTBOUND`.
- `ContainerType.laboratory` — NULL = общий.
- `PrintBatch.status` — soft через `CANCELLED`.
- `PrintBatchItem.container` — `PROTECT`.
- **Sample.STATUS_PENDING_PLACEMENT** синхронизируется с тарой.
- **Тара-заготовка**: `container_number = NULL`, draft-поля заполнены.
- **Импорт рейса** (`import-shipment`): `Receipt.site = NULL`, один `Receipt` на рейс.
- **`Container.container_number` — НЕ уникален глобально** (1.61).
- **`Container.STATUS_PENDING_FILLING`** — начальный статус (1.62).
- **ID объектов (BigAutoField)** не переиспользуются после удаления — это норма (1.68).
- **`Sample.STATUS_SELECTED`** защищен от перезаписи синхронизатором (1.66).

### Web
- **Vite proxy:** `/api/*` → `http://localhost:8000`.
- **MUI X v9:** `GridRowSelectionModel = { type, ids: Set<GridRowId> }`.
- **MUI X v9:** `DataGrid` с `paginationMode="server"` требует `rowCount` и `paginationModel`.
- **MUI 9:** `Grid size={{ xs, sm, md }}`.
- **MUI 9:** `Stack alignItems` и `justifyContent` — через `sx`, не проп.
- **MUI 9:** `Object.keys(...) as Type[]` внутри JSX ломает парсер (выносить в константу).
- **React Router v7:** API совместим с v6.
- **Zustand:** при F5 состояние сбрасывается — флаг `isBootstrapping`.
- **Vite build:** warning «chunks > 500 kB» — ожидаемо (ТД-21/ТД-35).
- **URL справочников:** `/research-types/`, `/sites/`, `/laboratories/` — **без префикса**.
- **MUI icons:** `DeleteOutline` не существует (использовать `Delete`). Для топологии: `AccountTree`.
- **`parseSampleInput`:** префикс ищется **точно** в `Laboratory.prefixes` + `Site.match_patterns`.
- **Диалог заполнения:** `fillContainerWithSamples` **обнуляет draft-поля**.
- **`FileResponse` в тестах:** читать `streaming_content`.
- **React Query Devtools не ставим** (ТД-36).
- **`TopologyPage`**: `CellPalletChip` делает N+1 запрос. Для 3–5 ячеек — норм.
- **Force-удаление тары:** при 409 ошибке `ContainersPage` предлагает удалить вместе с пробами (`?force=true`).

### Mobile
- **URL API:** `config.dart`, `_apiHostOverride` — в git.
- **Backend должен слушать `0.0.0.0:8000`**.
- **`DJANGO_ALLOWED_HOSTS`** должен включать IP.
- **Dio + `post`/`patch`:** обязательно `Content-Type: application/json`.
- **`flutter_secure_storage`** для JWT.
- **`mobile_scanner`:** `DetectionSpeed.noDuplicates`.
- **Конфликт имён `Container`:** `import 'package:flutter/material.dart' hide Container;`.
- **NDK 28.2.13676358**, **Android SDK Platform 36**.
- **Кириллица в пути** ломает Dart-анализатор.
- **`flutter pub get`** после каждого `pubspec.yaml`.

### Инструменты
- Git — только терминал.
- **Домашний ПК:** UCRT64 (MSYS2), SSH `github.com:22`.
- **Рабочий ПК:** Git Bash (MINGW64), SSH через порт 443.
- VS Code может дописывать `.vscode/settings.json` — откатывать.
- **UCRT64 (MSYS2)** ломает `manage.py shell -c "..."`.
- **`cat > file << 'EOF'`** — надёжный способ заменить файл в MSYS2.
- **`ipconfig`** в MSYS2 ломается на кодировке.
- **`git checkout -b` может упасть** на «already exists».

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