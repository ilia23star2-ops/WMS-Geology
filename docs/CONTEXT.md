# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-11-13

---

## Где мы

**Активная серия:** `feature/3.x-migration` (OCR, переоткрыта 2026-11-13).
**Ветка:** `feature/3.x-migration`.

**Текущий заход:** `feature/3.x-migration` — закрыты `c-3.x-migration-5b` … `5f`:
- **5b** — Web OCR review базовая (страница, approve, bbox-overlay).
- **5c** — Web: списки батчей (`OcrBatchesPage`, `OcrBatchDetailPage`), sidebar «Оцифровка», `SmartAutocomplete` в форме.
- **5d** — Web: `Н/З (входящий)` подсказки (`work_orders_incoming` в `/storage/suggestions/`).
- **5e** — Backend: `OcrTask.zones`, `POST /ocr/tasks/{id}/zones/`, `mapping.py` (bbox ∩ words → `extracted`), авто-вызов в `recognize` (принимает `zones_json`).
- **5f** — Web: предзаполнение из `extracted`, двусторонняя подсветка bbox ↔ поля, диапазоны через `SmartAutocomplete` + `RangeEditDialog` (skip/selected), группировка по скважинам.

**Backend: 918 тестов** (в т.ч. **44** в `apps.ocr`).
**Web: 30 юнит-тестов** (в т.ч. 6 `parseSampleGroups`).
**Mobile: 227 юнит-тестов.**

**Серия `3.x-offline`** (долгоживущий бранч `fix/2.x-mobile-bundle-c-2`) — на паузе.
**Серия `2.x-lifecycle`** — закрыта (5/5 пачек).
**Серия `2.x-shipments`** — закрыта.
**Серия `2.x-smart-input`** — закрыта.
**Серия `2.x-lab-portal`** — закрыта.
**Серия `2.x-rbac`** — закрыта.

### Что готово (OCR, 5b-5f)

- **Backend:**
  - `POST /api/v1/ocr/recognize/` — принимает `image` + (опц.) `zones_json`. EasyOCR на python312. Возвращает `data` + `extracted`.
  - `POST /api/v1/ocr/tasks/{id}/zones/` — сохранить разметку зон.
  - `POST /api/v1/ocr/tasks/{id}/approve/` — `Container` + `Sample` + `WorkOrder` link из `sample_groups`.
  - `GET /api/v1/ocr/batches/` / `batches/{id}/` / `tasks/{id}/` — списки.
  - `apps/ocr/services/mapping.py` — 6 типов зон (`work_order_coded`, `work_order_incoming`, `container_number`, `research_type`, `sample`, `well`), AABB-intersect, regex-fallback для samples/wells.
- **Web:**
  - Sidebar «Оцифровка» → `/ocr/batches`.
  - Форма `/ocr/review/:id` — предзаполнение, подсветка, диапазоны, `RangeEditDialog`.
- **Demo (device-check 5f):** `curl` с `image` + `zones_json` → task READY → open `/ocr/review/N` → approve → Container + 3 Sample.

### Что осталось (OCR)

- **`c-3.x-migration-6`** — Mobile «Оцифровка»: ячейка → фото → зоны → `POST /recognize/`.
- **`c-3.x-migration-7`** — Mobile: SyncQueue для зон (офлайн).
- **`c-3.x-migration-8`** — Web: fallback без зон (regex по всему тексту).
- **ТД-78/79** — `apps/ocr/services/` спящие файлы; `ocr_runner.py` python_exe хардкод.
- **ТД-80** — расхождение формата `sample_number` (DATABASE.md vs код vs UI).
- **ТД-82** — связь номера тары ↔ диапазон проб.
- **ТД-83** — мёртвый `parseSampleGroups.ts` после 5f.

### Что было закрыто до OCR (2.x-lifecycle, для истории)

- **Шифрование:** `POST /samples/{id}/encrypt/` → `is_encrypted=True`, `legacy_data`.
- **Перекладывание:** `POST /shipments/{id}/repack-samples/`.
- **RBAC:** `lab_worker` видит только свою лабораторию.

### Известные грабли

- **Admin:** `users/admin.py` зарегистрирован, но `lab_worker` не видит лишних разделов в Django Admin.
- **`mark_received`:** проверяет роль, `is_superuser` не проверяется (ТД-72, оставлено).
- **`npm run build`** — `rc=2` из-за pre-existing MUI 9 breaking changes в 5 файлах (`PoolPage`, `ShipmentsPage`, `TopologyPage`, `ContainersPage`, `SamplesTreeTable`). ТД-81. Dev (`npm run dev`) работает.
- **`ocr_runner.py`** — `python_exe = r"D:\Dev\python312\python.exe"` захардкожен (ТД-79). На другой машине не заведётся.

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

### Backend (918 тестов)

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

### Mobile (Flutter, 227 юнит-тестов)

| Раздел | Что внутри |
|---|---|
| Офлайн-режим | SQLite, SyncService, SyncQueue, Deferred Offline Login, Auto-detect. |
| Сеть | `NetworkProbe`, `NetworkStatusProvider`, `NetworkBadge`. |
| Тара | 4 фильтра, пагинация, офлайн-кэш, создание. |
| Карточка тары | 3 вкладки, `ContainerEditForm`, `FillContainerContent`, история. |
| Пробы | Поиск, чекбоксы, bulk-статус, офлайн-редактирование через `sync_queue`. |
| PDF | Online + offline на Dart. |
| **OCR** | **нет UI (удалён в `c-3.x-migration-1/2`). Планируется `c-3.x-migration-6`.** |

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