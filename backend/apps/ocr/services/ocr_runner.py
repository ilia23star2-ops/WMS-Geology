import sys
import os
import json
import contextlib

# python312 — портативный (embed) дистрибутив. У него sys.path может
# не включать директорию скрипта. Явно добавляем её ПЕРЕД импортом
# локальных модулей, иначе `from bbox import` падает с ModuleNotFoundError.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

# Redirect stdout to stderr so EasyOCR doesn't break our JSON
import easyocr

from bbox import safe_bbox
from ocr_preprocess import preprocess_image


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"error": "Image not found"}))
        sys.exit(1)

    # c-6i: preprocess (rotate / resize / gray / contrast / sharpen)
    preprocessed_path = None
    try:
        preprocessed_path = preprocess_image(image_path)
        read_path = preprocessed_path
    except Exception as e:
        # Если preprocess упал — работаем на оригинале, не ломаем OCR.
        # (Сообщение в stderr, чтобы не сломать JSON в stdout.)
        print(f"[preprocess] fallback to original: {e}", file=sys.stderr)
        read_path = image_path

    try:
        # Suppress EasyOCR stdout (loading bars, etc) — они бы сломали JSON
        with contextlib.redirect_stdout(sys.stderr):
            reader = easyocr.Reader(['ru', 'en'], gpu=False)
            results = reader.readtext(read_path)
    finally:
        # Удаляем временный файл, даже если readtext упал.
        if preprocessed_path and os.path.exists(preprocessed_path):
            try:
                os.unlink(preprocessed_path)
            except OSError:
                pass

    words = []
    full_text = []
    for bbox, text, conf in results:
        words.append({
            "text": str(text),
            "confidence": float(conf),
            "bbox": safe_bbox(bbox),
        })
        full_text.append(str(text))

    output = {
        "text": " ".join(full_text),
        "words": words,
    }
    # ONLY print the JSON — views.py парсит именно stdout
    print(json.dumps(output, ensure_ascii=False))


if __name__ == '__main__':
    main()