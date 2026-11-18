/// Зоны разметки фото OCR (6e-2, 6e-2-site).
///
/// Координаты — пиксели ОРИГИНАЛА: backend `OcrZoneSerializer` принимает
/// `rect = [x, y, w, h]` (w, h > 0) или `bbox` (4 точки), `source = manual`.
/// Нормализованные (0..1) координаты рисования конвертируются один раз
/// при разметке — отправка не требует декодирования фото.
library;

import 'dart:math' as math;

/// Типы зон — контракт backend `OcrTask.ZONE_TYPES`.
class OcrZoneTypes {
  static const String workOrderCoded = 'work_order_coded';
  static const String workOrderIncoming = 'work_order_incoming';
  static const String containerNumber = 'container_number';
  static const String researchType = 'research_type';
  static const String sample = 'sample';
  static const String well = 'well';
  static const String site = 'site';

  /// Полный контракт типов (включая legacy well).
  static const List<String> order = [
    workOrderCoded,
    workOrderIncoming,
    containerNumber,
    researchType,
    sample,
    well,
    site,
  ];

  /// Порядок в UI разметки: без well, с участком (6e-2-site).
  static const List<String> uiOrder = [
    workOrderCoded,
    workOrderIncoming,
    containerNumber,
    researchType,
    sample,
    site,
  ];

  /// Подписи для UI (русский, как в web OCR_ZONE_LABELS).
  static const Map<String, String> labels = {
    workOrderCoded: 'Н/З (текущий)',
    workOrderIncoming: 'Н/З (входящий)',
    containerNumber: 'Номер тары',
    researchType: 'Тип исследования',
    sample: 'Пробы',
    well: 'Скважина',
    site: 'Участок',
  };
}

/// Одна размеченная зона в пикселях оригинала.
class OcrZoneMark {
  final String type;
  final double x;
  final double y;
  final double w;
  final double h;

  const OcrZoneMark({
    required this.type,
    required this.x,
    required this.y,
    required this.w,
    required this.h,
  });

  /// Payload для `zones_json` (backend сам развернёт rect в bbox).
  Map<String, dynamic> toPayload() => {
    'type': type,
    'rect': [x, y, w, h],
    'source': 'manual',
  };
}

/// Нормализованный rect (0..1) → пиксели оригинала.
///
/// Обрезает по границам кадра; вырожденные (нулевые) зоны и нулевой
/// размер картинки → `null` (backend требует w, h > 0).
OcrZoneMark? zoneFromNormalized({
  required String type,
  required double left,
  required double top,
  required double width,
  required double height,
  required int imageWidth,
  required int imageHeight,
}) {
  if (imageWidth <= 0 || imageHeight <= 0) return null;
  final double l = left.clamp(0.0, 1.0);
  final double t = top.clamp(0.0, 1.0);
  final double r = (left + width).clamp(0.0, 1.0);
  final double b = (top + height).clamp(0.0, 1.0);
  final double w = (r - l) * imageWidth;
  final double h = (b - t) * imageHeight;
  if (w <= 0 || h <= 0) return null;
  return OcrZoneMark(
    type: type,
    x: l * imageWidth,
    y: t * imageHeight,
    w: w,
    h: h,
  );
}

/// Авторазграничение зон (6e-2-fix4): новая зона не должна налеза на
/// существующие — между ними остаётся зазор `gap` (пиксели оригинала).
///
/// Алгоритм: для каждой существующей зоны, расширенной на `gap`, если
/// кандидат её пересекает — обрезаем кандидата по оси наименьшего
/// перекрытия, оставляя ту часть, что дальше от центра существующей.
/// Только сужение (без сдвига наружу) — новые пересечения не появляются.
/// Если кандидат вырождается (полностью внутри чужой зоны) → `null`.
OcrZoneMark? separateZone(
  OcrZoneMark candidate,
  List<OcrZoneMark> existing, {
  double gap = 6,
}) {
  double x = candidate.x;
  double y = candidate.y;
  double w = candidate.w;
  double h = candidate.h;
  for (final e in existing) {
    final ex = e.x - gap;
    final ey = e.y - gap;
    final ew = e.w + gap * 2;
    final eh = e.h + gap * 2;
    final ox = math.min(x + w, ex + ew) - math.max(x, ex);
    final oy = math.min(y + h, ey + eh) - math.max(y, ey);
    if (ox <= 0 || oy <= 0) continue; // нет пересечения с зазором
    if (ox < oy) {
      // режем по горизонтали: оставляем часть дальше от центра e
      if (x + w / 2 < e.x + e.w / 2) {
        w = ex - x;
      } else {
        final nx = ex + ew;
        w = (x + w) - nx;
        x = nx;
      }
    } else {
      // режем по вертикали
      if (y + h / 2 < e.y + e.h / 2) {
        h = ey - y;
      } else {
        final ny = ey + eh;
        h = (y + h) - ny;
        y = ny;
      }
    }
    if (w <= 0 || h <= 0) return null;
  }
  return OcrZoneMark(type: candidate.type, x: x, y: y, w: w, h: h);
}

/// Рамка отображения фото по BoxFit.contain (6e-2c).
///
/// связывает три системы координат: пиксели оригинала ↔ координаты
/// области просмотра ↔ нормализованные 0..1. Чистая математика, без UI.
class ImageFrame {
  final double scale;
  final double offsetX;
  final double offsetY;
  final double displayWidth;
  final double displayHeight;

  const ImageFrame({
    required this.scale,
    required this.offsetX,
    required this.offsetY,
    required this.displayWidth,
    required this.displayHeight,
  });

  /// Вырожденные размеры → нулевая рамка (рисование запрещено).
  factory ImageFrame.contain({
    required int imageWidth,
    required int imageHeight,
    required double areaWidth,
    required double areaHeight,
  }) {
    if (imageWidth <= 0 ||
        imageHeight <= 0 ||
        areaWidth <= 0 ||
        areaHeight <= 0) {
      return const ImageFrame(
        scale: 0,
        offsetX: 0,
        offsetY: 0,
        displayWidth: 0,
        displayHeight: 0,
      );
    }
    final double sx = areaWidth / imageWidth;
    final double sy = areaHeight / imageHeight;
    final double s = sx < sy ? sx : sy;
    final double dw = imageWidth * s;
    final double dh = imageHeight * s;
    return ImageFrame(
      scale: s,
      offsetX: (areaWidth - dw) / 2,
      offsetY: (areaHeight - dh) / 2,
      displayWidth: dw,
      displayHeight: dh,
    );
  }

  /// Пиксели оригинала → координаты области (для overlay зон).
  double toAreaX(double x) => offsetX + x * scale;
  double toAreaY(double y) => offsetY + y * scale;

  /// Координаты области → нормализованные 0..1 (clamp по границам фото).
  double toNormalizedX(double areaX) => displayWidth <= 0
      ? 0
      : ((areaX - offsetX) / displayWidth).clamp(0.0, 1.0);
  double toNormalizedY(double areaY) => displayHeight <= 0
      ? 0
      : ((areaY - offsetY) / displayHeight).clamp(0.0, 1.0);
}
