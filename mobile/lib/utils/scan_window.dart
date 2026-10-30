/// Расчёт scanWindow и фильтрация штрихкодов (c-6d, c-6d-fix).
///
/// - `calculateScanWindow` — центрирует квадратное окно [size]×[size]
///   в [available]. Используется и для визуальной рамки, и для
///   параметра `scanWindow` в `MobileScanner`.
///
/// - `barcodeCenterFromCorners` — центр штрихкода по его углам
///   (в системе изображения камеры).
///
/// - `isPointInsideScanWindow` — преобразует точку из системы
///   изображения в систему виджета (модель `BoxFit.cover`) и
///   проверяет, попадает ли она в `scanWindow`.
///
/// Зачем: в `mobile_scanner` 7.4.2 на Android native-`scanWindow`
/// не всегда ограничивает область сканирования (issue #633).
/// Поэтому фильтруем штрихкоды вручную по `barcode.corners`.
library;

import 'dart:ui';

/// Центрирует окно [size]×[size] в [available].
///
/// Координаты — в системе виджета `MobileScanner` (0,0 = левый
/// верхний угол). Если [available] меньше [size], окно всё равно
/// центрируется (левый/верхний угол отрицательный).
Rect calculateScanWindow(Size available, double size) {
  final left = (available.width - size) / 2;
  final top = (available.height - size) / 2;
  return Rect.fromLTWH(left, top, size, size);
}

/// Центр штрихкода по его углам (в системе изображения камеры).
/// Если углов нет — `Offset.zero` (вызывающая сторона пропускает).
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

/// Проверяет, попадает ли точка из системы изображения в [scanWindow]
/// (система виджета).
///
/// Модель preview: `BoxFit.cover` — изображение масштабируется
/// пропорционально, чтобы покрыть виджет, и центрируется; лишнее
/// по одной оси обрезается.
///
/// Защита: если [imageSize] или [widgetSize] пусты — возвращает `true`
/// (не блокируем пользователя, если размеры ещё неизвестны).
bool isPointInsideScanWindow({
  required Offset pointInImage,
  required Size imageSize,
  required Size widgetSize,
  required Rect scanWindow,
}) {
  if (imageSize.isEmpty || widgetSize.isEmpty) return true;

  final scaleX = widgetSize.width / imageSize.width;
  final scaleY = widgetSize.height / imageSize.height;
  // BoxFit.cover: масштаб — максимум, чтобы покрыть обе оси.
  final scale = scaleX > scaleY ? scaleX : scaleY;

  final scaledW = imageSize.width * scale;
  final scaledH = imageSize.height * scale;
  final offsetX = (widgetSize.width - scaledW) / 2;
  final offsetY = (widgetSize.height - scaledH) / 2;

  final wx = pointInImage.dx * scale + offsetX;
  final wy = pointInImage.dy * scale + offsetY;
  return scanWindow.contains(Offset(wx, wy));
}
