#!/usr/bin/env bash
# ============================================================
# WMS Geology — единые команды входа для агента и человека
# ============================================================
# Использование:
#   ./scripts/agent/run.sh test-be        backend pytest
#   ./scripts/agent/run.sh test-web       web vitest
#   ./scripts/agent/run.sh test-mobile    flutter analyze + test
#   ./scripts/agent/run.sh check-mig      миграции без изменений
#   ./scripts/agent/run.sh all            всё по порядку
#
# Печатает итоговую строку для парсинга агентом:
#   AGENT_SUMMARY <команда> ok|fail <секунды>
# ============================================================
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CMD="${1:-all}"

run_one() {
  local name="$1"; shift
  local t0="$SECONDS"
  echo "=== AGENT_RUN $name ==="
  if "$@"; then
    echo "AGENT_SUMMARY $name ok $((SECONDS - t0))s"
    return 0
  else
    echo "AGENT_SUMMARY $name fail $((SECONDS - t0))s"
    return 1
  fi
}

test_be()   { (cd "$ROOT/backend" && poetry run pytest -q); }
test_web()  { (cd "$ROOT/web" && npm test); }
test_mob()  { (cd "$ROOT/mobile" && flutter analyze && flutter test); }
check_mig() { (cd "$ROOT/backend" && poetry run python manage.py makemigrations --check --dry-run); }

case "$CMD" in
  test-be)     run_one test-be     test_be ;;
  test-web)    run_one test-web    test_web ;;
  test-mobile) run_one test-mobile test_mob ;;
  check-mig)   run_one check-mig   check_mig ;;
  all)
    ok=1
    run_one test-be     test_be     || ok=0
    run_one test-web    test_web    || ok=0
    run_one test-mobile test_mob    || ok=0
    run_one check-mig   check_mig   || ok=0
    if [ "$ok" = 1 ]; then echo "AGENT_SUMMARY all ok"; exit 0; else echo "AGENT_SUMMARY all fail"; exit 1; fi
    ;;
  *) echo "неизвестная команда: $CMD (жду test-be|test-web|test-mobile|check-mig|all)"; exit 2 ;;
esac