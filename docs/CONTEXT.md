# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-11-09

---

## Где мы

**Активная серия:** `feature/2.x-lab-portal` — портал лабораторий.
**Ветка:** `feature/2.x-lab-portal`.

**Текущий заход:** пачка 1 (backend) — ✅ закрыта.
Следующий: пачка 2 (web: фильтр `?my_lab=true`, вкладки «Все/Исх/Вх», кнопка «Принять», `current_holder`).

**Backend: 892 теста.**
**Web: 24 юнит-теста.**
**Mobile: 227 юнит-тестов.**

**Серия `3.x-offline`** (долгоживущий бранч `fix/2.x-mobile-bundle-c-2`) — на паузе. Все запланированные заходы закрыты, остался `c-8-catalog-create-offline` (отложен) и `c-5` (sneakernet, отложено).

**Серия `2.x-lifecycle`** — закрыто 3/5 пачек (`parent_container`/`parent_sample`, `is_disposable`, убран `CONSUMED`). Пачка 4 (перекладывание 1.115, шифрование 1.118) отложена — реализуется в рамках портала лабораторий.

**Серия `2.x-shipments`** — закрыта полностью (OUTBOUND рейсы, `ShipmentContainerItem`, автогенерация номера).

**Серия `2.x-smart-input`** — закрыта полностью (подсказки Н/З, ТИ, диапазон).

**Серия `2.x-web-v2`** — закрыта полностью (приёмка, CRUD, топология, QR, акт).

**Серия `2f`** — закрыта полностью.

### Что готово (backend) для портала
- `UserProfile.laboratory` (FK → `samples.Laboratory`, `SET_NULL`, null).
- Роль `lab_worker` («Сотрудник лаборатории»).
- `POST /shipments/{id}/mark-received/` — приёмка рейса (DRAFT/ASSEMBLED/SENT → RECEIVED, `received_at`).
- `can_mark_received` в `ShipmentSerializer` (SerializerMethodField).
- `current_holder` в `ContainerSerializer` и `SampleSerializer`.

### Что дальше (пачка 2 — web)
- Фильтр `?my_lab=true` в `ShipmentsPage`.
- Вкладки «Все / Исходящие / Входящие».
- Кнопка «Принять» (POST `mark-received`).
- Колонка «Где сейчас» (`current_holder`).
- Общий интерфейс с фильтром по роли (решение 6: **не** отдельная `/lab-portal`).

### Известные грабли
- **`c-8b-status`** — смена статуса тары через шапку (5 значений, офлайн через `sync_queue`) — ✅.
- **Web:** `ContainersPage.tsx` — `(row as any).comment` — ТД-67.
- **Mobile:** `_lastPullSince` в памяти (ТД-62), `fetchList` не ловит `unknown` (ТД-68).
- **Admin:** `users/admin.py` не зарегистрирован (ТД-73) — `UserProfile`/`Role`/`AuditLog`/`AccessToken` не видны в Django Admin. Не влияет на API.
- **`mark_received` docstring:** побит (ТД-69), функционально не влияет.
- **`mark_received` проверяет роль:** `admin`/`manager`, `is_superuser` не проверяется (ТД-72, решено оставить).

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
- PostgreSQL: Docker (домашний) / портативный (рабочий).
- JWT, OpenAPI, 10 приложений.
- Node 20+, Vite 8, React 19, MUI 9.
- Flutter 3.47 + Dart 3.13 + mobile_scanner 7.4.2.

### Backend (892 теста)
| Приложение | Что внутри |
|---|---|
| `storage` | Топология, Pallet, ContainerType, Container (+draft, nullable number, PENDING_FILLING), bulk-create, fill-samples, bulk-place, create-in-cell, history, print_batch_status, `current_holder` |
| `samples` | ResearchType, Site, Laboratory, Well, Sample (+PENDING_PLACEMENT, SELECTED, dispose/restore), SampleWorkOrder, sync-сервис, `current_holder` |
| `work_orders` | WorkOrder (self-ref + site, admin, samples_count) |
| `receiving` | Receipt, ReceiptItem (+container_type), ImportSession, conflicts, resolve-conflicts, check, complete, act |
| `picking` | PickList, PickListItem, Shipment (+direction, статусы), ShipmentItem, ShipmentContainerItem, `mark-received` |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, InventoryIssue, ActualizationTask, offline_import |
| `users` | Role, UserProfile (+laboratory), AuditLog, `log_audit`, AccessToken (+qr_svg), JWT, offline-login, code-login, `seed_roles` (+lab_worker) |
| `labels` | QR-сервис, PDF-этикетки, QR-сетка, PrintBatch (+name), PrintBatchItem, act_service |

