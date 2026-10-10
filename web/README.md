# web/ — React-приложение для ПК (Windows / браузер)

> Веб-интерфейс для менеджеров, администраторов и частично
> кладовщиков (на ПК).

## Что здесь

- React-приложение для Windows / браузера.
- Дашборд с виджетами и быстрыми действиями.
- Реестр проб с фильтрами и поиском.
- Реестр тары.
- Создание и редактирование наряд-заказов.
- Управление топологией склада (комнаты, стеллажи, ячейки).
- Управление пользователями и ролями.
- Печать этикеток: корзина, PDF, QR-сетка.
- Отчёты и экспорт.

## Стек

- **TypeScript** — язык.
- **React 18+** — UI.
- **Vite** — сборка и dev-сервер.
- **React Router v6** — навигация.
- **TanStack Query** — серверное состояние, кэш, инвалидация.
- **MUI (Material UI)** — компоненты, тема от `#1E3A5F`.
- **Zustand** — клиентское состояние (auth, UI-настройки), с `persist`.
- **axios** — HTTP-клиент, JWT-интерцептор.
- **ESLint + Prettier** — код-стайл.
- **Vitest** — тесты (только для логики, не для JSX).

## Команды

    cd web
    npm install         # Установка зависимостей
    npm run dev         # Dev-сервер (http://localhost:5173)
    npm run build       # Production-сборка
    npm run preview     # Просмотр production-сборки
    npm test            # Тесты (Vitest)
    npm run lint        # ESLint
    npm run format      # Prettier

## Vite proxy

API запросы `/api/*` проксируются на `http://localhost:8000` (backend).
Настраивается в `vite.config.ts`.

## Документы

- `docs/API.md` — контракты API.
- `docs/UI.md` — дизайн-система (Material 3, MUI).
- `docs/SCENARIOS.md` — сценарии.
- `docs/PROJECT.md` — карточка проекта.

## Структура (план)

    web/
    ├── public/
    ├── src/
    │   ├── api/           # axios-клиент, хуки TanStack Query
    │   ├── components/    # переиспользуемые компоненты
    │   ├── pages/         # страницы (роуты)
    │   ├── stores/        # Zustand-сторы
    │   ├── theme/         # MUI-тема
    │   ├── types/         # TypeScript-типы
    │   ├── utils/         # утилиты
    │   ├── App.tsx
    │   └── main.tsx
    ├── .eslintrc.cjs
    ├── .prettierrc
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── vitest.config.ts

## Статус

🟡 Серия `feature/2.x-web` — активна.