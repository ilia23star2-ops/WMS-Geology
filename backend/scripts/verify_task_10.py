"""Диагностика task #10: bbox vs оригинал, raw.text, потерянные пробы, ILM11.

Запуск: poetry run python scripts/verify_task_10.py
"""
import os
import sys
import django

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "wms_geology.settings")
django.setup()

from PIL import Image
from apps.ocr.models import OcrTask
from apps.samples.catalogs import ResearchType

t = OcrTask.objects.filter(pk=10).first()
if not t:
    print("task #10 not found")
    raise SystemExit(1)

print(f"task.id={t.id} status={t.status}")
raw = t.raw_ocr_data or {}
ex = raw.get("extracted") or {}
words = raw.get("words") or []

print("\n=== extracted ===")
for k, v in ex.items():
    print(f"  {k} = {v!r}")

print("\n=== raw.text (первые 800) ===")
print(repr((raw.get("text") or "")[:800]))

print(f"\nвсего words: {len(words)}")

# Размер оригинала (MEDIA_ROOT)
img_path = t.image.path if t.image else None
if img_path and os.path.exists(img_path):
    with Image.open(img_path) as img:
        orig_w, orig_h = img.size
    print(f"\nоригинал image.size = {orig_w}x{orig_h}")

    # Размер bbox-extent в words[]
    if words:
        max_x = max(max(p[0] for p in w["bbox"]) for w in words if w.get("bbox"))
        max_y = max(max(p[1] for p in w["bbox"]) for w in words if w.get("bbox"))
        print(f"max bbox x,y = {max_x:.0f}, {max_y:.0f}")
        print(f"ratio x = {max_x / orig_w:.3f}, y = {max_y / orig_h:.3f}")
        if 0.4 < max_x / orig_w < 0.6:
            print("  ⚠️ bbox в системе PREPROCESSED (ratio ~0.5) — на фронте не совпадут!")
        elif 0.85 < max_x / orig_w < 1.0:
            print("  ✅ bbox в системе ОРИГИНАЛА")

# Есть ли 904-909 в raw.text?
text = (raw.get("text") or "").upper()
print("\n=== паттерны в raw.text ===")
for n in ("904", "905", "906", "907", "908", "909", "ILM", "ILM11", "TST1209"):
    if n in text:
        print(f"  '{n}' ЕСТЬ")
    else:
        print(f"  '{n}' нет")

# Все words с 904-909
print("\n=== words с '904'-'909' ===")
for w in words:
    text_w = (w.get("text") or "").upper()
    for n in ("904", "905", "906", "907", "908", "909"):
        if n in text_w:
            print(f"  {w.get('text')!r} (conf={w.get('confidence'):.3f}) bbox={w.get('bbox')}")
            break

# Откуда ILM11
print("\n=== words с 'ILM' или 'LM1' ===")
for w in words:
    text_w = (w.get("text") or "").upper()
    if "ILM" in text_w or "LM1" in text_w:
        print(f"  {w.get('text')!r} (conf={w.get('confidence'):.3f}) bbox={w.get('bbox')}")