### Web (React, 24 юнит-теста)
| Раздел | Что внутри |
|---|---|
| Аутентификация | Zustand-стор, login, protected routes, JWT-интерцептор. |
| Layout | MUI sidebar + header. |
| Главная | 4 карточки. |
| Тара | DataGrid, фильтры, edit, delete (с force), PDF, bulk-print, создание, заполнение, предпросмотр, геометка, иконки печати. Колонка «Комментарий» — `comment` + fallback на `comment_template_text`. |
| Пробы | Дерево-таблица, `SampleEditDialog`, геометка. |
| Наряд-заказы | `WorkOrdersPage`, диалоги. |
| Печать | Партии, детали, PDF, переименование. |
| Справочники | CRUD. |
| Приёмка | Список, детали, сверка, акт. |
| Топология | Дерево, ячейки, поддоны, `CellContentsDialog`, `CreateInCellDialog`, force-удаление. |
| Карточка тары | `ContainerDetailDialog` (3 вкладки + Предпросмотр / Разместить / Местоположение + Комментарий и Шаблон в шапке). |
| Коды доступа | `AccessTokensPage` — создание, QR, отзыв. |
| Отправка | `ShipmentsPage`, `ShipmentDetailPage`, `CreateShipmentDialog`, `AddContainersToShipmentDialog`. |

