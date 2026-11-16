"""Патч apps/ocr/views.py: передать Site/ResearchType/ContainerType в extract_fields.

Идемпотентно. Одноразовая утилита захода c-3.x-migration-6a-fix5a.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
VIEWS = BACKEND / "apps" / "ocr" / "views.py"


OLD = '''                    from .services.mapping import extract_fields
                    extracted = extract_fields(task.zones or [], ocr_data)'''

NEW = '''                    # 6a-fix5a: fuzzy match справочников (site/research_type/container_type)
                    from .services.mapping import extract_fields
                    from apps.samples.catalogs import Site, ResearchType
                    from apps.storage.models import ContainerType

                    sites_meta = [
                        {"code": s.code, "name": s.name, "match_patterns": s.match_patterns}
                        for s in Site.objects.filter(is_active=True)
                    ]
                    rts_meta = [
                        {"code": rt.code, "name": rt.name}
                        for rt in ResearchType.objects.filter(is_active=True)
                    ]
                    cts_meta = [{"name": ct.name} for ct in ContainerType.objects.all()]
                    extracted = extract_fields(
                        task.zones or [],
                        ocr_data,
                        sites=sites_meta,
                        research_types=rts_meta,
                        container_types=cts_meta,
                    )'''


def main():
    text = VIEWS.read_text(encoding="utf-8")
    if "sites=sites_meta" in text:
        print("= already patched")
        return
    if OLD not in text:
        print("? anchor not found in views.py")
        print("  Expected:")
        print(OLD)
        raise SystemExit(2)
    text = text.replace(OLD, NEW, 1)
    VIEWS.write_text(text, encoding="utf-8")
    print("+ patched OK")


if __name__ == "__main__":
    main()