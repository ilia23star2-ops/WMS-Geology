# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-11-24

---

## Где мы

**Активная серия:** `feature/3.x-migration` (OCR, переоткрыта 2026-11-13).
**Ветка:** `feature/3.x-migration`.

**Текущий заход:** серия sync-аудита закрыта (слияние полей, экран расхождений, prune справочников, русские тексты ошибок, insets).
Далее: планирование `3.x-mobile-gap`. Остаток OCR: `6e-2-dup`, `6k`, `6e-4`.

**Тесты (замерено 2026-11-23, run.sh all на рабочем ПК):**
- **Backend: 1054** (в т.ч. **149** в `apps.ocr`)
- **Web: 242** (27 файлов)
- **Mobile: 387**

### Закрыто в серии OCR (последнее сверху)

- **sync-audit + ui-insets-a** ✅ — слияние полей при конфликте, экран расхождений, prune устаревших справочников (оба пути), русские тексты ошибок, нижний inset. Mobile 275 → 387 тестов.
- **6e-5-ocr-memory** ✅ — память исправлений OCR: модель (миграция 0005) → обучение в approve → чтение в резолвере. 4 захода, apps/ocr 134 → 149.

- **6e-4-resolve** ✅ — единый серверный резолвер зон: канонизатор → резолвер по справочникам БД → вердикты в API → персист в raw_ocr_data → web-чип → мобильный SnackBar. 7 заходов, +30 тестов.
- **agent-infra** ✅ — CI реально гоняет тесты, scripts/agent/run.sh, job Report (agent/reports/LATEST.md). 3 захода.
- **6e-3-backend** ✅ `bae05c7` — имя пакета: авто «адрес ячейки + дата» / вручную; web — inline-переименование и пользователь в списке; mobile — поле «Имя пакета», `name` уходит первым `recognize`; SENT-гард; `POST /zones/` пересчитывает `extracted`. Device-check: пакет #32 «Тара мобайл», #29 автоимя.
- **6e-2-web-7-web** ✅ — Н/З и его OCR-двойники (`TUT13209`) больше не считаются пробами; аудит учитывает зоны `sample` и скаляры шапки.
- **6e-3-web** ✅ — сессия оцифровки в web: каскадный выбор ячейки, записи с фото, очередь с прогрессом и SENT.
- **6e-2-web-2/4/5/6, fix5–fix8** ✅ — инлайн-правка токена, зум/панорама/яркость, рисование зон и авто-зоны, подсказки OCR-ошибок, обратный аудит, дубли-блокер, deep-link тары.
- **6e-2 / 6e-2-site / 6e-2-site-fix2** ✅ — разметка зон на мобилке, тип зоны «Участок», `_pick_scalar`, `_fix_leading_confusion`.
- **6e-a1…a3, 6e-1** ✅ — сессионный экран OCR, отправка сессии, один вход «Оцифровка».
- **6f-1, 5b–5f, 6i** ✅ — approve с `cell_id`, web-проверка, списки батчей, zones+mapping, preprocess.

**Серия `3.x-offline`** (бранч `fix/2.x-mobile-bundle-c-2`) — на паузе.
**Серии `2.x-lifecycle`, `2.x-shipments`, `2.x-smart-input`, `2.x-lab-portal`, `2.x-rbac`** — закрыты.

### Что осталось (OCR)



- **Разрывы аудита mobile:** каскад выбора ячейки — заглушка; очередь фото без статусов; сессия не переживает перезапуск; авто-зон нет.
- **`c-3.x-migration-8`** — web fallback без зон.
- **ТД-78/79/80/82/83/84/85/86/93/94/96** — см. `PLAN.md`.

### Известные грабли

