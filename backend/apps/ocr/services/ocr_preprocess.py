"""Preprocessing фото перед EasyOCR (c-3.x-migration-6i).

Пайплайн:
  1. EXIF auto-rotate — камера планшета пишет ориентацию в EXIF,
     EasyOCR её игнорирует → буквы на боку.
  2. Resize — если >2000px по длинной стороне, уменьшить;
     если <800px по КОРОТКОЙ, увеличить.
  3. Grayscale — цвет не нужен, контраст важнее.
  4. Autocontrast — убирает пере-экспонированные блики.
  5. Unsharp mask — на муаре/мыле восстанавливает тонкие штрихи.

Возвращает (out_path, scale_x, scale_y):
  scale_x = orig_w / new_w, scale_y = orig_h / new_h.
  Умножить bbox из preprocessed на (scale_x, scale_y) → координаты оригинала.

c-3.x-migration-6j: возврат scale (bbox mismatch на фронте).
"""
import os
import tempfile

from PIL import Image, ImageFilter, ImageOps


MAX_SIDE = 2000
MIN_SIDE = 800


def preprocess_image(image_path: str) -> tuple[str, float, float]:
    """Обрабатывает фото и возвращает (out_path, scale_x, scale_y).

    Args:
        image_path: путь к исходному фото.

    Returns:
        (out_path, scale_x, scale_y) — путь к временному JPEG,
        множители для обратного масштабирования bbox.

    Raises:
        FileNotFoundError: исходного файла нет.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(image_path)

    img = Image.open(image_path)

    # 1. EXIF rotate
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    # 2. Resize
    orig_w, orig_h = img.size
    w, h = img.size
    long_side = max(w, h)
    short_side = min(w, h)
    if long_side > MAX_SIDE:
        scale = MAX_SIDE / long_side
        new_size = (int(w * scale), int(h * scale))
        img = img.resize(new_size, Image.LANCZOS)
    elif short_side < MIN_SIDE:
        scale = MIN_SIDE / short_side
        new_size = (int(w * scale), int(h * scale))
        img = img.resize(new_size, Image.LANCZOS)

    # 3-5. Grayscale + contrast + sharpen
    img = img.convert("L")
    img = ImageOps.autocontrast(img, cutoff=2)
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))

    new_w, new_h = img.size
    scale_x = orig_w / new_w if new_w > 0 else 1.0
    scale_y = orig_h / new_h if new_h > 0 else 1.0

    fd, out_path = tempfile.mkstemp(suffix=".jpg", prefix="ocr_pre_")
    os.close(fd)
    img.save(out_path, "JPEG", quality=92)
    return out_path, scale_x, scale_y