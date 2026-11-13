import sys
import json
import os
import contextlib

# Redirect stdout to stderr so EasyOCR doesn't break our JSON
import easyocr

# bbox.py лежит в этой же папке — при запуске скрипта напрямую
# sys.path[0] = apps/ocr/services/, импорт работает.
from bbox import safe_bbox


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"error": "Image not found"}))
        sys.exit(1)

    # Suppress EasyOCR stdout (loading bars, etc) — они бы сломали JSON
    with contextlib.redirect_stdout(sys.stderr):
        reader = easyocr.Reader(['ru', 'en'], gpu=False)
        results = reader.readtext(image_path)

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