"""Диагностика task #9: extracted, raw.text, words[], ResearchType в БД.

Запуск: poetry run python scripts/verify_task_9.py
"""
import os
import sys
import django

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "wms_geology.settings")
django.setup()

from apps.ocr.models import OcrTask
from apps.samples.catalogs import ResearchType

t = OcrTask.objects.filter(pk=9).first()
if not t:
    print("task #9 not found")
    raise SystemExit(1)

print(f"task.id={t.id} status={t.status} batch={t.batch_id}")
raw = t.raw_ocr_data or {}
ex = raw.get("extracted") or {}

print("\n=== extracted ===")
for k, v in ex.items():
    print(f"  {k} = {v!r}")

print("\n=== raw.text (первые 500) ===")
print(repr((raw.get("text") or "")[:500]))

print("\n=== words с '1209' (все) ===")
words = raw.get("words") or []
for w in words:
    text = (w.get("text") or "").upper()
    if "1209" in text:
        print(f"  {text!r} (conf={w.get('confidence'):.3f}) bbox={w.get('bbox')}")

print(f"\nвсего words: {len(words)}")

print("\n=== words с 'ААА' / 'AAA' / 'АА' / 'AA' ===")
for w in words:
    text = (w.get("text") or "").upper()
    if "ААА" in text or "AAA" in text or "АА" in text or "AA" in text:
        print(f"  {text!r} (conf={w.get('confidence'):.3f})")

print("\n=== ResearchType в БД ===")
for rt in ResearchType.objects.all():
    code_repr = repr(rt.code)
    name_repr = repr(rt.name)
    # Показать hex первых символов — кириллица vs латиница
    code_hex = " ".join(f"{ord(c):04x}" for c in rt.code)
    print(f"  id={rt.id} code={code_repr} name={name_repr} is_active={rt.is_active}")
    print(f"    code_hex: {code_hex}")

print("\n=== samples в extracted ===")
print(f"  {ex.get('samples')}")

# Есть ли 907/908/909 в raw.text?
text = (raw.get("text") or "").upper()
for n in ("907", "908", "909", "1209O7", "1209O8", "1209O9", "12090"):
    if n in text:
        print(f"\n  '{n}' есть в raw.text")

# Все слова правой колонки (bbox.x > 0.5 * max)
if words:
    max_x = max(max(p[0] for p in w["bbox"]) for w in words if w.get("bbox"))
    right_words = [w for w in words if w.get("bbox") and min(p[0] for p in w["bbox"]) > max_x * 0.5]
    print(f"\n=== words правее {max_x*0.5:.0f}px ({len(right_words)} шт) ===")
    for w in right_words[:20]:
        print(f"  {w.get('text')!r} bbox={w.get('bbox')}")