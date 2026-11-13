"""Патч Sidebar.tsx (пункт «Оцифровка») + App.tsx (2 маршрута /ocr/batches).

Идемпотентно.
Одноразовая утилита захода c-3.x-migration-5c.
"""
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]

SIDEBAR = WEB / "src" / "components" / "layout" / "Sidebar.tsx"
APP = WEB / "src" / "App.tsx"


def patch_sidebar(text: str) -> str:
    # 1. import иконки
    if "DocumentScannerIcon" not in text:
        anchor = 'import FactCheckIcon from "@mui/icons-material/FactCheck";'
        if anchor in text:
            text = text.replace(
                anchor,
                anchor + '\nimport DocumentScannerIcon from "@mui/icons-material/DocumentScanner";',
                1,
            )
            print("[Sidebar] + import DocumentScannerIcon")
        else:
            print("[Sidebar] ? anchor import FactCheckIcon не найден")
    else:
        print("[Sidebar] = DocumentScannerIcon (уже есть)")

    # 2. пункт MENU — после «Актуализация»
    if 'path: "/ocr/batches"' not in text:
        anchor = '    { label: "Актуализация", path: "/actualization", icon: <FactCheckIcon /> },'
        new_line = '    { label: "Оцифровка", path: "/ocr/batches", icon: <DocumentScannerIcon /> },'
        if anchor in text:
            text = text.replace(anchor, anchor + "\n" + new_line, 1)
            print("[Sidebar] + MENU Оцифровка")
        else:
            print("[Sidebar] ? anchor «Актуализация» не найден")
    else:
        print("[Sidebar] = MENU Оцифровка (уже есть)")

    return text


def patch_app(text: str) -> str:
    # 1. импорт OcrBatchesPage
    if "OcrBatchesPage" not in text:
        anchor = 'import OcrReviewPage from "./pages/OcrReviewPage";'
        new = (
            'import OcrBatchesPage from "./pages/OcrBatchesPage";\n'
            'import OcrBatchDetailPage from "./pages/OcrBatchDetailPage";'
        )
        if anchor in text:
            text = text.replace(anchor, anchor + "\n" + new, 1)
            print("[App] + imports OcrBatchesPage, OcrBatchDetailPage")
        else:
            print("[App] ? anchor OcrReviewPage не найден")
    else:
        print("[App] = OcrBatchesPage (уже есть)")

    # 2. 2 маршрута
    if 'path="/ocr/batches"' not in text:
        anchor = '                        <Route path="/ocr/review/:id" element={<OcrReviewPage />} />'
        new = (
            '                        <Route path="/ocr/batches" element={<OcrBatchesPage />} />\n'
            '                        <Route path="/ocr/batches/:id" element={<OcrBatchDetailPage />} />'
        )
        if anchor in text:
            text = text.replace(anchor, anchor + "\n" + new, 1)
            print("[App] + routes /ocr/batches, /ocr/batches/:id")
        else:
            print("[App] ? anchor ocr/review/:id не найден")
    else:
        print("[App] = routes (уже есть)")

    return text


def apply(path: Path, fn):
    original = path.read_text(encoding="utf-8")
    patched = fn(original)
    if patched == original:
        print(f"[{path.name}] ничего не изменилось")
        return
    path.write_text(patched, encoding="utf-8")
    print(f"[{path.name}] OK")


if __name__ == "__main__":
    apply(SIDEBAR, patch_sidebar)
    apply(APP, patch_app)