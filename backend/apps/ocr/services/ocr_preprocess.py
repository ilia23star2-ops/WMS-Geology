"""Preprocessing фото перед EasyOCR (c-3.x-migration-6i).

Пайплайн:
  1. EXIF auto-rotate — камера планшета пишет ориентацию в EXIF,
     EasyOCR её игнорирует → буквы на боку.
  2. Resize — если >2000px по длинной стороне, уменьшить (быстрее);
     если <800px по КОРОТКОЙ, увеличить (мелкий текст).
  3. Grayscale — цвет не нужен, контраст важнее.
  4. Autocontrast (cutoff=2) — убирает пере-экспонированные блики.
  5. Unsharp mask — на муаре/мыле восстанавливает тонкие штрихи.

Не трогает цвет, фон и геометрию (кроме rotate по EXIF).

Возвращает путь к временному JPEG. Caller должен удалить.
"""
import os
import tempfile

from PIL import Image, ImageFilter, ImageOps


MAX_SIDE = 2000
MIN_SIDE = 800


def preprocess_image(image_path: str) -> str:
    """Обрабатывает фото и возвращает путь к временному JPEG.

    Args:
        image_path: путь к исходному фото.

    Returns:
        Путь к временному файлу с обработанным изображением.
        Caller должен удалить после использования.

    Raises:
        FileNotFoundError: исходного файла нет.
        PIL.UnidentifiedImageError: файл не картинка.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(image_path)

    img = Image.open(image_path)

    # 1. EXIF rotate
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        # Если EXIF битый — не падаем, работаем как есть.
        pass

    # 2. Resize
    w, h = img.size
    long_side = max(w, h)
    short_side = min(w, h)
    if long_side > MAX_SIDE:
        # Уменьшаем по длинной стороне
        scale = MAX_SIDE / long_side
        new_size = (int(w * scale), int(h * scale))
        img = img.resize(new_size, Image.LANCZOS)
    elif short_side < MIN_SIDE:
        # Увеличиваем по КОРОТКОЙ стороне — чтобы мелкий текст читался
        scale = MIN_SIDE / short_side
        new_size = (int(w * scale), int(h * scale))
        img = img.resize(new_size, Image.LANCZOS)

    # 3. Grayscale
    img = img.convert("L")

    # 4. Autocontrast
    img = ImageOps.autocontrast(img, cutoff=2)

    # 5. Unsharp mask
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))

    # Сохраняем во временный файл
    fd, out_path = tempfile.mkstemp(suffix=".jpg", prefix="ocr_pre_")
    os.close(fd)
    img.save(out_path, "JPEG", quality=92)
    return out_path