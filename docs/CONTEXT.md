# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-11-09

- **`c-8b-status`** — смена статуса тары через шапку (5 значений, офлайн через `sync_queue`) — ✅.
---

## Где мы

**Активная серия:** `feature/3.x-offline` — офлайн-режим мобильного приложения.
**Долгоживущий бранч:** `fix/2.x-mobile-bundle-c-2`.

**Текущий заход:** серия `c` (мобильный офлайн).

**Backend (`c-1`..`c-6b`):**
- `c-1` SQLite, `c-2` SyncService, `c-3` SyncQueue, `c-4` SyncScreen, `c-4.5` Deferred Offline Login, `c-4.6` USB — ✅.
- `c-6a-pre` / `c-6a` / `c-6b` — ✅.

**Mobile (сеть, сканер):**
- `c-6c` auto-detect, `c-6d-fix` + `c-6d-fix-3` scanWindow, `c-6g` NetworkStatusProvider, `c-6h` блок синхронизации, `c-6g-login` иконка на Login — ✅.
- `c-6g-tap-ping` — тап на иконке → `pingNow()` — ✅.

**Mobile (карточка тары, `c-7a`..`c-7h`, PDF, размещение, офлайн-справочники):**
- `c-7a`..`c-7h` — ✅.
- `c-7d`, `c-7f-1`, `c-7f-2` — PDF (online + offline) — ✅.
- `c-7c` — Разместить / Местоположение — ✅.
- `c-7-offline-catalog`, `c-7e-1`, `c-7e-2`, `c-7e-3` — кэш справочников + истории — ✅.

**Mobile (Drawer, реестр, офлайн-редактирование, `c-9`):**
- `c-9-drawer`, `c-9-container-list`, `c-9-container-list-order`, `c-9-overflow-fix`, `c-9-overflow-fix-2`, `c-9-container-create`, `c-9-container-list-actions` — ✅.
- `c-9-fill-offline-2a`, `2a-fix`, `2b`, `2c-1`, `2c-2`, `2c-3`, `2c-3-fix-1/2/3a/3b`, `2c-4` — офлайн-редактирование проб — ✅.
- `c-9-auto-sync` — двусторонняя автосинхронизация при возврате сети — ✅.
- `c-9-natural-sort` — сортировка проб по `sample_number` — ✅.
- `c-6b-updated-since-pull` — `?updated_since=` в Pull, `PullStats` = изменённые — ✅.

**Mobile (офлайн-создание тары и справочников, `c-2d-2a`, `c-8-catalog-create`):**
- `c-8-catalog-create-offline` — офлайн-создание справочников и защита от перезаписи при Pull — ✅.
- `c-2d-2a` — SQLite v8 (`local_ref`), офлайн-создание тары, маппинг ID после `bulk-create` — ✅.
- `c-2d-2a-fix-3` — `Container.fromJson` fallback на `*_id`, серверный формат JSON, история для negative-ID не зовёт сервер — ✅.

**Mobile (офлайн-операции на офлайн-тарах, `c-2d-2c`):**
- `c-2d-2c` — офлайн-`fill-samples` / `bulk-place` на офлайн-тарах, `remapEndpoint`, `processedIds` — ✅.
- `c-2d-2c-fix-1` — локальное размещение в UI (`updateLocationLocal`, `ACTIVE`, адрес) — ✅.
- `c-2d-2c-fix-2` — `NamedCatalog.fullAddress`, полный путь `В4/1/1/B/2` — ✅.

