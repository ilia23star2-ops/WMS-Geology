"""OCR warmup: скачивает модели EasyOCR с прогресс-баром в терминал.

Запуск: D:\\Dev\\python312\\python.exe backend\\scripts\\ocr_warmup.py
После первого успешного запуска ocr_runner.py работает без сети.

Не входит в prod, это разовая утилита подготовки рабочего ПК.
"""
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

STEP_SEC = 15
STUCK_LIMIT_SEC = 120


def resolve_model_dir() -> Path:
    env = os.environ.get('EASYOCR_MODULE_PATH')
    if env:
        return Path(env)
    base = os.environ.get('USERPROFILE') or os.path.expanduser('~')
    return Path(base) / '.EasyOCR' / 'model'


def dir_size_bytes(path: Path) -> int:
    if not path.is_dir():
        return 0
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def ensure_png(path: Path) -> None:
    if path.is_file() and path.stat().st_size > 0:
        print(f'[warmup] PNG уже есть: {path}')
        return
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (500, 140), 'white')
    d = ImageDraw.Draw(im)
    d.text((20, 40), 'TST0001 Hello OCR', fill='black')
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(str(path))
    print(f'[warmup] PNG создан: {path}')


def main() -> int:
    here = Path(__file__).resolve().parent
    runner = here.parent / 'apps' / 'ocr' / 'services' / 'ocr_runner.py'
    if not runner.is_file():
        print(f'[warmup] FAIL: не найден ocr_runner.py: {runner}', file=sys.stderr)
        return 2

    model_dir = resolve_model_dir()
    print(f'[warmup] model dir: {model_dir}')

    png = Path(tempfile.gettempdir()) / 'ocr_warmup_test.png'
    ensure_png(png)

    out_log = Path(tempfile.gettempdir()) / 'ocr_warmup_out.json'
    err_log = Path(tempfile.gettempdir()) / 'ocr_warmup_err.log'

    with open(out_log, 'w', encoding='utf-8') as fout, \
            open(err_log, 'w', encoding='utf-8') as ferr:
        proc = subprocess.Popen(
            [sys.executable, str(runner), str(png)],
            stdout=fout, stderr=ferr, encoding='utf-8',
        )

        prev = 0
        stuck_steps = 0
        step = 0
        while proc.poll() is None:
            size = dir_size_bytes(model_dir)
            delta = size - prev
            if delta == 0 and size > 0:
                stuck_steps += 1
            else:
                stuck_steps = 0
            step += 1
            mb = size / 1024 / 1024
            kb = delta / 1024
            print(f'[warmup {step:02d}] cache={mb:.1f}MB (+{kb:.0f}KB) '
                  f'stuck={stuck_steps * STEP_SEC}s')

            if stuck_steps * STEP_SEC >= STUCK_LIMIT_SEC:
                print('[warmup] ЗАСТРЯЛО 2 мин без роста — прерываю',
                      file=sys.stderr)
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                break

            time.sleep(STEP_SEC)
            prev = size

        rc = proc.wait()

    final = dir_size_bytes(model_dir)
    print(f'[warmup] ИТОГО cache={final/1024/1024:.1f}MB exit={rc}')

    if rc == 0 and out_log.stat().st_size > 0:
        try:
            data = json.loads(out_log.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            print(f'[warmup] FAIL: JSON не парсится: {e}', file=sys.stderr)
            return 3
        words = data.get('words', [])
        text = (data.get('text') or '')[:200]
        print(f'[warmup] OK: распознано слов={len(words)}')
        print(f'[warmup] текст: {text!r}')
        print('[warmup] OK')
        return 0

    print('[warmup] FAIL. stderr (последние 30 строк):', file=sys.stderr)
    try:
        lines = err_log.read_text(encoding='utf-8', errors='replace').splitlines()
        for ln in lines[-30:]:
            print(ln, file=sys.stderr)
    except OSError:
        pass
    return 1


if __name__ == '__main__':
    sys.exit(main())