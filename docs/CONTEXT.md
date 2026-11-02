# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-11-02

---

## Где мы

**Активная серия:** `feature/3.x-offline` — офлайн-режим мобильного приложения.
**Долгоживущий бранч:** `fix/2.x-mobile-bundle-c-2` (вся серия в нём).

**Текущий заход:** серия `c` (мобильный офлайн).
- **`c-1`** — SQLite (таблицы `containers`, `samples`, DAO, инициализация). ✅
- **`c-2`** — `SyncService` (Pull-синхронизация с сервера). ✅ **Закрыт 2026-10-29**.
- **`c-3`** — `SyncQueue` + `SyncPusher` (Push-синхронизация). ✅ **Закрыт 2026-10-29**.
- **`c-4`** — `SyncProvider` + `SyncScreen` + кнопка на главном. ✅ **Закрыт 2026-10-29**.
- **`c-4.5`** — Deferred Offline Login (QR с base64-JSON, pending-токены, роли из QR). ✅ **Закрыт 2026-10-30**.
- **`c-4.6`** — USB-режим (`adb reverse`, `--dart-define=API_HOST`, SQLite v4, fallback `SampleService`). ✅ **Закрыт 2026-10-30**.
- **`c-6a-pre`** — починка pre-existing (log_audit old_value, UserProfile.__str__, stale-тесты AccessToken). ✅ **Закрыт 2026-10-30**.
- **`c-6a`** — backend: `GET /health/` + денормализация сериализаторов (`container_type_name`, `floor_room_name`, `cell_full_address`). ✅ **Закрыт 2026-10-30**.
- **`c-6b`** — backend: `?updated_since=` (инкрементальный Pull для containers и samples). ✅ **Закрыт 2026-10-30**.
- **`c-6c`** — mobile: auto-detect сети (`NetworkProbe` + `AppConfig.resolve`, 3 кандидата). ✅ **Закрыт 2026-10-30**.
- **`c-6d-fix`** — mobile: scanWindow 220×220 (мёртвая зона), `_pickBarcodeInScanWindow` по `corners`. ✅ **Закрыт 2026-11-02**.
- **`c-6d-fix-3`** — mobile: landscape-фикс (swap effectiveSize при rotated corners). ✅ **Закрыт 2026-11-02**.
- **`c-6e`** — mobile: баннер pending + бейдж сети. ⬜ **следующий**.
- **`c-7a`..`c-7g`** — экраны «как в вебе» (карточка тары, списки, ячейка, WorkOrders, offline-печать). ⬜
- **`c-8a`..`c-8e`** — изменения в офлайне (`sync_queue`, автотриггер). ⬜

**Отложено:** `c-5` — файловая синхронизация (sneakernet через флешку).

**Предыдущая серия:** `2f` — закрыта полностью (см. `PROGRESS.md`).

**Что готово (mobile):**
- Логин (пароль + QR), logout, refresh токенов.
- Сканер QR, карточка тары, список проб внутри.
- **SQLite (`c-1`)**: локальная БД (`ContainerDao`, `SampleDao`).
- **SyncService (`c-2`)**: постраничная Pull-синхронизация (по 50 записей), DI для тестов.
- **SyncQueue (`c-3`)**: очередь POST/PATCH/DELETE + `SyncPusher`.
- **SyncScreen (`c-4`)**: экран синхронизации с индикатором и статистикой.
- **Deferred Offline Login (`c-4.5`)**: QR = base64-JSON `{token, purpose, expires_at, user}`. Без сети — «Временный доступ» (оранжевая плашка), роль из QR.
- **История сканов**: последние 10 отсканированных тар (`shared_preferences`).
- **Офлайн-карточка (`c-4.6`)**: `ContainerService` / `SampleService` fallback на DAO при ошибке сети.
- **Auto-detect сети (`c-6c`)**: `NetworkProbe.resolve()` пингует `GET /health/` (2 с) на `127.0.0.1` / `192.168.0.77` / `10.0.2.2`, первый живой — в `apiBaseUrl`. `--dart-define=API_HOST` переопределяет. Fallback `192.168.0.77`.
- **ScanWindow (`c-6d-fix`, `c-6d-fix-3`)**: мёртвая зона 220×220, фильтр `_pickBarcodeInScanWindow` по центру `corners` → `BoxFit.cover`. Landscape-фикс: swap effectiveSize, т.к. `capture.size` не swap при повороте, а `corners` — swap.