**Mobile (офлайн-редактирование шапки тары, `c-8b`):**
- `c-8b` — `ContainerService.update` при `isNetworkError` → `sync_queue` PATCH + `updateFieldsLocal` + `pending_sync`; `SyncPusher` PATCH `/storage/containers/{id}/` → `clearPendingSync` — ✅.
- `c-8b-fix-1` — UI: `useSafeArea`, sticky «Сохранить» вне `ListView` — ✅.
- `c-8b-fix-2` — `update` ловит все не-4xx (сеть/таймаут/5xx/unknown) → `sync_queue`; payload с `*_name` (`container_type_name` / `draft_site_name` / `draft_research_type_name`); лейблы без «черновик» — ✅.
- `c-8b-fix-3` — `ContainerEditForm` не блокирует сохранение при `_catalogsError` (5xx/DB): dropdown'ы типа/участка/ТИ disabled + баннер «Повторить», в payload не идут; текстовые поля сохраняются всегда; `safeValue` для dropdown'ов — защита от assertion — ✅.
- `c-8b-fix-4` — окно редактирования шапки выше: `(screen − insets) × 0.95` вместо `0.9 × (screen − safeBottom)`, `Padding+SizedBox` убран (overflow при клавиатуре) — ✅.
**Web (комментарий тары, `c-2f-comment-web`):**
- `c-2f-comment-web` — `ContainerDetailDialog.tsx`: в шапке `Комментарий` + `Шаблон`; `ContainersPage.tsx`: колонка «Комментарий» — `comment` с fallback на `comment_template_text` — ✅.

- **`c-9-overflow-fix-4`** — landscape-фикс клавиатуры над окном шапки (UI) — ✅.

- **`2.x-lifecycle`** — серия в работе (статусы Container/Sample). Решения 1.109, 1.110, 1.111 приняты. Реализация — следующие пачки.

- **`2.x-shipments`** — серия закрыта (OUTBOUND рейсы). `c-2.x-shipments-1/1a/1b/2/2-fix/2-fix-2` — ✅. Смержено в `main`. Дальше: приёмка в лаборатории + возврат (отдельная серия).

**Следующие заходы:**
- `c-8-catalog-create-offline` — офлайн-создание справочников через `sync_queue`. ⬜ 

**Отложено:** `c-5` (sneakernet через флешку).

**Снятые с плана после аудита 2026-11-05:** `c-8a` (эндпоинты есть), `c-8c` (закрыто в `c-9-fill-offline-2c-3`), `c-8d` (в `c-7c`), `c-8e` (работает через `NetworkStatusProvider`).

**Предыдущая серия:** `2f` — закрыта полностью.

**Что готово (mobile):**
- Логин, logout, refresh токенов.
- Сканер QR, карточка тары, список проб.
- SQLite, Pull, Push, `SyncScreen`.
- Deferred Offline Login, USB.
- Auto-detect, `NetworkStatusProvider` + тап-пинг.
- ScanWindow.
- Карточка тары: 3 вкладки, адаптив, `ContainerEditForm`, `FillContainerContent`, вкладка «Пробы», история сканов.
- PDF online + offline.
- Размещение online/offline + локальное обновление места.
- Офлайн-справочники + история.
- Drawer + реестр тары + создание + действия по статусу.
- Офлайн-редактирование проб.
- Автосинхронизация Push + Pull.
- Natural sort проб.
- Инкрементальный Pull `?updated_since=`.
- Офлайн-создание тары (negative ID + `local_ref` + маппинг ID после `bulk-create`).
- Офлайн-создание справочников.
- **Полный офлайн-сценарий «создал → заполнил → разместил»**.
- **Офлайн-редактирование шапки тары** (с именами типа/участка/ТИ, без «черновик» в лейблах, не блокируется при пустых справочниках).

**Сборка на рабочем ПК (прокси):**
- `work-pc-setup/setup.ps1` — **обязателен после `git reset --hard`**.
- `export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn` — в каждом окне.
- `flutter run --android-skip-build-dependency-validation`.
- `adb reverse tcp:8000 tcp:8000` — вручную.
- `android.aapt2FromMavenOverride=D:/Dev/android-sdk/build-tools/36.0.0/aapt2.exe` в `mobile/android/gradle.properties` + `~/.gradle/gradle.properties` (машинное, не коммитить).

**Backend:** 842 теста.
**Web:** 24 юнит-теста.
**Mobile:** 227 юнит-тестов.

- **`c-2.x-smart-input-bundle-1`** — контекстные подсказки (Н/З, ТИ, диапазон) — ✅.
- **`c-2.x-smart-input-bundle-2`** — база диапазона + auto-dash + скрытие использованных — ✅.


- **`c-2.x-lifecycle-1`** — is_disposable + DISPOSED, логика утилизации, UI (типы тары, show_disposed, Recycling) — ✅.

- **`c-2.x-lifecycle-2a/2b/2c`** — убран `CONSUMED`, миграция `0007`, web/mobile — ✅.

