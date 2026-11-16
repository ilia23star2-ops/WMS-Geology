"""Патч views.py: передать valid_prefixes в extract_fields (6j).

Собирает set из Site.code + Site.match_patterns.
Идемпотентно.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
VIEWS = BACKEND / "apps" / "ocr" / "views.py"

OLD = '''                    cts_meta = [{"name": ct.name} for ct in ContainerType.objects.all()]
                    extracted = extract_fields(
                        task.zones or [],
                        ocr_data,
                        sites=sites_meta,
                        research_types=rts_meta,
                        container_types=cts_meta,
                    )'''

NEW = '''                    cts_meta = [{"name": ct.name} for ct in ContainerType.objects.all()]
                    # 6j: valid_prefixes (site.code + match_patterns) — фильтр Н/З, коррекция ST→TST
                    vp = set()
                    for s in sites_meta:
                        if s.get("code"):
                            vp.add(s["code"].upper())
                        for p in (s.get("match_patterns") or []):
                            if p:
                                vp.add(p.upper())
                    extracted = extract_fields(
                        task.zones or [],
                        ocr_data,
                        sites=sites_meta,
                        research_types=rts_meta,
                        container_types=cts_meta,
                        valid_prefixes=vp,
                    )'''


def main():
    text = VIEWS.read_text(encoding="utf-8")
    if "valid_prefixes=vp" in text:
        print("= already patched")
        return
    if OLD not in text:
        print("? anchor not found")
        raise SystemExit(2)
    text = text.replace(OLD, NEW, 1)
    VIEWS.write_text(text, encoding="utf-8")
    print("+ patched OK")


if __name__ == "__main__":
    main()