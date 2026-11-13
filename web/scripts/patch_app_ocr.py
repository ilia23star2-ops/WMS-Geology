"""Точечный патч src/App.tsx: импорт OcrReviewPage + маршрут /ocr/review/:id.

Идемпотентно: если правка уже есть — пропускает.
Одноразовая утилита захода c-3.x-migration-5b.
"""
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "src" / "App.tsx"


def patch(text: str) -> str:
    # 1. import OcrReviewPage после любого другого import ... from "./pages/..."
    if "OcrReviewPage" not in text:
        anchor = 'import ContainersPage from "./pages/ContainersPage";'
        new_import = 'import OcrReviewPage from "./pages/OcrReviewPage";'
        if anchor in text:
            text = text.replace(anchor, anchor + "\n" + new_import, 1)
            print("[App.tsx] + import OcrReviewPage")
        else:
            # fallback: найдём первый import из ./pages/ и вставим перед ним
            lines = text.split("\n")
            inserted = False
            for i, line in enumerate(lines):
                if 'from "./pages/' in line:
                    lines.insert(i, new_import)
                    inserted = True
                    print(f"[App.tsx] + import OcrReviewPage (перед строкой {i+1})")
                    break
            if not inserted:
                # fallback 2: вставим после последнего import
                for i in range(len(lines) - 1, -1, -1):
                    if lines[i].startswith("import "):
                        lines.insert(i + 1, new_import)
                        print(f"[App.tsx] + import OcrReviewPage (после последнего import, строка {i+1})")
                        inserted = True
                        break
            text = "\n".join(lines)
    else:
        print("[App.tsx] = import OcrReviewPage (уже есть)")

    # 2. <Route path="/ocr/review/:id" element={<OcrReviewPage />} />
    if "/ocr/review/:id" not in text:
        anchor = '<Route path="/containers" element={<ContainersPage />} />'
        new_route = '                        <Route path="/ocr/review/:id" element={<OcrReviewPage />} />'
        if anchor in text:
            text = text.replace(anchor, anchor + "\n" + new_route, 1)
            print("[App.tsx] + route /ocr/review/:id")
        else:
            print("[App.tsx] ? route — якорь /containers не найден")
    else:
        print("[App.tsx] = route /ocr/review/:id (уже есть)")

    return text


def main():
    original = APP.read_text(encoding="utf-8")
    patched = patch(original)
    if patched == original:
        print("Ничего не изменилось.")
        return
    APP.write_text(patched, encoding="utf-8")
    print("OK")


if __name__ == "__main__":
    main()