**Что нужно добавить (mobile):**
- `c-6e` — баннер pending + бейдж сети.
- `c-7a`..`c-7g` — экраны «как в вебе».
- `c-8a`..`c-8e` — изменения в офлайне.

**Сборка на рабочем ПК (прокси):**
- Используется `work-pc-setup/setup.ps1` + `wms-bundle/install_bundle.ps1` (сертификаты, `maven-local`, NDK, platform, build-tools).
- Флаг `--android-skip-build-dependency-validation`.
- JDK 17 (`D:\Dev\jdk-17`), Gradle 9.3.1.
- `FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn` — в `export` перед `flutter run`.
- **После `git reset --hard`** на рабочем ПК: `setup.ps1` → `export FLUTTER_STORAGE_BASE_URL=...` → `flutter run --android-skip-build-dependency-validation`. Иначе: сертификаты, `maven-local`, aapt2, NDK, Kotlin heap — всё теряется.
- **После успешной сборки — очистка** `wms-bundle/` (NDK и т.д. уже распакованы).

**Предыдущие заходы:**
- `receiving-3` (3a → 3d-3): экран сверки, `/questions` удалён,
  `conflicts` / `check` / `complete`, PDF «Акт приёмки».
- `3f-1` / `3f-1b` / `3f-2`: PDF акта, stale tests, кнопка в web.
- Серия `2f` (закрыта полностью): полный CRUD, Топология, Печать, Н/З, аудит,
  единое окно тары, `print_batch_status`.

**Что готово (backend, серия 2.x-web-v2):**
- `current_location` в `SampleSerializer` + фильтры (`?q=`, `?no_work_order=`).
- `GET /samples/grouped/` — группировка по Н/З + тип.
- `Sample.STATUS_PENDING_PLACEMENT`, `Sample.STATUS_SELECTED` + сервис `sync_sample_status_for_container`.
- `POST /storage/containers/bulk-create/`, `fill-samples`, `bulk-place`, `create-in-cell`.
- `DELETE /storage/containers/{id}/?force=true`.
- **`WorkOrder`**: admin, `samples_count` / `containers` / `linked_order_number`.
- Force-удаление топологии: Room / Rack / Section / Tier / Cell.
- **Аудит тары**: `log_audit()` в 6 actions `ContainerViewSet`, `GET /storage/containers/{id}/history/`.
- **`print_batch_status`** в `ContainerSerializer`.
- Excel-импорт, приёмка, печать.

**Что готово (backend, серия 3.x-offline):**
- `POST /auth/offline-login/`, `POST /auth/code-login/`.
- `AccessToken.qr_svg` + `make_access_token_qr_svg(purpose, raw, expires_at, user)`.
- **`GET /health/`** (`c-6a`) — 200 без авторизации, `{status, service, time}`.
- **Денормализация (`c-6a`)** — `ContainerSerializer`: `container_type_name`, `floor_room_name`, `cell_full_address`. `SampleSerializer` уже имел `research_type_name`, `site_name`, `container_number`, `current_work_order_number`.
- **`?updated_since=` (`c-6b`)** — на `/storage/containers/` и `/samples/`. ISO 8601 с таймзоной; naive / невалидный → 400. Хелпер `apps/storage/filters.py::apply_updated_since`.
- **`log_audit(old_value=...)` восстановлен** (`c-6a-pre`).