- **`c-2.x-lifecycle-3a/3b`** — `parent_*` (FK → self) + `is_disposable` в сериализаторе — ✅. Смержено в `main`.

**Ближайшая работа:**

- **`c-8b-status`** — смена статуса тары через шапку (5 значений, офлайн через `sync_queue`) — ✅.
---

## Стратегия разработки

> **Web — основной клиент. Mobile — по требованию.**

1. **Web-фичи — первый приоритет.**
2. **Mobile — по требованию.**
3. **Роли и права — после.**
4. **`Receipt`** — только для Excel и акта приёмки.

- **`c-8b-status`** — смена статуса тары через шапку (5 значений, офлайн через `sync_queue`) — ✅.
---

## Что готово

### Инфраструктура
- Python 3.14 + Poetry + Django 5.2 + DRF.
- PostgreSQL: Docker (домашний ПК) / портативный (рабочий).
- JWT, OpenAPI, 10 приложений.
- Node 20+, Vite 8, React 19, MUI 9.
- Flutter 3.47 + Dart 3.13 + mobile_scanner 7.4.2.

### Backend (842 теста)
| Приложение | Что внутри |
|---|---|
| `storage` | Топология, Pallet, ContainerType, Container (+draft, nullable number, PENDING_FILLING), bulk-create, fill-samples, bulk-place, create-in-cell, history, print_batch_status, `filters.apply_updated_since` |
| `samples` | ResearchType, Site, Laboratory, Well, Sample (+PENDING_PLACEMENT, SELECTED, dispose/restore), SampleWorkOrder, sync-сервис, `?updated_since=` |
| `work_orders` | WorkOrder (self-ref + site, admin, samples_count) |
| `receiving` | Receipt, ReceiptItem (+container_type), ImportSession, conflicts, resolve-conflicts, check, complete, act |
| `picking` | PickList, PickListItem, Shipment (+direction, статусы), ShipmentItem |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, InventoryIssue, ActualizationTask, offline_import |
| `users` | Role, UserProfile, AuditLog, `log_audit` (+old_value), AccessToken (+qr_svg), JWT, offline-login, code-login |
| `labels` | QR-сервис, PDF-этикетки, QR-сетка, PrintBatch (+name), PrintBatchItem, act_service |

### Web (React, 24 юнит-теста)
| Раздел | Что внутри |
|---|---|
| Аутентификация | Zustand-стор, login, protected routes, JWT-интерцептор. |
| Layout | MUI sidebar + header. |
| Главная | 4 карточки. |
| Тара | DataGrid, фильтры, edit, delete (с force), PDF, bulk-print, создание, заполнение, предпросмотр, геометка, иконки печати. Колонка «Комментарий» — `comment` + fallback на `comment_template_text` (`c-2f-comment-web`). |
| Пробы | Дерево-таблица, `SampleEditDialog`, геометка. |
| Наряд-заказы | `WorkOrdersPage`, диалоги. |
| Печать | Партии, детали, PDF, переименование. |
| Справочники | CRUD. |
| Приёмка | Список, детали, сверка, акт. |
| Топология | Дерево, ячейки, поддоны, `CellContentsDialog`, `CreateInCellDialog`, force-удаление. |
| Карточка тары | `ContainerDetailDialog` (3 вкладки + Предпросмотр / Разместить / Местоположение + Комментарий и Шаблон в шапке — `c-2f-comment-web`). |
| Коды доступа | `AccessTokensPage` — создание, QR, отзыв. |

