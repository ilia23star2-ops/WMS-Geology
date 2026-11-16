"""Патч OcrReviewPage.tsx для 6a-fix5c:
  1. Race-фикс: не запускать prefill, пока справочники не загрузились.
  2. Участок: ex.site ("TST") → "TST — Тестовый участок" через sites.data.
  3. ТИ: если find не нашёл — оставить raw (не пусто).

Идемпотентно. Одноразовая утилита c-3.x-migration-6a-fix5c.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path

WEB = Path(__file__).resolve().parents[2] / "web"
FILE = WEB / "src" / "pages" / "OcrReviewPage.tsx"


OLD_BLOCK = '''        if (ex.container_number) setContainerNumber(ex.container_number);
        if (ex.site) setSiteName(ex.site);
        if (ex.container_type) setContainerTypeName(ex.container_type);
        if (ex.research_type) {
            const rt = researchTypes.data?.find(
                (x) => x.code === ex.research_type || x.name === ex.research_type,
            );
            if (rt) setResearchTypeName(`${rt.code} — ${rt.name}`);
        }'''

NEW_BLOCK = '''        // c-6a-fix5c: ждём все справочники, иначе mapping code→name не сработает
        if (!sites.data || !researchTypes.data || !containerTypes.data) {
            return;
        }
        if (ex.container_number) setContainerNumber(ex.container_number);
        // c-6a-fix5c: участок — code → "code — name"
        if (ex.site) {
            const s = sites.data.find((x) => x.code === ex.site);
            setSiteName(s ? `${s.code} — ${s.name}` : ex.site);
        }
        if (ex.container_type) setContainerTypeName(ex.container_type);
        if (ex.research_type) {
            const rt = researchTypes.data.find(
                (x) => x.code === ex.research_type || x.name === ex.research_type,
            );
            setResearchTypeName(rt ? `${rt.code} — ${rt.name}` : ex.research_type);
        }'''

OLD_DEPS = "    }, [task, prefilled, researchTypes.data, laboratoryPrefixes, siteMatchPatterns]);"
NEW_DEPS = "    }, [task, prefilled, sites.data, researchTypes.data, containerTypes.data, laboratoryPrefixes, siteMatchPatterns]);"


def main():
    if not FILE.exists():
        print(f"? FILE not found: {FILE}")
        raise SystemExit(2)
    text = FILE.read_text(encoding="utf-8")
    changed = False

    if "c-6a-fix5c: ждём все справочники" in text:
        print("= race-fix (уже есть)")
    elif OLD_BLOCK in text:
        text = text.replace(OLD_BLOCK, NEW_BLOCK, 1)
        print("+ race-fix + site/rt mapping")
        changed = True
    else:
        print("? anchor prefill block not found")
        print("  Возможно, отступы или порядок строк другие.")
        # Диагностика: покажем строки 235-260
        lines = text.split("\n")
        for i in range(234, min(265, len(lines))):
            print(f"  {i+1}: {lines[i]}")
        raise SystemExit(2)

    if NEW_DEPS in text:
        print("= deps (уже обновлены)")
    elif OLD_DEPS in text:
        text = text.replace(OLD_DEPS, NEW_DEPS, 1)
        print("+ deps (sites.data, containerTypes.data)")
        changed = True
    else:
        print("? anchor deps not found — оставляю deps без изменений")

    if changed:
        FILE.write_text(text, encoding="utf-8")
    print("OK")


if __name__ == "__main__":
    main()