# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-11-18

---

## Где мы

**Активная серия:** `feature/3.x-migration` (OCR, переоткрыта 2026-11-13).
**Ветка:** `feature/3.x-migration`.

**Текущий заход:** `feature/3.x-migration` — закрыты 5b…5f, 6e-1, 6e-a1…6e-a3, 6e-2, 6e-2-site (+fix2); следующие 6e-2-web (labels/переключатель/кнопка тары), 6k (без ячейки), 6e-4 (качество фото).
- **5b** — Web OCR review базовая (страница, approve, bbox-overlay).
- **5c** — Web: списки батчей (`OcrBatchesPage`, `OcrBatchDetailPage`), sidebar «Оцифровка», `SmartAutocomplete` в форме.
- **5d** — Web: `Н/З (входящий)` подсказки (`work_orders_incoming` в `/storage/suggestions/`).
- **5e** — Backend: `OcrTask.zones`, `POST /ocr/tasks/{id}/zones/`, `mapping.py` (bbox ∩ words → `extracted`), авто-вызов в `recognize` (принимает `zones_json`).
- **5f** — Web: предзаполнение из `extracted`, двусторонняя подсветка bbox ↔ поля, диапазоны через `SmartAutocomplete` + `RangeEditDialog` (skip/selected), группировка по скважинам.
6f-1 — Backend: approve с batch.cell_id → Pallet+ACTIVE; приоритет payload>task>batch; миграция 0003.
6f-1-pre — Pre-existing: encrypt action (4 бага + RBAC); stale-тесты sorting/encryption.
6e-1 — Mobile: batch OCR (список фото → один батч), 6a-fix2 (label ячейки из API); Backend: поддержка cell_id/batch_id в recognize.
6e-a1 — Mobile: экран сессии OCR (`OcrSession` в провайдерах, `OcrSessionScreen`, `OcrCellScreen`) + фиксы notify/inset/context.mounted; Backend: `6e-1a` (`cell` в `OcrTask`, `sent_at`/`SENT`, приоритет approve).
6e-a2 — Mobile: замена входа «Оцифровка» на сессионный экран, удаление OcrNewScreen; один пункт drawer (6e-a2-fix).
6e-a3 — Mobile: отправка сессии (recognize→sendBatch→clear) + прогресс; Web: метка SENT + stay-after-approve; Backend: PATCH batches→SENT, ASCII-safe runner (6e-a3-pre).
6e-2 — Mobile: разметка зон на фото (drag-прямоугольник-тип, zoom/pan жестами, легенда-чипы в цвет зоны, авторазграничение пересекающихся зон с зазором).
6e-2-site — Backend+Mobile: тип зоны Участок (ZONE_TYPES, mapping site_from_zone, UI); _pick_scalar v2 — из многословного текста зоны берётся токен формата, одиночная лексема as-is.
6e-2-site-fix2 — Backend: _fix_leading_confusion (T→1 сразу после валидного префикса, TSTT234501→TST1234501); container_number из зоны подтверждён device-check.

**Backend: 999 тестов** (в т.ч. **95** в `apps.ocr`).
**Web: 30 юнит-тестов** (в т.ч. 6 `parseSampleGroups`).
**Mobile: 270 юнит-тестов.**

**Серия `3.x-offline`** (долгоживущий бранч `fix/2.x-mobile-bundle-c-2`) — на паузе.
**Серия `2.x-lifecycle`** — закрыта (5/5 пачек).
**Серия `2.x-shipments`** — закрыта.
**Серия `2.x-smart-input`** — закрыта.
**Серия `2.x-lab-portal`** — закрыта.
**Серия `2.x-rbac`** — закрыта.

### Что готово (OCR, 5b-5f)

- **Backend:**
  - `mapping.py`: OCR-fix (`O→0`, `I/l→1`), `_fix_prefix` (ST→TST), фильтр по `valid_prefixes` (site+lab+match_patterns), Latin↔Cyrillic.
  - `ocr_preprocess.py`: EXIF rotate + resize + gray + autocontrast + unsharp, вызывается из `ocr_runner.py`.
  - `POST /api/v1/ocr/recognize/` — принимает `image` + (опц.) `zones_json`. EasyOCR на python312. Возвращает `data` + `extracted`.
  - `POST /api/v1/ocr/tasks/{id}/zones/` — сохранить разметку зон.
  - `POST /api/v1/ocr/tasks/{id}/approve/` — `Container` + `Sample` + `WorkOrder` link из `sample_groups`.
  - `GET /api/v1/ocr/batches/` / `batches/{id}/` / `tasks/{id}/` — списки.
  - `apps/ocr/services/mapping.py` — 6 типов зон (`work_order_coded`, `work_order_incoming`, `container_number`, `research_type`, `sample`, `well`), AABB-intersect, regex-fallback для samples/wells.
- **Mobile:**
  - Drawer «Оцифровка» → `OcrNewScreen`: камера / галерея / QR ячейки → `POST /recognize/`.
  - `OcrService.recognize()`, `ApiClient.uploadMultipart()`, `QrCellScannerDialog`.
  - Drawer «Оцифровка (сессия)» → `OcrSessionScreen` / `OcrCellScreen`, модель `OcrSession` (ChangeNotifier) в `MultiProvider`.
- **Web:**
  - Sidebar «Оцифровка» → `/ocr/batches`.
  - `OcrReviewPage`: prefill `site`/`research_type`/`container_type` из `extracted`; fallback проб (raw с warning); клики `words[]` ↔ поля.
  - Форма `/ocr/review/:id` — предзаполнение, подсветка, диапазоны, `RangeEditDialog`.
