# COMMANDS.md — команды и алиасы

> Быстрый справочник. «Что набрать, чтобы сделать X».
> Копирование: VS Code Preview (`Ctrl+Shift+V`) → иконка «Copy» на code-блоке. GitHub — так же.
> Поиск: `Ctrl+F` по слову (туннель, лог, overflow, дамп, reset).

---

<a id="navig"></a>
## 📖 Навигация

| § | Раздел |
|---|---|
| [§0](#s0) | Быстрый старт — «одна вставка = одно действие» |
| [§1](#s1) | Git |
| [§2](#s2) | Backend (Django) |
| [§3](#s3) | Web (React) |
| [§4](#s4) | Mobile (Flutter) |
| [§5](#s5) | PostgreSQL |
| [§6](#s6) | Туннель USB (adb reverse) |
| [§7](#s7) | USB ↔ WiFi |
| [§8](#s8) | Логи и ошибки |
| [§9](#s9) | Мониторинг долгих загрузок |
| [§10](#s10) | Частые проблемы |
| [§11](#s11) | Процессы и порты |
| [§12](#s12) | Резервные копии БД |
| [§13](#s13) | **Алиасы** — установка и полный список |
| [§14](#s14) | Однострочники |
| [§15](#s15) | Шпаргалка «Я хочу…» |

---

<a id="paths"></a>
## 📂 Пути

| Что | 🏢 Рабочий ПК | 🏠 Домашний ПК |
|---|---|---|
| Корень | `/d/Dev/projects/WMS-Geology` | `/c/Projert/WMS-Geology` |
| Backend | `.../backend` | `.../backend` |
| Web | `.../web` | `.../web` |
| Mobile | `.../mobile` | `.../mobile` |
| PostgreSQL | `/d/Dev/pgsql/pgsql/bin/` (портативный) | Docker |
| Данные PG | `D:/Dev/pgsql/pgdata` | volume `postgres_data` |
| Node.js | `/d/Dev/nodejs/node` | системный |
| Терминал | Git Bash (MINGW64) | UCRT64 (MSYS2) |
| Планшет ↔ backend | USB (`adb reverse`) | WiFi (`0.0.0.0`) |

[↑](#navig)

---

<a id="s0"></a>
# §0. Быстрый старт

> Один блок = один workflow. «Скопировал → вставил → готово».

<a id="s01"></a>
## 0.1. 🏢 Запустить весь стек (3 терминала)

**Терминал 1 — PostgreSQL + Backend:**
```
/d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" status || /d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" -l "D:/Dev/pgsql/pgdata/logfile.log" start
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py migrate
poetry run python manage.py runserver 127.0.0.1:8000
```

**Терминал 2 — Web:**
```
cd /d/Dev/projects/WMS-Geology/web
npm run dev
```

**Терминал 3 — Mobile (USB):**
```
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
adb reverse tcp:8000 tcp:8000
cd /d/Dev/projects/WMS-Geology/mobile
flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation
```

**Что делает.** Полный старт рабочего ПК. Все три сервиса.
*Ожидание:* во всех трёх — `Starting development server at http://127.0.0.1:8000/`, `Local: http://localhost:5173/`, APK на планшете. Терминалы **заняты**.

*Если не работает:* §10.4 (планшет не видит backend), §10.11 (порт 8000).

[↑](#navig)

<a id="s02"></a>
## 0.2. 🏠 Запустить весь стек (3 терминала)

**Терминал 1 — Docker + Backend:**
```
cd /c/Projert/WMS-Geology
docker compose up -d
docker compose ps
cd backend
poetry run python manage.py migrate
poetry run python manage.py runserver 0.0.0.0:8000
```

**Терминал 2 — Web:**
```
cd /c/Projert/WMS-Geology/web
npm run dev
```

**Терминал 3 — Mobile (WiFi):**
```
cd /c/Projert/WMS-Geology/mobile
flutter run
```
*Что делает:* то же, что 0.1, но Docker и WiFi. `probe` найдёт хост сам.
[↑](#navig)

<a id="s03"></a>
## 0.3. 🏢 Запустить только backend
```
/d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" status || /d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" -l "D:/Dev/pgsql/pgdata/logfile.log" start
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py runserver 127.0.0.1:8000
```
*Ожидание:* `Starting development server at http://127.0.0.1:8000/`.
[↑](#navig)

<a id="s04"></a>
## 0.4. 🏠 Запустить только backend
```
cd /c/Projert/WMS-Geology
docker compose up -d
cd backend
poetry run python manage.py runserver 0.0.0.0:8000
```
[↑](#navig)

<a id="s05"></a>
## 0.5. 🏢 Остановить всё
```
taskkill python.exe 2>/dev/null || echo "backend не запущен"
taskkill node.exe 2>/dev/null || echo "web не запущен"
taskkill dart.exe 2>/dev/null || echo "flutter не запущен"
/d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" stop 2>/dev/null || echo "pg уже остановлен"
```
*Что делает:* убивает все 4 сервиса. Идемпотентно.
[↑](#navig)

<a id="s06"></a>
## 0.6. 🏠 Остановить всё
```
taskkill python.exe 2>/dev/null
taskkill node.exe 2>/dev/null
taskkill dart.exe 2>/dev/null
cd /c/Projert/WMS-Geology && docker compose down
```
[↑](#navig)

<a id="s07"></a>
## 0.7. 🏢 Перезапустить backend
```
taskkill python.exe 2>/dev/null; sleep 1
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py runserver 127.0.0.1:8000
```
[↑](#navig)

<a id="s08"></a>
## 0.8. 🏠 Перезапустить backend
```
taskkill python.exe 2>/dev/null; sleep 1
cd /c/Projert/WMS-Geology/backend
poetry run python manage.py runserver 0.0.0.0:8000
```
[↑](#navig)

<a id="s09"></a>
## 0.9. 🏢 Полный device-check захода
```
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
cd /d/Dev/projects/WMS-Geology/mobile
flutter analyze || { echo "❌ ANALYZE FAILED"; exit 1; }
flutter test || { echo "❌ TESTS FAILED"; exit 1; }
echo "✅ Analyze + tests OK"
cd ..
adb shell pm clear com.example.wms_geology_mobile
adb reverse tcp:8000 tcp:8000
cd mobile
flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation
```
*Что делает:* analyze → test → сброс данных → rebuild → запуск. Всё подряд.
*Ожидание:* `No issues found!` → `+222: All tests passed!` → APK на планшете.
*Если упало на analyze/test* — выйдет раньше, не запустит APK.

[↑](#navig)

<a id="s010"></a>
## 0.10. 🏢 Полный reset (чистый старт)
```
adb shell pm clear com.example.wms_geology_mobile
cd /d/Dev/projects/WMS-Geology/mobile
flutter clean
flutter pub get
adb kill-server && adb start-server
adb reverse tcp:8000 tcp:8000
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation
```
**⚠ Потеряешь:** данные приложения (SQLite, очередь, токен). Серверные данные — останутся.
*Ожидание:* 2–3 мин → APK на планшете → **войти заново**.

[↑](#navig)

<a id="s011"></a>
## 0.11. 🏢 Проверка «всё работает?»
```
echo "=== PG ==="
/d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" status 2>&1 | head -3
echo "=== health ==="
curl -s -m 3 http://127.0.0.1:8000/health/ || echo "❌ backend не отвечает"
echo "=== port 8000 ==="
netstat -ano | grep ":8000" | head -3 || echo "порт 8000 пуст"
echo "=== adb ==="
adb devices
adb reverse --list
```
*Ожидание:* 4 блока с результатами. Пусто/ошибка — см. §10.4.
[↑](#navig)

<a id="s012"></a>
## 0.12. 🏠 Проверка «всё работает?»
```
echo "=== Docker ==="
cd /c/Projert/WMS-Geology && docker compose ps
echo "=== health ==="
curl -s -m 3 http://127.0.0.1:8000/health/ || echo "❌ backend не отвечает"
echo "=== port 8000 ==="
netstat -ano | findstr :8000 || echo "порт 8000 пуст"
echo "=== adb ==="
adb devices
```
[↑](#navig)

<a id="s013"></a>
## 0.13. 🏢 Переключить на WiFi (с USB)
```
adb reverse --remove-all
taskkill python.exe 2>/dev/null; sleep 1
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py runserver 0.0.0.0:8000
# второй терминал:
cd /d/Dev/projects/WMS-Geology/mobile
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
flutter run --android-skip-build-dependency-validation
```
*Ожидание:* backend доступен с планшета по `http://<IP-ПК>:8000/health/`.
[↑](#navig)

<a id="s014"></a>
## 0.14. 🏢 Переключить на USB (с WiFi)
```
taskkill python.exe 2>/dev/null; sleep 1
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py runserver 127.0.0.1:8000
# второй терминал:
adb reverse tcp:8000 tcp:8000
cd /d/Dev/projects/WMS-Geology/mobile
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation
```
[↑](#navig)

---

<a id="s1"></a>
# §1. Git

<a id="s11"></a>
## 1.1. Статус

```
cd /d/Dev/projects/WMS-Geology
git status --short
```
*Что внутри:* показывает изменённые/новые файлы.
*Ожидание:* список `M path` или пусто (если ничего не менял).
*Когда:* перед `git add`, перед закрытием захода.

[↑](#navig)

<a id="s12"></a>
## 1.2. Проверка mobile/lib (правило 1.90/1.91)

```
cd /d/Dev/projects/WMS-Geology
git status --short | grep "mobile/lib"
```
*Зачем:* §1.90 — перед `git add`, §1.91 — перед выдачей нового захода.
*Ожидание:* пусто (перед стартом) или ровный список твоих файлов.

[↑](#navig)

<a id="s13"></a>
## 1.3. Текущая ветка + последние коммиты

```
cd /d/Dev/projects/WMS-Geology
git branch --show-current
git log --oneline -5
```
*Ожидание:* `fix/2.x-mobile-bundle-c-2` + 5 строк вида `abc1234 описание`.

[↑](#navig)

<a id="s14"></a>
## 1.4. Создать ветку пачки

```
cd /d/Dev/projects/WMS-Geology
git checkout feature/X.Y-xxx
git pull
git checkout -b fix/X.Y-bundle
git push -u origin fix/X.Y-bundle
```
*Зачем:* для **новой** короткой пачки. Для долгоживущей `fix/2.x-mobile-bundle-c-2` — не нужно, работать в ней.

[↑](#navig)

<a id="s15"></a>
## 1.5. Коммит с явными файлами (рабочий ПК — обязательно)

```
cd /d/Dev/projects/WMS-Geology
git add path/to/file1.dart path/to/file2.dart
git commit -m "3.x-offline-<заход> — что сделано"
git push origin fix/2.x-mobile-bundle-c-2
```
**⚠ На рабочем ПК — НИКОГДА `git add .`** (п.15 — попадут `mobile/android/*`).
*Ожидание:* `[fix/2.x-mobile-bundle-c-2 abc1234] ...` + push без ошибок.

[↑](#navig)

<a id="s16"></a>
## 1.6. Откатить машинные файлы

```
cd /d/Dev/projects/WMS-Geology
git checkout -- mobile/android/
git status --short | grep "mobile/android"
```
*Зачем:* после каждой сборки на рабочем ПК — `mobile/android/gradle.properties` меняется (maven-local, aapt2), не должно попасть в коммит.
*Ожидание:* пусто.

[↑](#navig)

<a id="s17"></a>
## 1.7. Diff перед коммитом

```
cd /d/Dev/projects/WMS-Geology
git diff --stat
git diff path/to/file.dart
```
*Ожидание:* список файлов + их diff.

[↑](#navig)

<a id="s18"></a>
## 1.8. Не запушено

```
cd /d/Dev/projects/WMS-Geology
git log origin/fix/2.x-mobile-bundle-c-2..HEAD --oneline
```
*Ожидание:* список коммитов, которые есть локально, но нет на origin. Пусто — всё запушено.

[↑](#navig)

<a id="s19"></a>
## 1.9. Закрыть пачку (merge + delete)

```
cd /d/Dev/projects/WMS-Geology
git checkout feature/X.Y-xxx
git pull
git merge --no-ff fix/X.Y-bundle -m "Merge fix/X.Y-bundle"
git push
git branch -d fix/X.Y-bundle
git push origin --delete fix/X.Y-bundle
```
**Только после «норм»** (RULES §8).
*Ожидание:* merge успешен, ветка удалена локально и на origin.

[↑](#navig)

<a id="s110"></a>
## 1.10. Отменить коммит (soft)

```
cd /d/Dev/projects/WMS-Geology
git reset --soft HEAD~1
```
*Что внутри:* убирает последний коммит, файлы остаются в staging.
*Зачем:* закоммитил не то, надо поправить сообщение или добавить файлы.

[↑](#navig)

<a id="s111"></a>
## 1.11. Отменить коммит (hard)

```
cd /d/Dev/projects/WMS-Geology
git reset --hard HEAD~1
```
**⚠ Необратимо.** Файлы потеряны.

[↑](#navig)

<a id="s112"></a>
## 1.12. Откат кода к origin

```
cd /d/Dev/projects/WMS-Geology
git fetch origin
git stash push -m "wip перед откатом" 2>/dev/null || true
git reset --hard origin/fix/2.x-mobile-bundle-c-2
git status --short
# восстановить: git stash pop
```
**⚠ Потеряешь незакоммиченные правки.** `git stash` — страховка.
*Зачем:* локальные эксперименты сломали код, надо «как на сервере».

[↑](#navig)

---

<a id="s2"></a>
# §2. Backend

<a id="s21"></a>
## 2.1. Установка зависимостей

```
cd /d/Dev/projects/WMS-Geology/backend
poetry install
```
*Зачем:* после `git pull`, если изменился `pyproject.toml`.
*Ожидание:* `Installing dependencies from lock file...` → готово.

[↑](#navig)

<a id="s22"></a>
## 2.2. Миграции

```
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py makemigrations
poetry run python manage.py migrate
```
*Ожидание:* `No changes detected` (если моделей не менял) + `Operations to perform: ...`.

[↑](#navig)

<a id="s23"></a>
## 2.3. Проверка миграций (перед коммитом)

```
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py makemigrations --check --dry-run
```
*Ожидание:* `No changes detected`. Если не так — модель изменена без миграции.

[↑](#navig)

<a id="s24"></a>
## 2.4. Сервер — 🏠 ДОМАШНИЙ (WiFi)

```
cd /c/Projert/WMS-Geology/backend
poetry run python manage.py runserver 0.0.0.0:8000
```
*Что внутри:* `0.0.0.0` — слушать все интерфейсы, доступ по IP.
*Ожидание:* `Starting development server at http://0.0.0.0:8000/`. Терминал **занят**.

[↑](#navig)

<a id="s25"></a>
## 2.5. Сервер — 🏢 РАБОЧИЙ (USB)

```
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py runserver 127.0.0.1:8000
```
*Что внутри:* `127.0.0.1` — только localhost, доступ через `adb reverse`.
*Ожидание:* `Starting development server at http://127.0.0.1:8000/`.

[↑](#navig)

<a id="s26"></a>
## 2.6. Тесты

```
cd /d/Dev/projects/WMS-Geology/backend
poetry run pytest -q
```
*Ожидание:* `842 passed in X.XXs`.
*Если упало:* `poetry run pytest -v apps/<app>/tests/test_<file>.py` — один файл.

[↑](#navig)

<a id="s27"></a>
## 2.7. Seeds

```
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py seed_roles
poetry run python manage.py seed_catalogs
poetry run python manage.py seed_container_comments
```
*Зачем:* на чистой БД — заполнить роли и справочники.

[↑](#navig)

<a id="s28"></a>
## 2.8. Django check

```
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py check
```
*Ожидание:* `System check identified no issues (0 silenced).`

[↑](#navig)

<a id="s29"></a>
## 2.9. Django shell

```
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py shell
```
**⚠ MSYS2:** `-c "..."` ломается. Запускать интерактивно.

[↑](#navig)

---

<a id="s3"></a>
# §3. Web

<a id="s31"></a>
## 3.1. Установка

```
cd /d/Dev/projects/WMS-Geology/web
npm install
```
*Ожидание:* `added N packages in Xs`.

[↑](#navig)

<a id="s32"></a>
## 3.2. Dev-сервер

```
cd /d/Dev/projects/WMS-Geology/web
npm run dev
```
*Ожидание:* `Local: http://localhost:5173/`. Proxy `/api/*` → `:8000`.

[↑](#navig)

<a id="s33"></a>
## 3.3. Production

```
cd /d/Dev/projects/WMS-Geology/web
npm run build
```
*Ожидание:* `dist/` создан, `built in Xs`.

[↑](#navig)

<a id="s34"></a>
## 3.4. Тесты

```
cd /d/Dev/projects/WMS-Geology/web
npm test
```
*Ожидание:* `24 passed`.

[↑](#navig)

<a id="s35"></a>
## 3.5. Линт + формат

```
cd /d/Dev/projects/WMS-Geology/web
npm run lint
npm run format
```
*Ожидание:* 0 warnings в lint, файлы отформатированы.

[↑](#navig)

---

<a id="s4"></a>
# §4. Mobile

<a id="s41"></a>
## 4.1. Зависимости

```
cd /d/Dev/projects/WMS-Geology/mobile
flutter pub get
```
*Ожидание:* `Got dependencies!`.

[↑](#navig)

<a id="s42"></a>
## 4.2. Запуск — 🏢 РАБОЧИЙ ПК (USB)

```
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
adb reverse tcp:8000 tcp:8000
cd /d/Dev/projects/WMS-Geology/mobile
flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation
```
*Ожидание:* APK на планшете. Терминал **занят** (это `flutter run` в foreground).
*Если падает на aapt2:* §10.6.

[↑](#navig)

<a id="s43"></a>
## 4.3. Запуск — 🏠 ДОМАШНИЙ (WiFi)

```
cd /c/Projert/WMS-Geology/mobile
flutter run
```
*Ожидание:* APK запускается, `probe` сам находит хост.

[↑](#navig)

<a id="s44"></a>
## 4.4. Полная пересборка (⚠ APK не пересобирается от analyze/test)

```
cd /d/Dev/projects/WMS-Geology/mobile
flutter clean
flutter pub get
cd ..
adb reverse tcp:8000 tcp:8000
cd mobile
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation
```
**⚠ `flutter analyze` / `flutter test` НЕ пересобирают APK.** После правок в коде — `flutter run` (правило 21).
*Ожидание:* 2–3 мин → APK с новым кодом.

[↑](#navig)

<a id="s45"></a>
## 4.5. Тесты

```
cd /d/Dev/projects/WMS-Geology/mobile
flutter analyze
flutter test
```
*Ожидание:* `No issues found!` + `+222: All tests passed!`.
*Один файл:* `flutter test test/services/sync_pusher_test.dart`.

[↑](#navig)

<a id="s46"></a>
## 4.6. Лог `flutter run` в файл

```
cd /d/Dev/projects/WMS-Geology/mobile
flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation 2>&1 | tee /tmp/flutter.log
```
*Зачем:* не терять лог при скролле. Для отправки ИИ.

[↑](#navig)

<a id="s47"></a>
## 4.7. Список устройств

```
flutter devices
```
*Ожидание:* `Active 8 Pro • xxxxxx • android-arm64 • Android ...`

[↑](#navig)

<a id="s48"></a>
## 4.8. Diagnostics

```
flutter doctor -v
```
*Зачем:* что сломалось в Flutter/Android SDK окружении.

[↑](#navig)

<a id="s49"></a>
## 4.9. Очистить данные приложения

```
adb shell pm clear com.example.wms_geology_mobile
```
**⚠ После `pm clear`** — войти заново.
*Ожидание:* `Success`.

[↑](#navig)

<a id="s410"></a>
## 4.10. Удалить только SQLite (debug-сборка)

```
adb shell run-as com.example.wms_geology_mobile rm databases/wms_geology.db
```
*Зачем:* стереть только БД, сохранить токен (не надо логиниться).

[↑](#navig)

---

<a id="s5"></a>
# §5. PostgreSQL

<a id="s51"></a>
## 5.1. 🏠 Docker

```
cd /c/Projert/WMS-Geology
docker compose up -d
docker compose ps
docker compose logs -f postgres
docker compose down
docker compose down -v          # ⚠ удалить данные
```
*Ожидание:* `[+] Running 1/1` + строка с `wms-geology-postgres ... Up`.

[↑](#navig)

<a id="s52"></a>
## 5.2. 🏢 Портативный

```
/d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" -l "D:/Dev/pgsql/pgdata/logfile.log" start
/d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" status
/d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" stop
```
*Ожидание:* `server starting` / `server is running (PID: NNN)` / `server stopped`.

[↑](#navig)

<a id="s53"></a>
## 5.3. Проверка соединения

```
psql -h localhost -U wms_user -d wms_geology -c "SELECT 1;"
```
Пароль `wms_password`.
*Ожидание:* таблица `?column?` со значением `1`.

[↑](#navig)

<a id="s54"></a>
## 5.4. Лог PostgreSQL (🏢)

```
tail -f "D:/Dev/pgsql/pgdata/logfile.log"
```
*Ожидание:* поток строк. `Ctrl+C` — стоп.

[↑](#navig)

<a id="s55"></a>
## 5.5. Лог PostgreSQL (🏠 Docker)

```
cd /c/Projert/WMS-Geology
docker compose logs -f postgres
```

[↑](#navig)

---

<a id="s6"></a>
# §6. Туннель USB (adb reverse)

> Открывает порт ПК планшету по проводу. Без него `--dart-define=API_HOST=127.0.0.1` не достучится до backend.

<a id="s61"></a>
## 6.1. Включить туннель

```
adb reverse tcp:8000 tcp:8000
```
*Что внутри:* «порт 8000 планшета» → «порт 8000 ПК».
*Ожидание:* пусто (успех). Проверка — `adb reverse --list` → `host-XX tcp:8000 tcp:8000`.
*Проверить с планшета:* браузер → `http://127.0.0.1:8000/health/` → `{"status":"ok",...}`.

[↑](#navig)

<a id="s62"></a>
## 6.2. Выключить конкретный порт

```
adb reverse --remove tcp:8000
```

[↑](#navig)

<a id="s63"></a>
## 6.3. Выключить все туннели

```
adb reverse --remove-all
```
*Зачем:* переключение на WiFi.

[↑](#navig)

<a id="s64"></a>
## 6.4. Статус

```
adb reverse --list
```
*Ожидание:* `host-XX tcp:8000 tcp:8000` (есть) или пусто (нет).

[↑](#navig)

<a id="s65"></a>
## 6.5. Сброс adb (если туннель не работает)

```
adb kill-server
adb start-server
adb devices
adb reverse tcp:8000 tcp:8000
```
**⚠ Туннель сбрасывается:** reconnect USB, `kill-server`/`start-server`, перезагрузка планшета, перезагрузка ПК.
**Правило:** перед каждым `flutter run` на рабочем ПК — `adb reverse` заново.

[↑](#navig)

<a id="s66"></a>
## 6.6. Ошибки

**`more than one device/emulator`** — несколько устройств:
```
adb devices
adb -s <serialNumber> reverse tcp:8000 tcp:8000
```
**`device 'xxx' not found`** — планшет отключён:
```
adb devices
adb kill-server && adb start-server && adb devices
```
**reverse есть, но планшет не достучится:**
```
curl http://127.0.0.1:8000/health/
adb reverse --remove-all && adb reverse tcp:8000 tcp:8000
```

[↑](#navig)

---

<a id="s7"></a>
# §7. USB ↔ WiFi

<a id="s71"></a>
## 7.1. USB → WiFi (🏢)

```
adb reverse --remove-all
taskkill python.exe 2>/dev/null; sleep 1
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py runserver 0.0.0.0:8000
# второй терминал:
cd /d/Dev/projects/WMS-Geology/mobile
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
flutter run --android-skip-build-dependency-validation
```
*Ожидание:* backend доступен с планшета по `http://<IP-ПК>:8000/health/`.

[↑](#navig)

<a id="s72"></a>
## 7.2. WiFi → USB (🏢)

```
taskkill python.exe 2>/dev/null; sleep 1
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py runserver 127.0.0.1:8000
# второй терминал:
adb reverse tcp:8000 tcp:8000
cd /d/Dev/projects/WMS-Geology/mobile
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation
```

[↑](#navig)

<a id="s73"></a>
## 7.3. Проверить WiFi с планшета

Открыть в браузере на планшете: `http://192.168.0.77:8000/health/`
IP домашнего ПК. Свой IP — §11.4.
*Ожидание:* `{"status":"ok",...}`.

[↑](#navig)

---

<a id="s8"></a>
# §8. Логи и ошибки

<a id="s81"></a>
## 8.1. Flutter — ошибки в `flutter run`

```
cd /d/Dev/projects/WMS-Geology/mobile
flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation 2>&1 | tee /tmp/flutter.log
```
*Зачем:* в терминале видно `debugPrint`, `RenderFlex overflowed`, `Unhandled Exception`, Dio-ошибки.
*Только ошибки:* `... | grep -iE "error|exception|failed|overflow"`.
*Verbose (для сборки):* `flutter run --verbose ...`.

[↑](#navig)

<a id="s82"></a>
## 8.2. Android — `adb logcat`

**Только наши теги** (`[push]`, `[c-2d-2]`, `[c-8b]`, `[c-8-catalog]`):
```
adb logcat -c
adb logcat | grep -iE "flutter|push|c-2d-2|c-8b|c-8-catalog"
```
*Ожидание:* живой поток. `Ctrl+C` — стоп.
*Только Flutter:* `adb logcat -s flutter`.
*Только Error:* `adb logcat *:E`.

[↑](#navig)

<a id="s83"></a>
## 8.3. SyncScreen — ошибки очереди

1. Drawer → Синхронизация.
2. «С ошибками: N» → тап по записи — `endpoint` + `error_message`.

*Лог в `adb logcat`:* `[push] /sites/ failed: ApiException(400): ...`.

[↑](#navig)

<a id="s84"></a>
## 8.4. Backend — Django

- В терминале `runserver`: `Internal Server Error: /api/v1/...` + traceback.
- `poetry run python manage.py check` — система.
- `poetry run pytest -q` — тесты.
- `poetry run python manage.py makemigrations --check --dry-run` — миграции.

[↑](#navig)

<a id="s85"></a>
## 8.5. Web — браузер

DevTools (F12):
- **Console** — JS-ошибки, `console.error`.
- **Network** — HTTP-статусы. Красный — ошибка.
- 500 от backend → §8.4.
- CORS → `django-cors-headers` (ТД-13).

[↑](#navig)

<a id="s86"></a>
## 8.6. Gradle / сборка

**`Could not download aapt2-...-windows.jar`** (прокси):
```
# В mobile/android/gradle.properties И ~/.gradle/gradle.properties:
android.aapt2FromMavenOverride=D:/Dev/android-sdk/build-tools/36.0.0/aapt2.exe
```
После `git reset --hard` — `setup.ps1` восстанавливает.

**Полный лог сборки:**
```
cd /d/Dev/projects/WMS-Geology/mobile
flutter build apk --verbose 2>&1 | tee /tmp/build.log
```

[↑](#navig)

<a id="s87"></a>
## 8.7. Куда смотреть

| Что | Куда |
|---|---|
| `debugPrint` | консоль `flutter run` / `adb logcat -s flutter` |
| Overflow | `flutter run \| grep -i "overflowed"` |
| Dio / ApiException | консоль `flutter run`, `[push] ... failed:` |
| Django 500 | терминал `runserver` |
| pytest | §2.6 |
| Браузер JS | DevTools Console |
| Gradle | `flutter run --verbose \| tee /tmp/build.log` |

[↑](#navig)

---

<a id="s9"></a>
# §9. Мониторинг долгих загрузок

> Правило 14: >50 МБ через прокси — только с монитором.

<a id="s91"></a>
## 9.1. PowerShell — `.gradle/caches`

```powershell
$path = "$env:USERPROFILE\.gradle\caches"
$prev = 0; $stuck = 0
while ($true) {
  $size = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  $delta = $size - $prev
  Write-Host ("{0:HH:mm:ss}  {1} MB  (+{2} MB)" -f (Get-Date), [math]::Round($size/1MB,1), [math]::Round($delta/1MB,1))
  if ($delta -eq 0) { $stuck++ } else { $stuck = 0 }
  if ($stuck -ge 6) { Write-Host "ЗАСТРЯЛО" -ForegroundColor Red }
  Start-Sleep 30
  $prev = $size
}
```
Ctrl+C — стоп.

[↑](#navig)

<a id="s92"></a>
## 9.2. Другие пути
- `$env:USERPROFILE\.pub-cache` — Flutter
- `<путь проекта>\web\node_modules` — Web
- `$env:LOCALAPPDATA\pypoetry\Cache` — Poetry

[↑](#navig)

---

<a id="s10"></a>
# §10. Частые проблемы

<a id="s101"></a>
## 10.1. `cd mobile: No such file or directory`
→ Не в корне. `cd /d/Dev/projects/WMS-Geology` (🏢) / `cd /c/Projert/WMS-Geology` (🏠), `pwd`.

<a id="s102"></a>
## 10.2. `adb: no devices/emulators found`
→ `adb kill-server && adb start-server && adb devices`.
→ `unauthorized` — на планшете: Настройки → Для разработчиков → Отладка по USB → Разрешить.

<a id="s103"></a>
## 10.3. `adb reverse` не работает
→ §6.5. Сбрасывается при reconnect/kill-server/reboot. Перед каждым `flutter run` — заново.

<a id="s104"></a>
## 10.4. Планшет не достучится до backend (USB)
→ §2.5 (backend `127.0.0.1:8000`).
→ §6.1 (`adb reverse`).
→ §4.2 (APK с `--dart-define=API_HOST=127.0.0.1`).

<a id="s105"></a>
## 10.5. Планшет не достучится до backend (WiFi)
→ §2.4 (`0.0.0.0:8000`).
→ Планшет в той же сети? `http://192.168.0.77:8000/health/` из браузера.
→ Firewall Windows — разрешить Python.

<a id="s106"></a>
## 10.6. `flutter run` падает на `aapt2`
→ §8.6. `android.aapt2FromMavenOverride` в двух файлах.
→ После `git reset --hard` — `setup.ps1`.

<a id="s107"></a>
## 10.7. Изменения в коде не видны на планшете
→ APK старая. `analyze`/`test` **не пересобирают APK** (правило 21).
→ §4.4.

<a id="s108"></a>
## 10.8. Тесты зелёные, а device-check падает
→ Та же причина — старая APK. §4.4.

<a id="s109"></a>
## 10.9. Приложение «зависло» с офлайн-очередью
```
adb logcat -c
adb logcat | grep -iE "push|c-8-catalog|bulk-create"
```
→ Drawer → Синхронизация → Push. Если не помогает — §4.9 `pm clear` (**⚠ потеряешь офлайн**).

<a id="s1010"></a>
## 10.10. Тара не появилась после Push
→ Причина: `bulk-create` упал с `draft_site_id: -1000` (маппинг не сработал).
```
adb logcat -c
adb logcat | grep -iE "push|c-8-catalog"
```
→ Если `[push] /storage/containers/bulk-create/ failed: ... Участок -1000 не найден` — APK старая → §4.4.
→ Если `[c-8-catalog-create-offline] site: -1000 → 100` **есть**, а bulk-create всё равно упал — пришли лог.

<a id="s1011"></a>
## 10.11. Порт 8000 занят
```
netstat -ano | grep ":8000"
taskkill //F //PID <pid>
taskkill python.exe
```

<a id="s1012"></a>
## 10.12. `more than one device/emulator`
```
adb devices
adb -s <serialNumber> reverse tcp:8000 tcp:8000
```

<a id="s1013"></a>
## 10.13. Жёлто-чёрная полоса (overflow)
```
cd /d/Dev/projects/WMS-Geology/mobile
flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation 2>&1 | grep -i "overflowed"
```
→ Выведет `... file.dart:LINE:COL`. Обернуть в `Expanded`/`Flexible`/`Wrap`/`SingleChildScrollView`/`maxLines:1`+`ellipsis`.

<a id="s1014"></a>
## 10.14. Приложение падает при старте
```
adb logcat -c && adb logcat *:E
cd /d/Dev/projects/WMS-Geology/mobile
flutter run --verbose --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation
```

<a id="s1015"></a>
## 10.15. `DioException [connection error]`
```
curl http://127.0.0.1:8000/health/
adb reverse tcp:8000 tcp:8000
```

<a id="s1016"></a>
## 10.16. `flutter pub get` висит / падает
```
cd /d/Dev/projects/WMS-Geology/mobile
flutter pub cache repair
flutter pub get
```

<a id="s1017"></a>
## 10.17. `flutter analyze` ругается на «hide Container»
→ Добавить `import 'package:flutter/material.dart' hide Container;` в файл.

<a id="s1018"></a>
## 10.18. `git status` показывает `mobile/android/*`
→ §1.6 (`git checkout -- mobile/android/`).

<a id="s1019"></a>
## 10.19. `NDK source.properties` / BOM
→ `setup.ps1` (перезаписывает без BOM).

<a id="s1020"></a>
## 10.20. Сборка APK висит
→ §9 (монитор). `Ctrl+C` → `flutter clean` → `setup.ps1` → снова.

[↑](#navig)

---

<a id="s11"></a>
# §11. Процессы и порты

<a id="s1111"></a>
## 11.1. Кто на порту 8000
```
netstat -ano | grep ":8000"          # Git Bash
netstat -ano | findstr :8000         # PowerShell
```
*Ожидание:* `TCP 127.0.0.1:8000 ... LISTENING <PID>`.

<a id="s1112"></a>
## 11.2. Убить по PID
```
taskkill //F //PID <pid>
```

<a id="s1113"></a>
## 11.3. Убить по имени
```
taskkill python.exe
taskkill node.exe
taskkill dart.exe
taskkill java.exe
taskkill adb.exe
```
*Ожидание:* `SUCCESS: ... terminated`.

<a id="s1114"></a>
## 11.4. Свой IP
```
ipconfig | findstr IPv4                              # PowerShell
ipconfig | iconv -f CP866 -t UTF-8 | grep -a "IPv4"  # Git Bash
```

<a id="s1115"></a>
## 11.5. Все слушающие порты
```
netstat -ano | grep LISTENING | head -20
```

[↑](#navig)

---

<a id="s12"></a>
# §12. Резервные копии БД

<a id="s121"></a>
## 12.1. 🏢 Дамп портативного PG
```
/d/Dev/pgsql/pgsql/bin/pg_dump.exe -h localhost -U wms_user -d wms_geology -F c -f "D:/Dev/pgsql/backup_$(date +%Y-%m-%d_%H-%M).dump"
```
**Восстановить:**
```
/d/Dev/pgsql/pgsql/bin/pg_restore.exe -h localhost -U wms_user -d wms_geology -c "D:/Dev/pgsql/backup_YYYY-MM-DD_HH-MM.dump"
```
Пароль `wms_password`.

<a id="s122"></a>
## 12.2. 🏠 Дамп из Docker
```
cd /c/Projert/WMS-Geology
docker compose exec postgres pg_dump -U wms_user -d wms_geology -F c > backup_$(date +%Y-%m-%d_%H-%M).dump
```

<a id="s123"></a>
## 12.3. Сброс БД в тестовое состояние (⚠ потеряешь всё)
```
cd /d/Dev/projects/WMS-Geology/backend
poetry run python manage.py flush --noinput
poetry run python manage.py migrate
poetry run python manage.py seed_roles
poetry run python manage.py seed_catalogs
poetry run python manage.py seed_container_comments
```

[↑](#navig)

---

<a id="s13"></a>
# §13. Алиасы

<a id="s131"></a>
## 13.1. Как установить

**Шаг 1.** Открыть `~/.bashrc`:
```
code ~/.bashrc
```
Если `code: command not found` — §13.5 или `notepad ~/.bashrc`.
*Ожидание:* файл открылся.

**Шаг 2.** Вставить блок §13.2 (🏢) или §13.3 (🏠) — целиком, в конец.

**Шаг 3.** Проверить синтаксис:
```
bash -n ~/.bashrc && echo "✅ ок" || echo "❌ битый"
```
*Ожидание:* `✅ ок`.

**Шаг 4.** Применить:
```
source ~/.bashrc
```

**Шаг 5.** Проверить:
```
type wms-start-be
```
*Ожидание:* `wms-start-be is aliased to '...'`.

[↑](#navig)

<a id="s132"></a>
## 13.2. 🏢 РАБОЧИЙ ПК — полный список

> **Что такое алиас.** Сокращение. Пишешь `wms-start-be` — bash делает длинную команду.

### 📁 Навигация

**`wmsroot`** — в корень проекта
```
wmsroot
```
*Что внутри:* `cd /d/Dev/projects/WMS-Geology`.
*Ожидание:* `pwd` → `/d/Dev/projects/WMS-Geology`.

**`wmsbe`** — в `backend/`
```
wmsbe
```

**`wmsweb`** — в `web/`
```
wmsweb
```

**`wmsmob`** — в `mobile/`
```
wmsmob
```

---

### 🚀 MASTER

**`wms-start-be`** — backend целиком (PG + migrate + server)
```
wms-start-be
```
*Что внутри:*
1. Проверяет PG, если не запущен — стартует.
2. `cd backend`.
3. `migrate`.
4. `runserver 127.0.0.1:8000`.

*Зачем:* первый запуск после перезагрузки, после `git pull` с миграциями.
*Ожидание:* `Starting development server at http://127.0.0.1:8000/`. Терминал занят.
*Если не работает:* `pg_ctl: ...` → Docker занял порт (`wmsdbstop`), или `Address already in use` → `wmsport` + `taskkill //F //PID <pid>`.

**`wms-start-web`** — Vite dev
```
wms-start-web
```
*Ожидание:* `Local: http://localhost:5173/`.

**`wms-start-mobile`** — APK на планшете (USB)
```
wms-start-mobile
```
*Что внутри:* `export FLUTTER_STORAGE_BASE_URL` → `adb reverse` → `flutter run --dart-define=API_HOST=127.0.0.1`.
*Ожидание:* APK на планшете. Терминал **занят**.
*Если не работает:* `aapt2` — §8.6. `Connection refused` — `wms-check`.

**`wms-stop`** — остановить всё
```
wms-stop
```
*Что внутри:* `taskkill` python/node/dart + `pg_ctl stop`.
*Ожидание:* `WMS остановлен`.

**`wms-restart-be`** — перезапуск backend
```
wms-restart-be
```
*Ожидание:* новый `Starting development server`.

**`wms-devcheck`** — analyze + test
```
wms-devcheck
```
*Ожидание:* `No issues found!` + `+222: All tests passed!`.

**`wms-reset`** — сброс планшета + rebuild
```
wms-reset
```
*Что внутри:* `pm clear` → `flutter clean` → `pub get` → `adb reset`.
**⚠ После — войти заново** (`wms-start-mobile`).
*Ожидание:* 2–3 мин, планшет виден, reverse создан.

**`wms-check`** — проверка стека
```
wms-check
```
*Ожидание:* 4 блока: PG / health / port / adb. Пусто/ошибка — §10.4.

**`wms-switch-wifi`** — backend на `0.0.0.0:8000`
```
wms-switch-wifi
```
*Зачем:* USB → WiFi. Backend слушает все интерфейсы.

**`wms-switch-usb`** — backend на `127.0.0.1:8000`
```
wms-switch-usb
```
*Зачем:* WiFi → USB. После — `adbreverse`.

**`wms-full-start`** — синоним `wms-start-mobile`
```
wms-full-start
```

---

### 🐘 PostgreSQL (портативный)

**`pgstart`** — запустить
```
pgstart
```
*Ожидание:* `server starting`.

**`pgstop`** — остановить
```
pgstop
```
*Ожидание:* `server stopped`.

**`pgstatus`** — статус
```
pgstatus
```
*Ожидание:* `server is running (PID: NNN)` или `no server running`.

---

### 📱 adb

**`adbreset`** — сброс adb + reverse
```
adbreset
```
*Ожидание:* `xxx device` + `host-XX tcp:8000`.
*Если `unauthorized`* — на планшете разрешить отладку.

**`adbreverse`** — включить туннель
```
adbreverse
```
*Ожидание:* пусто (успех). Проверка — `adbreverselist`.

**`adbreverseoff`** — выключить все
```
adbreverseoff
```

**`adbreverselist`** — статус
```
adbreverselist
```
*Ожидание:* `host-XX tcp:8000` или пусто.

**`adbdevices`** — устройства
```
adbdevices
```
*Ожидание:* `xxx device`.

---

### 🔍 Диагностика

**`wmshealth`** — `/health/`
```
wmshealth
```
*Ожидание:* `{"status":"ok",...}`.
*Если пусто:* backend не запущен → `wms-start-be`.

**`wmsport`** — кто на 8000
```
wmsport
```
*Ожидание:* `TCP 127.0.0.1:8000 ... LISTENING <PID>`.

**`wmslogs`** — Android-логи (наши `debugPrint`)
```
wmslogs
```
*Что внутри:* `adb logcat -c` → `adb logcat | grep -iE "flutter|push|c-2d-2|c-8b|c-8-catalog"`.
*Зачем:* главный инструмент отладки. При Push — `[push] /sites/ failed: ...`.
*Ожидание:* живой поток. `Ctrl+C` — стоп.

**`wmsclear`** — стереть данные приложения
```
wmsclear
```
**⚠ Потеряешь офлайн-данные.** Серверные — останутся.
*Ожидание:* `Success`, приложение → на логин.

---

### 🛠 Утилиты

**`taskkill`** — убить процесс
```
taskkill dart.exe
taskkill python.exe
taskkill java.exe
taskkill node.exe
taskkill adb.exe
```
*Зачем:* в Git Bash нет `pkill`. Обёртка над Windows `taskkill //F //IM`.
*Ожидание:* `SUCCESS: ... terminated`.

---

### Полный блок для `~/.bashrc`

```
# --- Базовые: навигация ---
alias wmsroot='cd /d/Dev/projects/WMS-Geology'
alias wmsbe='cd /d/Dev/projects/WMS-Geology/backend'
alias wmsweb='cd /d/Dev/projects/WMS-Geology/web'
alias wmsmob='cd /d/Dev/projects/WMS-Geology/mobile'

# --- MASTER ---
alias wms-start-be='( /d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" status > /dev/null 2>&1 || /d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" -l "D:/Dev/pgsql/pgdata/logfile.log" start ) && cd /d/Dev/projects/WMS-Geology/backend && poetry run python manage.py migrate && poetry run python manage.py runserver 127.0.0.1:8000'
alias wms-start-web='cd /d/Dev/projects/WMS-Geology/web && npm run dev'
alias wms-start-mobile='export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn && adb reverse tcp:8000 tcp:8000 && cd /d/Dev/projects/WMS-Geology/mobile && flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation'
alias wms-stop='taskkill python.exe 2>/dev/null; taskkill node.exe 2>/dev/null; taskkill dart.exe 2>/dev/null; /d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" stop 2>/dev/null; echo "WMS остановлен"'
alias wms-restart-be='taskkill python.exe 2>/dev/null; sleep 1; cd /d/Dev/projects/WMS-Geology/backend && poetry run python manage.py runserver 127.0.0.1:8000'
alias wms-devcheck='export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn && cd /d/Dev/projects/WMS-Geology/mobile && flutter analyze && flutter test'
alias wms-reset='adb shell pm clear com.example.wms_geology_mobile && cd /d/Dev/projects/WMS-Geology/mobile && flutter clean && flutter pub get && adb kill-server && adb start-server && adb devices && adb reverse tcp:8000 tcp:8000'
alias wms-check='echo "=== PG ===" && /d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" status 2>&1 | head -3 && echo "=== health ===" && curl -s -m 3 http://127.0.0.1:8000/health/ && echo "" && echo "=== port 8000 ===" && netstat -ano | grep ":8000" | head -3 && echo "=== adb ===" && adb devices && adb reverse --list'
alias wms-switch-wifi='adb reverse --remove-all && taskkill python.exe 2>/dev/null; cd /d/Dev/projects/WMS-Geology/backend && poetry run python manage.py runserver 0.0.0.0:8000'
alias wms-switch-usb='taskkill python.exe 2>/dev/null; cd /d/Dev/projects/WMS-Geology/backend && poetry run python manage.py runserver 127.0.0.1:8000'
alias wms-full-start='export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn && adb reverse tcp:8000 tcp:8000 && cd /d/Dev/projects/WMS-Geology/mobile && flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation'

# --- PostgreSQL ---
alias pgstart='/d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" -l "D:/Dev/pgsql/pgdata/logfile.log" start'
alias pgstop='/d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" stop'
alias pgstatus='/d/Dev/pgsql/pgsql/bin/pg_ctl.exe -D "D:/Dev/pgsql/pgdata" status'

# --- adb ---
alias adbreset='adb kill-server && adb start-server && adb devices && adb reverse tcp:8000 tcp:8000'
alias adbreverse='adb reverse tcp:8000 tcp:8000'
alias adbreverseoff='adb reverse --remove-all'
alias adbreverselist='adb reverse --list'
alias adbdevices='adb devices'

# --- Диагностика ---
alias wmshealth='curl -s http://127.0.0.1:8000/health/'
alias wmsport='netstat -ano | grep ":8000"'
alias wmslogs='adb logcat -c && adb logcat | grep -iE "flutter|push|c-2d-2|c-8b|c-8-catalog"'
alias wmsclear='adb shell pm clear com.example.wms_geology_mobile'

# --- Утилиты ---
alias taskkill='taskkill //F //IM'

# --- Node ---
export PATH="/d/Dev/nodejs/node:$PATH"
```

[↑](#navig)

<a id="s133"></a>
## 13.3. 🏠 ДОМАШНИЙ ПК — полный список

**Отличия:** пути `/c/Projert/...`, PostgreSQL в Docker, WiFi (без reverse).

### 📁 Навигация

**`wmsroot`** / **`wmsbe`** / **`wmsweb`** / **`wmsmob`** — то же, но `/c/Projert/...`.

### 🚀 MASTER

**`wms-start-be`** — Docker + migrate + runserver
```
wms-start-be
```
*Ожидание:* `Starting development server at http://0.0.0.0:8000/`.

**`wms-start-web`** / **`wms-start-mobile`** / **`wms-stop`** / **`wms-restart-be`** / **`wms-devcheck`** / **`wms-reset`** / **`wms-check`** — аналоги, но WiFi.

### 🐳 Docker (PostgreSQL)

**`wmsdb`** — запустить
```
wmsdb
```
*Ожидание:* `[+] Running 1/1 Started`.

**`wmsdbstop`** / **`wmsdbps`** / **`wmsdblogs`** — стоп / статус / логи.

### 📱 adb (без reverse)

**`adbreset`** / **`adbdevices`**.

### 🔍 Диагностика / 🛠 Утилиты

**`wmshealth`** / **`wmsport`** / **`wmslogs`** / **`wmsclear`** / **`taskkill`**.

### Полный блок для `~/.bashrc`

```
# --- Базовые: навигация ---
alias wmsroot='cd /c/Projert/WMS-Geology'
alias wmsbe='cd /c/Projert/WMS-Geology/backend'
alias wmsweb='cd /c/Projert/WMS-Geology/web'
alias wmsmob='cd /c/Projert/WMS-Geology/mobile'

# --- MASTER ---
alias wms-start-be='cd /c/Projert/WMS-Geology && docker compose up -d && cd backend && poetry run python manage.py migrate && poetry run python manage.py runserver 0.0.0.0:8000'
alias wms-start-web='cd /c/Projert/WMS-Geology/web && npm run dev'
alias wms-start-mobile='cd /c/Projert/WMS-Geology/mobile && flutter run'
alias wms-stop='taskkill python.exe 2>/dev/null; taskkill node.exe 2>/dev/null; taskkill dart.exe 2>/dev/null; cd /c/Projert/WMS-Geology && docker compose down; echo "WMS остановлен"'
alias wms-restart-be='taskkill python.exe 2>/dev/null; sleep 1; cd /c/Projert/WMS-Geology/backend && poetry run python manage.py runserver 0.0.0.0:8000'
alias wms-devcheck='cd /c/Projert/WMS-Geology/mobile && flutter analyze && flutter test'
alias wms-reset='adb shell pm clear com.example.wms_geology_mobile && cd /c/Projert/WMS-Geology/mobile && flutter clean && flutter pub get && adb kill-server && adb start-server && adb devices'
alias wms-check='echo "=== Docker ===" && cd /c/Projert/WMS-Geology && docker compose ps && echo "=== health ===" && curl -s -m 3 http://127.0.0.1:8000/health/ && echo "" && echo "=== port 8000 ===" && netstat -ano | findstr :8000 && echo "=== adb ===" && adb devices'

# --- Docker (PostgreSQL) ---
alias wmsdb='cd /c/Projert/WMS-Geology && docker compose up -d'
alias wmsdbstop='cd /c/Projert/WMS-Geology && docker compose down'
alias wmsdbps='cd /c/Projert/WMS-Geology && docker compose ps'
alias wmsdblogs='cd /c/Projert/WMS-Geology && docker compose logs -f postgres'

# --- adb ---
alias adbreset='adb kill-server && adb start-server && adb devices'
alias adbdevices='adb devices'

# --- Диагностика ---
alias wmshealth='curl -s http://127.0.0.1:8000/health/'
alias wmsport='netstat -ano | findstr :8000'
alias wmslogs='adb logcat -c && adb logcat | grep -iE "flutter|push|c-2d-2|c-8b|c-8-catalog"'
alias wmsclear='adb shell pm clear com.example.wms_geology_mobile'

# --- Утилиты ---
alias taskkill='taskkill //F //IM'
```

[↑](#navig)

<a id="s134"></a>
## 13.4. Быстрая сводка

| Алиас | 🏢 | 🏠 | Что делает |
|---|---|---|---|
| `wms-start-be` | ✅ | ✅ | PG/Docker + migrate + runserver |
| `wms-start-web` | ✅ | ✅ | npm run dev |
| `wms-start-mobile` | ✅ USB | ✅ WiFi | reverse (🏢) + flutter run |
| `wms-stop` | ✅ | ✅ | Убить всё + остановить БД |
| `wms-restart-be` | ✅ | ✅ | Перезапуск backend |
| `wms-devcheck` | ✅ | ✅ | analyze + test |
| `wms-reset` | ✅ | ✅ | pm clear + clean + adb reset |
| `wms-check` | ✅ | ✅ | Статус всего стека |
| `wms-switch-wifi` / `wms-switch-usb` | ✅ | — | Backend `0.0.0.0` / `127.0.0.1` |
| `adbreset` | ✅ (reverse) | ✅ | kill + start + devices |
| `adbreverse` / `adbreverseoff` / `adbreverselist` | ✅ | — | reverse вкл / выкл / статус |
| `adbdevices` | ✅ | ✅ | Список устройств |
| `pgstart` / `pgstop` / `pgstatus` | ✅ | — | Портативный PG |
| `wmsdb` / `wmsdbstop` / `wmsdbps` / `wmsdblogs` | — | ✅ | Docker PG |
| `wmshealth` / `wmsport` / `wmslogs` / `wmsclear` | ✅ | ✅ | Диагностика |
| `taskkill <name>` | ✅ | ✅ | Убить процесс |

[↑](#navig)

<a id="s135"></a>
## 13.5. `code: command not found`

**Что значит.** Терминал не знает, где `code.exe`.

**Найти:**
```
ls "/c/Program Files/Microsoft VS Code/bin/code" 2>/dev/null && echo "✅ нашли"
ls "/c/Users/$USER/AppData/Local/Programs/Microsoft VS Code/bin/code" 2>/dev/null && echo "✅ нашли"
```

**Если нашли — в `~/.bashrc`:**
```
export PATH="/c/Program Files/Microsoft VS Code/bin:$PATH"
```
`source ~/.bashrc`.

**Если нет** — `notepad ~/.bashrc` (Блокнот).

[↑](#navig)

---

<a id="s14"></a>
# §14. Однострочники

<a id="s141"></a>
## 14.1. Полный device-check
```
wms-devcheck && adbreset && wms-start-mobile
```

<a id="s142"></a>
## 14.2. Убить зависший процесс
```
taskkill dart.exe
taskkill java.exe
taskkill python.exe
taskkill adb.exe
```

<a id="s143"></a>
## 14.3. Очистить данные + пересобрать
```
wms-reset
```

<a id="s144"></a>
## 14.4. Проверка сервер + планшет
```
wmshealth && adbdevices && wmsport
```

<a id="s145"></a>
## 14.5. Полная пересборка mobile
```
wms-reset && wms-start-mobile
```

<a id="s146"></a>
## 14.6. Текущий коммит + статус
```
wmsroot && git log --oneline -3 && git status --short
```

<a id="s147"></a>
## 14.7. Цикл коммита
```
cd /d/Dev/projects/WMS-Geology && \
  git checkout -- mobile/android/ && \
  git status --short | grep "mobile/lib" && \
  git add mobile/lib/... mobile/test/... && \
  git commit -m "..." && \
  git push origin fix/2.x-mobile-bundle-c-2
```
**⚠ Файлы перечислять явно.** Не `git add .`.

[↑](#navig)

---

<a id="s15"></a>
# §15. Шпаргалка «Я хочу…»

| Я хочу | § |
|---|---|
| Запустить весь стек (работа) | §0.1 |
| Запустить весь стек (дом) | §0.2 |
| Остановить всё | §0.5 / §0.6 |
| Полный device-check | §0.9 |
| Полный reset | §0.10 |
| Туннель USB вкл | §6.1 |
| Туннель USB выкл | §6.3 |
| Сброс adb | §6.5 |
| USB → WiFi | §0.13 |
| WiFi → USB | §0.14 |
| Логи Flutter | §8.1 |
| Логи Android | §8.2 |
| Логи SyncScreen | §8.3 |
| Overflow | §10.13 |
| Монитор загрузки | §9.1 |
| Дамп БД (🏢) | §12.1 |
| Дамп БД (🏠) | §12.2 |
| Установить алиасы | §13.1 |
| Список алиасов | §13.2 / §13.3 |
| Убить процесс | §14.2 |

[↑](#navig)

---
# §17. Итог-блоки.

Используем wms_clear и wms_report. Никаких долларов и heredoc в чате.