### Mobile (Flutter, 218 юнит-тестов)
| Раздел | Что внутри |
|---|---|
| Аутентификация | `AuthProvider`, login (пароль + QR), `TokenStorage`. |
| API | `ApiClient` (Dio), JWT-интерцептор. |
| Сеть | `NetworkProbe` + `AppConfig.resolve`. `NetworkStatusProvider` (heartbeat 10 с, тап → `pingNow`). `NetworkBadge`. |
| Главная | Приветствие + «Сканировать», «Синхронизация (N)», история тар. |
| Drawer | Главная, Тара, Пробы, Наряд-заказы, Приёмка, Печать, Топология, Справочники, Выход. |
| Реестр тары | 4 фильтра, пагинация, офлайн-кэш, действия по статусу (Заполнить / Разместить / Местоположение), создание тары (online + offline). |
| Карточка тары | 3 вкладки, адаптив, `ContainerEditForm` (safe area + sticky «Сохранить», не блокирует при пустых справочниках), `FillContainerContent`, `SampleEditDialog` (online + offline), история. Лейблы без «(черновик)» — `c-8b-fix-2`, `c-8b-fix-3`. |
| Шапка тары (офлайн) | `ContainerService.update` → `sync_queue` PATCH + `ContainerDao.updateFieldsLocal` + `pending_sync`; `update` ловит все не-4xx (сеть/таймаут/5xx/unknown) → очередь; payload с `*_name` — `c-8b` + `c-8b-fix-2`. |
| Пробы | Поиск, чекбоксы, bulk-статус, чипы, `SampleEditDialog`. Офлайн: создание, редактирование, dispose/restore/delete — все через `sync_queue`. |
| История | Аудит тары (online + офлайн через `ContainerHistoryDao`). |
| PDF | Online + offline на Dart. |
| Размещение | `PlaceContainerDialog` (online + offline, при офлайне локальный кэш сразу обновляется — `ACTIVE`, полный адрес) — `c-7c`, `c-2d-2c-fix-1/2`. |
| Офлайн-справочники | `CatalogDao`, `CatalogService` fallback, создание через `sync_queue` (`c-8-catalog-create`, только онлайн-`create`). `NamedCatalog.fullAddress`. |
| Офлайн-создание тары | `bulkCreate` при `isNetworkError` → negative ID + `sync_queue` с `localRef`, `BulkCreateResult {count, queued}`. После Push `SyncPusher` перемапит negative → server. |
| Офлайн-`fill-samples` / `bulk-place` на офлайн-тарах | `fillSamples` при `containerId < 0` → очередь, `bulkPlace` при negatives → очередь атомарно, `SyncPusher` перезагружает очередь + `processedIds` — `c-2d-2c`. |
| Офлайн-редактирование шапки тары | `UpdateOutcome {online / queued}`, `ContainerDao.updateFieldsLocal`, `SyncPusher` PATCH `/storage/containers/{id}/` → `clearPendingSync`, catch все не-4xx, `*_name` в payload — `c-8b`, `c-8b-fix-2`. `ContainerEditForm` не блокирует при пустых справочниках — `c-8b-fix-3`. |
| Синхронизация | Pull + Push + автосинхронизация. Incremental Pull `?updated_since=`. Natural sort проб. |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS` (104), `DATABASE` (v7), `API`, `SCENARIOS`, `UI` (v2), `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`.

- **`c-8b-status`** — смена статуса тары через шапку (5 значений, офлайн через `sync_queue`) — ✅.
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

### API
- JWT, `PageNumberPagination`, `PAGE_SIZE=50`.
- `?updated_since=<ISO 8601>` — с таймзоной; naive / невалидный → 400.
- `GET /health/` — вне `/api/v1/`, без авторизации.
- Денормализация `ContainerSerializer` — `*_name` поля.

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
- **`ContainersPage.tsx`:** колонка «Комментарий» с `valueGetter: (row as any).comment || row.comment_template_text` — временный обход типа (`ТД-67`).

### Mobile
- **`AppConfig.resolve()`**: `--dart-define=API_HOST` → probe → fallback `192.168.0.77`.
- **`export FLUTTER_STORAGE_BASE_URL`** — в каждом окне.
- **`adb reverse` сбрасывается** при reconnect USB.
- **`mobile_scanner 7.4.2`**: `BarcodeCapture.rotation` не существует; landscape swap в `mapImageToWidgetFrame`.
- **`hide Container`** — в файлах с моделью `Container`.
- **`context.read` после `await`** → сервис брать до первого `await`.
- **Перед `git add` — `git status --short | grep "mobile/lib"`** (1.90).
- **Перед выдачей кода — то же, должно быть пусто** (1.91).
- **`mobile/android/*` и `tools/`** — машинные, не коммитить. `tools/` в `.gitignore`.
- **SQLite v8:** таблицы `containers` (+`pending_sync`), `samples`, `sync_queue` (+`local_ref`), `catalog`, `container_history`. `onUpgrade v7→v8` — только `ALTER TABLE`.
- **`SampleDao.saveAll`** не перезаписывает пробы с `_pending_sync = 1`.
- **`fetchByContainerId`** возвращает кэш при `hasPendingForContainer`.
- **Reconcile при Pull** сбрасывает `_pending_sync`, если записи в `sync_queue` нет.
- **`sync_queue` regex**: `^/samples/(\d+)/(?:dispose/|restore/)?$` — PATCH/DELETE + dispose/restore.
- **`_lastPullSince` в памяти** — Pull раз в сессию полный (ТД-62).
- **Natural sort** — `naturalCompare` в `SampleDao.getByContainerId`, `SampleService.fetchByContainerId`, `LabelData.fromContainer`.
- **`NetworkBadge`** — `IconButton`, тап → `pingNow`, спиннер.
- **`scaffoldMessengerKey`** — глобальный.
- **`bulk-create` маппинг ID:** по индексу `created_containers[i].id`, проверка длины + `debugPrint` (1.101).
- **Локальный JSON тары — в серверном формате** (`container_type`, `draft_site`, `draft_research_type`), не `*_id`. `Container.fromJson` fallback на `*_id` (1.101).
- **История для negative-ID** — не зовём сервер (`_loadHistory` guard) (1.101).
- **`fillSamples` / `bulkPlace` на negative-ID:** `localRef = containerId` / `jsonEncode(negatives)`. `remapEndpoint` маппит URL `/containers/-N/...` → `/containers/M/...` (1.102).
- **`SyncPusher.pushAll` после `bulk-create`** перечитывает очередь + `processedIds` — защита от зацикливания (1.102).
- **`bulkPlace` offline:** `ContainerDao.updateLocationLocal` → UI сразу видит место (1.102).
- **`NamedCatalog.fullAddress`** — из `json['full_address']`, `label` не меняется. `PlaceContainerDialog` → `fullAddress ?? label` (1.102).
- **`ContainerService.update` офлайн:** `sync_queue` PATCH + `updateFieldsLocal` + `pending_sync`. `UpdateOutcome {online, queued}`. **Ловит все не-4xx (сеть/таймаут/5xx/unknown)** — `catch (_)` → очередь (1.103, 1.104).
- **`SyncPusher` PATCH `/storage/containers/{id}/`** → `clearPendingSync(id)` (1.103).
- **`ContainerEditForm`** — `Form(Column(Expanded(ListView), sticky bottomBar))`, `SafeArea(top: false)` у кнопки; payload содержит `*_name` для `container_type` / `draft_site` / `draft_research_type` (1.103, 1.104).
- **`ContainerEditForm._catalogsError`** — при 5xx/DB-ошибках загрузки справочников форма **не блокирует** сохранение: текстовые поля сохраняются, dropdown'ы disabled (1.105).
- **`_openEditSheet`** — `useSafeArea: true` + высота = экран − клавиатура − safe area (1.103).
- **Лейблы шапки тары** — без «(черновик)» (1.104).

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

- **`c-8b-status`** — смена статуса тары через шапку (5 значений, офлайн через `sync_queue`) — ✅.
---

## Не трогать

- `RULES.md`, `TEMPLATES.md`.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` (только `.env.example`).
- Ветка `fix/2.x-web-v2-bundle-7` (WIP).
- `work-pc-setup/`, `wms-bundle/`, `D:\Dev\maven-local`, `D:\Dev\android-sdk\ndk\28.2.13676358`.

- **`c-8b-status`** — смена статуса тары через шапку (5 значений, офлайн через `sync_queue`) — ✅.
---

## Правила текущей сессии

- Кодовая фаза.
- Каждый заход — 1–3 файла (пачки-исключения).
- Файлы — единым блоком.
- Docs — отдельной пачкой.
- **Перед `git add` — `git status --short | grep "mobile/lib"`** (1.90).
- **Перед выдачей кода — то же, должно быть пусто** (1.91).

- **`c-8b-status`** — смена статуса тары через шапку (5 значений, офлайн через `sync_queue`) — ✅.
---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`

Остальное — по запросу.