import sys
import os
import json
import contextlib

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

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

    # c-6i + 6j: preprocess + scale (bbox обратно к оригиналу)
    preprocessed_path = None
    scale_x = 1.0
    scale_y = 1.0
    try:
        preprocessed_path, scale_x, scale_y = preprocess_image(image_path)
        read_path = preprocessed_path
    except Exception as e:
        print(f"[preprocess] fallback to original: {e}", file=sys.stderr)
        read_path = image_path

    try:
        with contextlib.redirect_stdout(sys.stderr):
            reader = easyocr.Reader(['ru', 'en'], gpu=False)
            results = reader.readtext(read_path)
    finally:
        if preprocessed_path and os.path.exists(preprocessed_path):
            try:
                os.unlink(preprocessed_path)
            except OSError:
                pass

    words = []
    full_text = []
    for bbox, text, conf in results:
        # c-6j: масштабируем bbox обратно к оригиналу
        scaled = [[float(p[0]) * scale_x, float(p[1]) * scale_y] for p in bbox]
        words.append({
            "text": str(text),
            "confidence": float(conf),
            "bbox": safe_bbox(scaled),
        })
        full_text.append(str(text))

    output = {
        "text": " ".join(full_text),
        "words": words,
    }
    print(json.dumps(output, ensure_ascii=False))


if __name__ == '__main__':
    main()