- **Demo (device-check 5f):** `curl` с `image` + `zones_json` → task READY → open `/ocr/review/N` → approve → Container + 3 Sample.

### Что осталось (OCR)

- **`c-3.x-migration-8`** — Web: fallback без зон (regex по всему тексту).
- **ТД-78/79** — `apps/ocr/services/` спящие файлы; `ocr_runner.py` python_exe хардкод.
- **ТД-80** — расхождение формата `sample_number` (DATABASE.md vs код vs UI).
- **ТД-82** — связь номера тары ↔ диапазон проб.
- **ТД-83** — мёртвый `parseSampleGroups.ts` после 5f.
- **`c-3.x-migration-6e-2-site`** — тип зоны Участок (backend сначала); **`6e-2-web`** — переключатель зон; **`6e-4`** — качество фото при съёмке.

### Что было закрыто до OCR (2.x-lifecycle, для истории)

- **Шифрование:** `POST /samples/{id}/encrypt/` → `is_encrypted=True`, `legacy_data`.
- **Перекладывание:** `POST /shipments/{id}/repack-samples/`.
- **RBAC:** `lab_worker` видит только свою лабораторию.

### Известные грабли

- **Admin:** `users/admin.py` зарегистрирован, но `lab_worker` не видит лишних разделов в Django Admin.
- **`mark_received`:** проверяет роль, `is_superuser` не проверяется (ТД-72, оставлено).
- **`npm run build`** — `rc=2` из-за pre-existing MUI 9 breaking changes в 5 файлах (`PoolPage`, `ShipmentsPage`, `TopologyPage`, `ContainersPage`, `SamplesTreeTable`). ТД-81. Dev (`npm run dev`) работает.
- **`ocr_runner.py`** — `python_exe = r"D:\Dev\python312\python.exe"` захардкожен (ТД-79). На другой машине не заведётся.
- **Буфер чата:** `wms_report` шлёт base64 через stdin; аргумент командной строки powershell.exe ограничен 32767 символами → сводки >24 КБ молча не копируются (починено 2026-11-18).
  - **Сборка на рабочем ПК** — без `export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn` в каждом окне Gradle тянет движок с storage.googleapis.com → прокси ломает сертификат (PKIX). Артефакты лежат в `D:/Dev/maven-local`, среда разворачивается `install_build_env.ps1`.

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
- Node 20+, Vite 8, React 19, MUI 9.
- Flutter 3.47 + Dart 3.13 + mobile_scanner 7.4.2.
- EasyOCR на портативном Python 3.12 (`D:\Dev\python312`, только рабочий ПК).

### Backend (985 тестов)

| Приложение | Что внутри |
|---|---|
| `storage` | Топология, Pallet, ContainerType (+is_disposable), Container (+draft, PENDING_FILLING, DISPOSED, parent), bulk-create, fill-samples, bulk-place, create-in-cell, history, print_batch_status, `current_holder`, suggestions |
| `samples` | ResearchType, Site, Laboratory, Well, Sample (+is_encrypted, parent, DISPOSED, SELECTED), SampleWorkOrder, sync-сервис, `encrypt`, `current_holder` |
| `work_orders` | WorkOrder (self-ref + site, admin, samples_count) |
| `receiving` | Receipt, ReceiptItem, ImportSession, conflicts, act |
| `picking` | PickList, Shipment (+direction), ShipmentItem, ShipmentContainerItem, `repack-samples` |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, ActualizationTask |
| `users` | Role, UserProfile (+laboratory), AuditLog, JWT, `permissions.py` |
| `labels` | QR-сервис, PDF-этикетки, PrintBatch, act_service |
| **`ocr`** | **`OcrBatch`, `OcrTask` (+zones), `POST /recognize/` (+zones_json), `POST /zones/`, `POST /approve/`, `GET /batches/`, `mapping.py`, `approve.py`, `ocr_runner.py`** |

### Web (React, 30 юнит-тестов)

| Раздел | Что внутри |
|---|---|
| Аутентификация | Zustand-стор, login, protected routes, JWT-интерцептор. |
| Layout | MUI sidebar + header. `Sidebar` настроен по ролям. |
| Тара | DataGrid, фильтры, edit, delete, PDF, bulk-print, создание, заполнение, предпросмотр. Скрытие по ролям. |
| Пробы | Дерево-таблица, `SampleEditDialog`, геометка. |
| Отправка | `ShipmentsPage`, `ShipmentDetailPage`, `CreateShipmentDialog`, `AddContainersToShipmentDialog`. |
| **OCR** | **`OcrBatchesPage`, `OcrBatchDetailPage`, `OcrReviewPage` (v10), `RangeEditDialog`, `SmartAutocomplete`, `api/ocr.ts`** |

### Mobile (Flutter, 244 юнит-тестов)

| Раздел | Что внутри |
|---|---|
| Офлайн-режим | SQLite, SyncService, SyncQueue, Deferred Offline Login, Auto-detect. |
| Сеть | `NetworkProbe`, `NetworkStatusProvider`, `NetworkBadge`. |
| Тара | 4 фильтра, пагинация, офлайн-кэш, создание. |
| Карточка тары | 3 вкладки, `ContainerEditForm`, `FillContainerContent`, история. |
| Пробы | Поиск, чекбоксы, bulk-статус, офлайн-редактирование через `sync_queue`. |
| PDF | Online + offline на Dart. |
| **OCR** | **OcrSessionScreen / OcrCellScreen, отправка сессии, прогресс; один вход «Оцифровка».** |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS`, `DATABASE`, `API`, `SCENARIOS`, `UI`, `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`.

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