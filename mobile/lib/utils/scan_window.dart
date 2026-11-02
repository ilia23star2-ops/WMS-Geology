/// Расчёт scanWindow и конвертация координат (c-6d, c-6d-fix, c-6d-fix-3).
///
/// `Barcode.corners` в `mobile_scanner 7.4.2` на Android приходят в системе
/// **rotated** изображения, если камера повёрнута: `capture.size` возвращает
/// размер сенсора (w, h), а corners — в системе (h, w). Определяем swap
/// по соотношению widget ↔ capture.size.
library;

import 'dart:ui';

/// Центрирует окно [size]×[size] в [available].
Rect calculateScanWindow(Size available, double size) {
  final left = (available.width - size) / 2;
  final top = (available.height - size) / 2;
  return Rect.fromLTWH(left, top, size, size);
}

/// Центр штрихкода по его углам (уже в системе, переданной вызывающим).
Offset barcodeCenterFromCorners(List<Offset> corners) {
  if (corners.isEmpty) return Offset.zero;
  double sx = 0;
  double sy = 0;
  for (final c in corners) {
    sx += c.dx;
    sy += c.dy;
  }
  return Offset(sx / corners.length, sy / corners.length);
}

/// Конвертирует точку из системы изображения камеры в систему виджета
/// (модель `BoxFit.cover`).
///
/// c-6d-fix-3: если widget landscape, а `capture.size` portrait —
/// значит `corners` в системе `(h, w)`, а `capture.size` в `(w, h)`.
/// Делаем swap effectiveSize, сами координаты уже в этой системе.
Offset mapImageToWidgetFrame({
  required Offset pointInImage,
  required Size imageSize,
  required Size widgetSize,
}) {
  var effectiveSize = imageSize;
  if (widgetSize.width > widgetSize.height &&
      imageSize.height > imageSize.width) {
    effectiveSize = Size(imageSize.height, imageSize.width);
  }

  final scaleX = widgetSize.width / effectiveSize.width;
  final scaleY = widgetSize.height / effectiveSize.height;
  final scale = scaleX > scaleY ? scaleX : scaleY;

  final scaledW = effectiveSize.width * scale;
  final scaledH = effectiveSize.height * scale;
  final offsetX = (widgetSize.width - scaledW) / 2;
  final offsetY = (widgetSize.height - scaledH) / 2;

  return Offset(
    pointInImage.dx * scale + offsetX,
    pointInImage.dy * scale + offsetY,
  );
}

/// Проверяет, попадает ли точка из системы изображения в [scanWindow]
/// (система виджета).
///
/// Защита: если размеры пусты — `true` (не блокируем, если ещё неизвестны).
bool isPointInsideScanWindow({
  required Offset pointInImage,
  required Size imageSize,
  required Size widgetSize,
  required Rect scanWindow,
}) {
  if (imageSize.isEmpty || widgetSize.isEmpty) return true;
  final mapped = mapImageToWidgetFrame(
    pointInImage: pointInImage,
    imageSize: imageSize,
    widgetSize: widgetSize,
  );
  return scanWindow.contains(mapped);
}