**Что готово (web):**
- Логин, layout, главная, тара, пробы, печать, справочники, топология, приёмка, WorkOrders, единое окно тары, `AccessTokensPage`.

**Backend:** 842 теста.
**Web:** 24 юнит-теста.
**Mobile:** 63 юнит-теста.

**Ближайшая работа:**
- Docs-пачка (эта) → `c-6e` (баннер pending + бейдж сети) → `c-7a` (карточка тары «как в вебе»).

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
- Flutter 3.47 + Dart 3.13 + mobile_scanner 7.4.2.

### Backend (842 теста)
| Приложение | Что внутри |
|---|---|
| `storage` | Топология, Pallet, ContainerType, Container (+draft, nullable number, PENDING_FILLING), bulk-create, fill-samples, bulk-place, create-in-cell, history, print_batch_status, **`filters.apply_updated_since`** |
| `samples` | ResearchType, Site, Laboratory, Well, Sample (+PENDING_PLACEMENT, SELECTED, dispose/restore), SampleWorkOrder, sync-сервис, **`?updated_since=`** |
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
| Тара | DataGrid, фильтры, edit, delete (с force), PDF, bulk-print, создание, заполнение, предпросмотр, геометка, иконки печати. |
| Пробы | Дерево-таблица, `SampleEditDialog`, геометка. |
| Наряд-заказы | `WorkOrdersPage`, диалоги создания / связывания / сводки. |
| Печать | Партии, детали, PDF, переименование. |
| Справочники | CRUD. |
| Приёмка | Список, детали, сверка, акт. |
| Топология | Дерево, ячейки, поддоны, `CellContentsDialog`, `CreateInCellDialog`, force-удаление. |
| Карточка тары | `ContainerDetailDialog` (Пробы / Редактирование / История + Предпросмотр / Разместить / Местоположение). |
| Коды доступа | `AccessTokensPage` — создание, просмотр QR, отзыв. |

