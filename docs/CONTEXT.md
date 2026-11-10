# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-11-10

---

## Где мы

**Активная серия:** не выбрана. Все запланированные на текущий момент серии закрыты.
**Ветка:** `main`.

**Текущий заход:** серия `feature/2.x-lifecycle-4` — ✅ закрыта и влита в `main`.
- Пачка 1: Шифрование (флаг `is_encrypted`, заполнение `legacy_data` при `encrypt`, фикс 403 для `lab_worker`).
- Пачка 2: Перекладывание проб (`repack-samples`, `_handle_container_after_dispose`).

**Backend: 898 тестов.**
**Web: 24 юнит-теста.**
**Mobile: 227 юнит-тестов.**

**Серия `3.x-offline`** (долгоживущий бранч `fix/2.x-mobile-bundle-c-2`) — на паузе.
**Серия `2.x-lifecycle`** — закрыто 5/5 пачек.
**Серия `2.x-shipments`** — закрыта.
**Серия `2.x-smart-input`** — закрыта.
**Серия `2.x-lab-portal`** — закрыта.
**Серия `2.x-rbac`** — закрыта.

### Что готово
- **Шифрование:** при вызове `POST /samples/{id}/encrypt/` проба получает `is_encrypted=True`, заполняется `legacy_data` (старый номер и Н/З), создается новая связь M:N.
- **Перекладывание:** action `POST /shipments/{id}/repack-samples/` переносит пробы из одной тары в другую в рамках рейса (OUTBOUND, DRAFT/ASSEMBLED).
- **Права (RBAC):** `lab_worker` больше не получает 403 при чтении тары и проб (видит только свою лабораторию).

### Известные грабли
- **Admin:** `users/admin.py` зарегистрирован, но `lab_worker` не видит лишних разделов в Django Admin.
- **`mark_received`:** проверяет роль, `is_superuser` не проверяется (ТД-72, решено оставить).

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

### Backend (898 тестов)
| Приложение | Что внутри |
|---|---|
| `storage` | Топология, Pallet, ContainerType (+is_disposable), Container (+draft, PENDING_FILLING, DISPOSED, parent), bulk-create, fill-samples, bulk-place, create-in-cell, history, print_batch_status, `current_holder` |
| `samples` | ResearchType, Site, Laboratory, Well, Sample (+is_encrypted, parent, DISPOSED, SELECTED), SampleWorkOrder, sync-сервис, `encrypt`, `current_holder` |
| `work_orders` | WorkOrder (self-ref + site, admin, samples_count) |
| `receiving` | Receipt, ReceiptItem, ImportSession, conflicts, act |
| `picking` | PickList, Shipment (+direction), ShipmentItem, ShipmentContainerItem, `repack-samples` |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, ActualizationTask |
| `users` | Role, UserProfile (+laboratory), AuditLog, JWT, `permissions.py` |
| `labels` | QR-сервис, PDF-этикетки, PrintBatch, act_service |

### Web (React, 24 юнит-теста)
| Раздел | Что внутри |
|---|---|
| Аутентификация | Zustand-стор, login, protected routes, JWT-интерцептор. |
| Layout | MUI sidebar + header. `Sidebar` настроен по ролям. |
| Тара | DataGrid, фильтры, edit, delete, PDF, bulk-print, создание, заполнение, предпросмотр. Скрытие по ролям. |
| Пробы | Дерево-таблица, `SampleEditDialog`, геометка. |
| Отправка | `ShipmentsPage`, `ShipmentDetailPage`, `CreateShipmentDialog`, `AddContainersToShipmentDialog`. |

### Mobile (Flutter, 227 юнит-тестов)
| Раздел | Что внутри |
|---|---|
| Офлайн-режим | SQLite, SyncService, SyncQueue, Deferred Offline Login, Auto-detect. |
| Сеть | `NetworkProbe`, `NetworkStatusProvider`, `NetworkBadge`. |
| Тара | 4 фильтра, пагинация, офлайн-кэш, создание. |
| Карточка тары | 3 вкладки, `ContainerEditForm`, `FillContainerContent`, история. |
| Пробы | Поиск, чекбоксы, bulk-статус, офлайн-редактирование через `sync_queue`. |
| PDF | Online + offline на Dart. |

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