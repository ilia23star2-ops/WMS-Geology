#!/usr/bin/env bash
# ocr_smoke.sh v2 — сквозной smoke серверного OCR.
# Отличие от v1: все внутренние python-вызовы идут через venv напрямую,
# poetry не участвует в горячем пути. JWT-ошибки видны в логе.

set -uo pipefail

BACKEND="/d/Dev/projects/WMS-Geology/backend"
SMOKE_DIR="$BACKEND/.tmp_smoke"
PNG="$SMOKE_DIR/ocr_smoke.png"
SERVER_LOG="/tmp/ocr_smoke_server.log"
JWT_LOG="/tmp/ocr_smoke_jwt.log"
RESP_JSON="$SMOKE_DIR/response.json"
RESULT_FILE="/tmp/ocr_smoke_result.txt"
API="http://127.0.0.1:8000"
PY312="/d/Dev/python312/python.exe"

rm -f "$RESULT_FILE" "$JWT_LOG"
echo "=== OCR SMOKE START ==="

mkdir -p "$SMOKE_DIR"

# 0. venv-python (без poetry в горячем пути)
cd "$BACKEND" || exit 1
VENV_PATH=$(poetry env info -p 2>/dev/null || echo "")
if [ -z "$VENV_PATH" ]; then
    VENV_PATH="$BACKEND/.venv"
fi
VENV_PY="$VENV_PATH/Scripts/python.exe"
[ -x "$VENV_PY" ] || VENV_PY="$VENV_PATH/bin/python"
if [ ! -x "$VENV_PY" ]; then
    echo "FAIL: venv python not found. VENV_PATH=$VENV_PATH"
    exit 1
fi
echo "venv python: $VENV_PY"

# 1. PNG
if [ ! -f "$PNG" ]; then
    PNG_WIN=$(cygpath -w "$PNG")
    "$PY312" -c "from PIL import Image, ImageDraw; im=Image.new('RGB',(500,140),'white'); d=ImageDraw.Draw(im); d.text((20,40),'TST0001 Hello OCR',fill='black'); im.save(r'$PNG_WIN'); print('png ok')"
fi
echo "PNG: $PNG ($(stat -c %s "$PNG" 2>/dev/null || echo '?') bytes)"

# 2. Чистим процессы + стартуем сервер
taskkill //F //IM python.exe > /dev/null 2>&1 || true
sleep 1
"$VENV_PY" manage.py runserver 127.0.0.1:8000 > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'taskkill //F //IM python.exe > /dev/null 2>&1 || true' EXIT

# 3. Ждём /health/
READY=0
for i in $(seq 1 30); do
    if curl -s -m 2 "$API/health/" > /dev/null 2>&1; then
        READY=1
        echo "server ready after ${i}s (pid=$SERVER_PID)"
        break
    fi
    sleep 1
done
if [ "$READY" -ne 1 ]; then
    echo "FAIL: server not up in 30s. Log:"
    tail -40 "$SERVER_LOG"
    exit 1
fi

# 4. JWT (через venv python, stderr виден)
TOKEN=$("$VENV_PY" -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE','wms_geology.settings')
django.setup()
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
u = get_user_model().objects.first()
if not u:
    raise SystemExit('no users')
print(str(RefreshToken.for_user(u).access_token))
" 2>"$JWT_LOG" | tail -1)
if [ -z "$TOKEN" ]; then
    echo "FAIL: JWT not generated. stderr:"
    cat "$JWT_LOG"
    exit 1
fi
echo "JWT OK (len=${#TOKEN})"

# 5. POST /api/v1/ocr/recognize/
HTTP=$(curl -s -o "$RESP_JSON" -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    -F "image=@$PNG" \
    "$API/api/v1/ocr/recognize/")
echo "HTTP: $HTTP"
echo "--- response (first 300 chars) ---"
head -c 300 "$RESP_JSON"
echo ""
echo "---"

if [ "$HTTP" != "200" ]; then
    echo "FAIL: expected 200, got $HTTP"
    cat "$RESP_JSON"
    exit 1
fi

# 6. Verify DB (тоже через venv python)
DB_OUT=$("$VENV_PY" -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE','wms_geology.settings')
django.setup()
from apps.ocr.models import OcrTask
t = OcrTask.objects.order_by('-id').first()
if not t:
    print('DB FAIL: no tasks'); raise SystemExit(1)
print('DB task id=%s status=%s' % (t.id, t.status))
if t.status != 'READY':
    print('DB FAIL: status != READY'); raise SystemExit(2)
raw = t.raw_ocr_data or {}
words = raw.get('words', [])
print('DB words=%d' % len(words))
print('DB text=%r' % (raw.get('text','')[:80]))
print('DB OK')
" 2>&1)
echo "$DB_OUT"
if echo "$DB_OUT" | grep -q "DB OK"; then
    echo "=== OCR SMOKE OK ==="
    echo "OK" > "$RESULT_FILE"
else
    echo "FAIL: DB verification failed"
    exit 1
fi