### Mobile (Flutter, 227 юнит-тестов)
| Раздел | Что внутри |
|---|---|
| Аутентификация | `AuthProvider`, login (пароль + QR), `TokenStorage`. |
| API | `ApiClient` (Dio), JWT-интерцептор. |
| Сеть | `NetworkProbe` + `AppConfig.resolve`. `NetworkStatusProvider` (heartbeat 10 с, тап → `pingNow`). `NetworkBadge`. |
| Главная | Приветствие + «Сканировать», «Синхронизация (N)», история тар. |
| Drawer | Главная, Тара, Пробы, Наряд-заказы, Приёмка, Печать, Топология, Справочники, Выход. |
| Реестр тары | 4 фильтра, пагинация, офлайн-кэш, действия по статусу, создание тары. |
| Карточка тары | 3 вкладки, адаптив, `ContainerEditForm` (safe area + sticky, не блокирует при пустых справочниках), `FillContainerContent`, `SampleEditDialog`, история. |
| Шапка тары (офлайн) | `ContainerService.update` → `sync_queue` PATCH + `updateFieldsLocal` + `pending_sync`. |
| Пробы | Поиск, чекбоксы, bulk-статус, чипы, `SampleEditDialog`. Офлайн: создание, редактирование, dispose/restore/delete через `sync_queue`. |
| История | Аудит тары (online + офлайн). |
| PDF | Online + offline на Dart. |
| Размещение | `PlaceContainerDialog` (online + offline, локальное обновление `ACTIVE` + `full_address`). |
| Офлайн-справочники | `CatalogDao`, `CatalogService` fallback, создание через `sync_queue`. `NamedCatalog.fullAddress`. |
| Офлайн-создание тары | `bulkCreate` при `isNetworkError` → negative ID + `sync_queue` с `localRef`, маппинг после Push. |
| Офлайн-`fill-samples` / `bulk-place` | `fillSamples` при `containerId < 0` → очередь, `bulkPlace` при negatives → очередь атомарно. |
| Синхронизация | Pull + Push + автосинхронизация. Incremental Pull `?updated_since=`. Natural sort проб. |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS`, `DATABASE`, `API`, `SCENARIOS`, `UI`, `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`.

---

## Известные грабли

### PostgreSQL
- **Домашний ПК:** Docker.
- **Рабочий ПК:** портативный `pg_ctl`.
- **После `git pull` с миграциями — всегда `migrate`.**

### Django
- Все команды — только через `poetry run`.
- `log_audit(old_value=..., new_value=...)` — оба обязательны.
- `ProtectedError` → 409 (есть `?force=true`).
- **stale-тесты** копятся при прогоне только `apps/<app>/`. Перед закрытием — `pytest -q` целиком.
- **Django signals не используем** (1.58, 1.70).
- **Django Admin:** `apps/users/admin.py` не настроен (ТД-73). Модели `users` не видны в админке.

### API
- JWT, `PageNumberPagination`, `PAGE_SIZE=50`.
- `?updated_since=<ISO 8601>` — с таймзоной; naive / невалидный → 400.
- `GET /health/` — вне `/api/v1/`, без авторизации.
- Денормализация `ContainerSerializer` — `*_name` поля.
- **OpenAPI:** `?format=openapi-json` не работает, используй `/api/schema/` (YAML) или `?format=openapi`.

### Домен
- Проба = навеска. Не уникальна по номеру.
- `container_number` — НЕ уникален глобально.
- `PENDING_FILLING` — начальный статус.
- `SELECTED` — защищён от перезаписи.
- `fill-samples` обновляет draft-поля.

### Web
- Vite proxy `/api/*` → `localhost:8000`.
- MUI X v9: `GridRowSelectionModel = { type, ids: Set<GridRowId> }`.
- `ContainerDetailDialog`: `canPlace = PENDING_FILLING || PENDING_PLACEMENT`; `hasCell = cell_id !== null`.
- **`ContainersPage.tsx`:** колонка «Комментарий» с `valueGetter: (row as any).comment || row.comment_template_text` — ТД-67.

### Mobile
- **`AppConfig.resolve()`**: `--dart-define=API_HOST` → probe → fallback `192.168.0.77`.
- **`export FLUTTER_STORAGE_BASE_URL`** — в каждом окне.
- **`adb reverse` сбрасывается** при reconnect USB.
- **`mobile_scanner 7.4.2`**: `BarcodeCapture.rotation` не существует; landscape swap в `mapImageToWidgetFrame`.
- **`hide Container`** — в файлах с моделью `Container`.
- **`context.read` после `await`** → сервис брать до первого `await`.
- **Перед `git add` — `git status --short | grep "mobile/lib"`** (1.90).
- **Перед выдачей кода — то же, должно быть пусто** (1.91).
- **`mobile/android/*` и `tools/`** — машинные, не коммитить.
- **SQLite v8:** таблицы `containers` (+`pending_sync`), `samples`, `sync_queue` (+`local_ref`), `catalog`, `container_history`. `onUpgrade v7→v8` — только `ALTER TABLE`.
- **`SampleDao.saveAll`** не перезаписывает пробы с `_pending_sync = 1`.
- **`fetchByContainerId`** возвращает кэш при `hasPendingForContainer`.
- **Reconcile при Pull** сбрасывает `_pending_sync`, если записи в `sync_queue` нет.
- **`sync_queue` regex**: `^/samples/(\d+)/(?:dispose/|restore/)?$` — PATCH/DELETE + dispose/restore.
- **`_lastPullSince` в памяти** — Pull раз в сессию полный (ТД-62).
- **Natural sort** — `naturalCompare` в `SampleDao.getByContainerId`, `SampleService.fetchByContainerId`, `LabelData.fromContainer`.
- **`NetworkBadge`** — `IconButton`, тап → `pingNow`, спиннер.
- **`bulk-create` маппинг ID:** по индексу `created_containers[i].id`, проверка длины + `debugPrint`.
- **Локальный JSON тары — в серверном формате** (`container_type`, `draft_site`, `draft_research_type`), не `*_id`.
- **`fillSamples` / `bulkPlace` на negative-ID:** `localRef = containerId` / `jsonEncode(negatives)`. `remapEndpoint` маппит URL.
- **`SyncPusher.pushAll` после `bulk-create`** перечитывает очередь + `processedIds`.
- **`bulkPlace` offline:** `ContainerDao.updateLocationLocal` → UI сразу видит место.
- **`NamedCatalog.fullAddress`** — из `json['full_address']`, `label` не меняется.
- **`ContainerService.update` офлайн:** `sync_queue` PATCH + `updateFieldsLocal` + `pending_sync`. `UpdateOutcome {online, queued}`. **Ловит все не-4xx (сеть/таймаут/5xx/unknown)** — `catch (_)`.
- **`ContainerEditForm._catalogsError`** — при 5xx/DB-ошибках форма **не блокирует** сохранение: текстовые поля сохраняются, dropdown'ы disabled.
- **`_openEditSheet`** — `useSafeArea: true` + высота = экран − клавиатура − safe area.

### Рабочий ПК (прокси)
- **После `git reset --hard`**: `setup.ps1` → `export FLUTTER_STORAGE_BASE_URL` → `flutter run --android-skip-build-dependency-validation`.
- **`checkRevocation=false`**, **`aapt2FromMavenOverride`**, **`kotlin.incremental=false`**, **`kotlin.compiler.execution.strategy=in-process`**, **`org.gradle.parallel=false`**, **`org.gradle.workers.max=2`**.
- **`android.aapt2FromMavenOverride`** — в `mobile/android/gradle.properties` + `~/.gradle/gradle.properties`.
- **NDK `source.properties`** без BOM.
- **Не делать `git add .`**.

### Инструменты
- Git — только терминал.
- **`cd` — первой строкой блока.**
- **`cat >> file`** без `\n` — склеивает строки.
- **`pkill`** — нет в Git Bash, только `taskkill //F //IM <name>`.

---

## Не трогать

- `RULES.md`, `TEMPLATES.md`.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` (только `.env.example`).
- Ветка `fix/2.x-mobile-bundle-c-2` (WIP).
- `work-pc-setup/`, `wms-bundle/`, `D:\Dev\maven-local`, `D:\Dev\android-sdk\ndk\28.2.13676358`.

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`

Остальное — по запросу.