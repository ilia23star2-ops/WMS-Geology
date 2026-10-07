# backend/ — Django-бэкенд WMS Geology

> Здесь будет серверная часть: API, модели, миграции, бизнес-логика.

## Что здесь

- Django 5.x + Django REST Framework.
- Модели, соответствующие `docs/DATABASE.md`.
- Миграции схемы БД.
- API-эндпоинты, соответствующие `docs/API.md`.
- Логика поиска, инвентаризации, генерации QR.
- Аудит действий (`AuditLog`).

## Стек

- Python 3.12+
- Django 5.x
- Django REST Framework
- PostgreSQL 16+ (драйвер `psycopg`)
- Poetry — управление зависимостями
- pytest — тесты

## Структура (планируется)
backend/
├── manage.py
├── pyproject.toml
├── .env.example
├── wms_geology/ # настройки проекта
│ ├── settings/
│ ├── urls.py
│ └── wsgi.py
├── apps/
│ ├── storage/ # топология склада, адресное хранение
│ ├── samples/ # пробы, типы, скважины
│ ├── work_orders/ # наряд-заказы
│ ├── inventory/ # инвентаризация
│ ├── labels/ # генерация QR и этикеток
│ └── users/ # пользователи и роли
└── tests/
├── unit/
├── integration/
└── contract/

text

## Документы

- `docs/DATABASE.md` — схема БД.
- `docs/API.md` — контракты API.
- `docs/TESTING.md` — что и как тестируется.

## Статус

🟡 Ожидает серии `feature/1.0-backend-init`.