- **BOM в `mobile/android/gradle.properties`** молча отключает первую строку (`org.gradle.jvmargs`) → D8 падает с OOM при любом `-Xmx`. Проверять фактический `-Xmx` демона.
- **`work-pc-setup/setup.ps1`** шаг 2 **удаляет** `D:\Dev\maven-local`, а в `work-pc-setup/maven-local/` нет `io/flutter`. После запуска восстанавливать артефакты из кэша Gradle. Шага проводки `allprojects.repositories` в скрипте нет.
- **`WMS-Build-Pack/gradle-caches/9.3.1/install_build_env.ps1`** — **не запускать**: сносит `~/.gradle/caches` и копирует из несуществующих путей.
- **Сборка APK на работе (офлайн):** `maven-local` первым в `allprojects.repositories` → `flutter build apk --debug --target-platform android-arm64 --android-skip-build-dependency-validation --dart-define=API_HOST=127.0.0.1 --dart-define=API_SCHEME=http`.
- **applicationId мобилки** — `com.wmsgeology.wms_geology_mobile` (не `com.example.…`).
- **Python и пути:** Windows-Python не понимает MSYS2 `/tmp` — писать в относительный путь, вывод в UTF-8 файл.
- **Троттлинг логина (429)** — перезапуск backend сбрасывает счётчик (кэш в памяти процесса).
- **`ocr_runner.py`** — `python_exe` захардкожен (ТД-79), вне рабочего ПК не заведётся.
- **`npm run build`** — падает на pre-existing MUI 9 в 5 файлах (ТД-81/92). Dev работает.
- **Буфер чата:** `wms_report` шлёт base64 через stdin; сводки >24 КБ молча не копируются.

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
- JWT, OpenAPI, 11 приложений (в т.ч. `apps.ocr`).
- Node 24, Vite 8, React 19, MUI 9.
- Flutter 3.47 + Dart 3.13 + mobile_scanner 7.4.2.
- EasyOCR на портативном Python 3.12 (`D:\Dev\python312`, только рабочий ПК).
- CI: `.github/workflows/ci.yml`.

### Backend (1016 тестов)

| Приложение | Что внутри |
|---|---|
| `storage` | Топология, Pallet, ContainerType, Container (+draft, PENDING_FILLING, DISPOSED, parent), bulk-create, fill-samples, bulk-place, create-in-cell, history, `current_holder`, suggestions |
| `samples` | ResearchType, Site, Laboratory, Well, Sample (+is_encrypted, parent, DISPOSED, SELECTED), SampleWorkOrder, sync, `encrypt` |
| `work_orders` | WorkOrder (self-ref + site, admin, samples_count) |
| `receiving` | Receipt, ReceiptItem, ImportSession, conflicts, act |
| `picking` | PickList, Shipment (+direction), ShipmentItem, ShipmentContainerItem, `repack-samples` |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, ActualizationTask |
| `users` | Role, UserProfile (+laboratory), AuditLog, JWT, `permissions.py` |
| `labels` | QR-сервис, PDF-этикетки, PrintBatch, act_service |
| **`ocr`** (112) | **`OcrBatch` (+name), `OcrTask` (+zones, cell, sent_at), `recognize` (+zones_json, name), `zones` (пересчёт extracted), `approve`, `batches`, `mapping.py`, SENT-гард** |

### Web (React, 235 юнит-тестов)

| Раздел | Что внутри |
|---|---|
| Аутентификация | Zustand, login, protected routes, JWT-интерцептор |
| Layout | MUI sidebar + header по ролям |
| Тара | DataGrid, фильтры, CRUD, PDF, bulk-print, заполнение |
| Пробы | Дерево-таблица, `SampleEditDialog`, геометка |
| Отправка | `ShipmentsPage`, `ShipmentDetailPage`, диалоги |
| **OCR** | **`OcrBatchesPage` (имя inline, пользователь), `OcrBatchDetailPage`, `OcrSessionPage` (каскад, очередь, SENT), `OcrReviewPage` (зоны, авто-зоны, аудит проб, подсказки, готовность), `RangeEditDialog`, `SmartAutocomplete`** |

### Mobile (Flutter, 273 юнит-теста)

| Раздел | Что внутри |
|---|---|
| Офлайн | SQLite, SyncService, SyncQueue, Deferred Login, Auto-detect |
| Сеть | `NetworkProbe`, `NetworkStatusProvider`, `NetworkBadge` |
| Тара | фильтры, пагинация, офлайн-кэш, создание, карточка, заполнение |
| Пробы | поиск, bulk-статус, офлайн-редактирование |
| PDF | online + offline на Dart |
| **OCR** | **`OcrSessionScreen` (имя пакета, отправка, прогресс), `OcrCellScreen`, разметка зон (drag, zoom/pan, чипы)** |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS`, `DATABASE`, `API`, `SCENARIOS`, `UI`, `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`, `AGENTS`, `COMMANDS`.

---

## Не трогать

- `RULES.md`, `TEMPLATES.md`.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` (только `.env.example`).
- Ветка `fix/2.x-mobile-bundle-c-2` (WIP).
- `work-pc-setup/`, `wms-bundle/`, `D:\Dev\maven-local`, `D:\Dev\android-sdk\ndk\28.2.13676358`.
- Машинные `mobile/android/*` — **не коммитить** (п.15).

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`
5. `AGENTS.md` — если работа автономным агентом