### Mobile (Flutter, 63 юнит-теста)
| Раздел | Что внутри |
|---|---|
| Аутентификация | `AuthProvider`, login (пароль + QR), `TokenStorage` на `flutter_secure_storage`. |
| API | `ApiClient` (Dio), JWT-интерцептор. |
| Сеть | **`NetworkProbe` + `AppConfig.resolve` (c-6c)** — auto-detect `127.0.0.1` / `192.168.0.77` / `10.0.2.2` через `GET /health/`. `--dart-define=API_HOST` переопределяет. |
| Главная | Приветствие + «Сканировать», «Синхронизация», история тар, плашки «Офлайн-режим» / «Временный доступ». |
| Сканер | `mobile_scanner 7.4.2`, payload `WMSG:<TYPE>:<ID>`. **ScanWindow 220×220 (c-6d)**: `_pickBarcodeInScanWindow` + `mapImageToWidgetFrame` (BoxFit.cover + landscape-swap effectiveSize). |
| Карточка тары | Поля тары + список проб внутри. |
| Офлайн (SQLite) | `Database` v4, `ContainerDao`, `SampleDao`, `SyncQueueDao`. |
| Офлайн (Sync) | `SyncService.pullAll()` (Pull, 50/стр), `SyncPusher.pushAll()` (Push). |
| Офлайн (UI) | `SyncProvider`, `SyncScreen`, `Deferred Offline Login`, `ScanHistoryService`, `DeviceIdService`. |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS` (81), `DATABASE` (v7), `API`, `SCENARIOS`, `UI` (v2), `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`.

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
- `ProtectedError` при удалении Container с пробами, ContainerType с контейнерами, Sample из PickListItem и ShipmentItem. ViewSets отдают 409 (есть `?force=true`).
- **Каскадное удаление `ReceiptItem`** (2f-5a-1).
- **`poetry lock`** после изменения `pyproject.toml`.
- **Циклические импорты** — строковые ссылки.
- **Сортировка кириллицы в БД** — `sort_order`.
- **`poetry env remove --all && poetry install`** после переезда.
- **`apps/storage/services/`, `apps/receiving/parsers/`, `apps/receiving/services/` — пакеты**.
- **Django signals не используем** для sync-логики (1.58) и аудита (1.70).
- **`transaction.set_rollback(True)` несовместим с `import_session.save()`**.
- **`get_object()` уважает `get_queryset`.** Для утилизированных проб — `Model.objects.filter(pk=pk).first()`.
- **`Section.save()` / `Cell.save()` — двойной `super().save()`**.
- **stale-тесты при полном прогоне** — копятся, если долго гонять только `apps/<app>/`. Перед закрытием захода — `pytest -q` целиком.
- **`prefetch_related` с `Prefetch(to_attr=...)`** — `getattr(obj, "<to_attr>", None)`, не через `related_manager`.
- **`related_name="print_batch_items"`** у `PrintBatchItem.container`.

### API
- Аутентификация — JWT (`Authorization: Bearer <access>`).
- Pagination — `PageNumberPagination`, `PAGE_SIZE=50`.
- **Ключевой фильтр** `?work_order=` — учитывает linked_order.
- **`?updated_since=<ISO 8601>`** (c-6b) — на `/storage/containers/` и `/samples/`. С таймзоной, naive → 400.
- Custom actions: `link`, `complete`, `resolve`, `activate`, `pick`, `add-from-pick-list`, `execute`, `confirm`, `cancel`, `assemble`, `add-containers`, `remove-container`, `mark-ready`, `pdf`, `mark-printed`, `bulk-create`, `fill-samples`, `upload`, `import-shipment`, `conflicts`, `resolve-conflicts`, `check`, `act`, `dispose`, `restore`, `qr.pdf`, `qr-batch`, `bulk-place`, `create-in-cell`, `companion.pdf`, `history`, `revoke`, `offline-login`, `code-login`.
- **URL-схема:** `/api/v1/storage/...`, `/api/v1/labels/...`, остальные — без префикса. **`GET /health/`** (c-6a) — вне `/api/v1/`, без авторизации.

### Домен
- Проба = **навеска**. Не уникальна по номеру.
- Одна тара = один тип исследования.
- `Pallet` — «тихий» объект.
- `WorkOrders.linked_order_id` — self-ref INCOMING ↔ CODED.
- `Shipment.direction` — `INBOUND` / `OUTBOUND`.
- `ContainerType.laboratory` — NULL = общий.
- `PrintBatch.status` — soft через `CANCELLED`.
- `PrintBatchItem.container` — `PROTECT`.
- **Sample.STATUS_PENDING_PLACEMENT** синхронизируется с тарой.
- **Тара-заготовка**: `container_number = NULL`, draft-поля.
- **Импорт рейса**: `Receipt.site = NULL`, один `Receipt` на рейс.
- **`Container.container_number` — НЕ уникален глобально** (1.61).
- **`Container.STATUS_PENDING_FILLING`** — начальный статус (1.62).
- **ID (BigAutoField)** не переиспользуются (1.68).
- **`Sample.STATUS_SELECTED`** защищён от перезаписи (1.66).
- **`fill-samples` обновляет draft-поля из запроса** (1.69).
- **`AuditLog` для Container**: 6 действий + snapshot 6 полей (1.70).
- **`print_batch_status`**: последняя не-CANCELLED партия, 4 значения (1.71).

### Web
- **Vite proxy:** `/api/*` → `http://localhost:8000`.
- **MUI X v9:** `GridRowSelectionModel = { type, ids: Set<GridRowId> }`.
- **MUI X v9:** `DataGrid` с `paginationMode="server"` требует `rowCount` и `paginationModel`.
- **MUI 9:** `Grid size={{ xs, sm, md }}`.
- **MUI 9:** `Stack alignItems` и `justifyContent` — через `sx`.
- **MUI 9:** `Object.keys(...) as Type[]` внутри JSX ломает парсер.
- **React Router v7:** API совместим с v6.
- **Zustand:** F5 сбрасывает состояние — флаг `isBootstrapping`.
- **Vite build:** warning «chunks > 500 kB» — ожидаемо (ТД-21/ТД-35).
- **URL справочников:** `/research-types/`, `/sites/`, `/laboratories/` — без префикса.
- **MUI icons:** `DeleteOutline` и `AddCircleOutline` **не существуют**. `AccountTree` — топология.
- **`parseSampleInput`:** префикс — точно в `Laboratory.prefixes` + `Site.match_patterns`.
- **Диалог заполнения:** `fillContainerWithSamples` **обнуляет draft-поля**.
- **`FileResponse` в тестах:** читать `streaming_content`.
- **React Query Devtools не ставим** (ТД-36).
- **`TopologyPage`:** `CellPalletChip` — N+1, для 3–5 ячеек норм.
- **Force-удаление тары:** 409 → `?force=true`.
- **`tsconfig.json` без `baseUrl`:** `paths` от самого tsconfig (TS ≥4.4).
- **`AddToPrintBatchDialog`** инвалидирует `["containers"]` / `["container"]` / `["container-history"]`.
- **`AccessTokensPage`:** `qr_svg` — только для `is_active && qr_svg`.

### Mobile
- **URL API:** `config.dart` — `AppConfig.resolve()` (c-6c): `--dart-define=API_HOST` → probe → fallback `192.168.0.77`. Дома дефолт, на работе `--dart-define=API_HOST=127.0.0.1`.
- **Backend должен слушать `0.0.0.0:8000`** (WiFi) или `127.0.0.1:8000` + `adb reverse` (USB).
- **`DJANGO_ALLOWED_HOSTS`** должен включать IP.
- **Dio + `post`/`patch`:** обязательно `Content-Type: application/json`.
- **`flutter_secure_storage`** для JWT + `cached_user_json` + `pending_offline_token` + `pending_offline_expiry` + `pending_offline_user_json`.
- **`shared_preferences`** — `scan_history_ids`, `device_id`.
- **`mobile_scanner`:** `DetectionSpeed.normal` (не `noDuplicates` — иначе reject блокирует тот же QR навсегда).
- **`mobile_scanner 7.4.2`**: `BarcodeCapture.rotation` **не существует**; `InputImageRotation` из `google_mlkit_commons` не экспортируется. Rotation надо учитывать вручную.
- **`capture.size` не swap при повороте, `corners` — swap.** При landscape widget: effectiveSize = `(h, w)`. Это фикс `c-6d-fix-3`.
- **`Barcode.scaleCorners`** не учитывает landscape — не используем.
- **Конфликт имён `Container`:** `import 'package:flutter/material.dart' hide Container;` — **только в файлах с моделью `Container`** (`container_detail_screen.dart`). В `home_screen.dart` — без `hide`.
- **`ContainerProvider`:** только локально в `ScannerScreen` через `ChangeNotifierProvider` (не в `MultiProvider`).
- **`_openContainerById`:** через `ContainerService.fetchById`, не через `ContainerProvider`.
- **Dio 5.x:** `DioExceptionType` расширяется, в `switch` — `default`.
- **`ApiException.isNetworkError`** — в `_toApiException` по `DioExceptionType`, используется в `AuthProvider._isNetworkError`.
- **SQLite `version = 4`** в `AppDatabase`, `onUpgrade` = `DROP TABLE` + пересоздание.
- **`samples` схема:** `id, container_id, updated_at, data`. Без `container_id` — `no column named container_id`.
- **NDK 28.2.13676358**, **Android SDK Platform 36**.
- **Кириллица в пути** ломает Dart-анализатор.
- **`flutter pub get`** после каждого `pubspec.yaml`.
- **`mobile_scanner: ^7.4.2`** — минимум для landscape-фикса.

### Рабочий ПК (прокси)
- **Прокси `Polymetal.ru`** блокирует `dl.google.com`, `storage.googleapis.com`, `plugins.gradle.org`.
- **После `git reset --hard`** (обязательно): `work-pc-setup/setup.ps1` → `export FLUTTER_STORAGE_BASE_URL=...` → `flutter run --android-skip-build-dependency-validation`. Иначе: сертификаты, `maven-local`, aapt2-override, NDK, Kotlin heap — потеряны.
- **`install_bundle.ps1`** нужен только на новой машине или если NDK/platform/build-tools потеряны.
- **`aapt2FromMavenOverride`** в `mobile/android/gradle.properties`: `D:\\Dev\\android-sdk\\build-tools\\36.0.0\\aapt2.exe`. Без него — `Connection reset` с `dl.google.com`.
- **`kotlin.incremental=false`, `kotlin.compiler.execution.strategy=in-process`, `org.gradle.parallel=false`, `org.gradle.workers.max=2`** в `mobile/android/gradle.properties`. Иначе D8 OOM `mergeExtDexDebug` (даже с `-Xmx8G`).
- **NDK `source.properties`**: `setup.ps1` пишет с BOM (`EF BB BF`) → CMake не парсит revision. Фикс: `printf 'Pkg.Desc = Android NDK\nPkg.Revision = 28.2.13676358\n' > .../source.properties` (без BOM).
- **`cat >> file` без `\n` в конце файла склеивает строки.** Проверять `tail -N file`.
- **Не делать `git add .`** — машинные `mobile/android/*` (`maven-local`, `file:///`, `checkRevocation`, `kotlin.*`).
- **`adb reverse` сбрасывается** при переподключении USB, `adb kill-server`/`start-server`, перезагрузке планшета/ПК. Повторять.
- **После успешной сборки — вернуть Flutter SDK** (`git checkout -- packages/flutter_tools/gradle/`) и удалить `wms-bundle/`.

### Инструменты
- Git — только терминал.
- **Домашний ПК:** UCRT64 (MSYS2), SSH `github.com:22`.
- **Рабочий ПК:** Git Bash (MINGW64), SSH через порт 443.
- VS Code может дописывать `.vscode/settings.json` — откатывать.
- **UCRT64 (MSYS2)** ломает `manage.py shell -c "..."`.
- **`cat > file << 'EOF'`** — надёжный способ заменить файл в MSYS2.
- **`ipconfig`** в MSYS2 ломается на кодировке.
- **`git checkout -b` может упасть** на «already exists».
- **`tail` буферизует вывод** — для прогресса `pytest` без пайпа или `| tee`.
- **`pkill`** — нет в Git Bash, только `taskkill //F //IM <name>`.
- **В bash-блоке, который даёт ИИ, первая строка — `cd <проект>`**, а не `cd <подпапка>`. Иначе двойной `cd` (было в `c-6a`).

---

## Не трогать

- `RULES.md`, `TEMPLATES.md`.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` (только `.env.example`).
- Ветка `fix/2.x-web-v2-bundle-7` (WIP).
- `work-pc-setup/`, `wms-bundle/`, `D:\Dev\maven-local`, `D:\Dev\android-sdk\ndk\28.2.13676358` — машинные настройки.

---

## Правила текущей сессии

- Кодовая фаза.
- Каждый заход — 1–3 файла (пачки-исключения для boilerplate).
- Файлы выдаются единым блоком.
- Все Django-команды — через `poetry run`.
- Все web-команды — `cd web && npm ...`.
- Все mobile-команды — `cd mobile && flutter ...`.
- Docs — отдельной пачкой.
- **Рабочий ПК:** не делать `git add .`. Явные имена файлов.
- **Bash-блок от ИИ:** первая строка — `cd /d/Dev/projects/WMS-Geology`.
- **После `git reset --hard` на рабочем ПК:** `setup.ps1` обязателен.

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`

Остальное — по запросу.