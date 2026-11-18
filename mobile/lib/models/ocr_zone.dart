/// Зоны разметки фото OCR (6e-2).
///
/// Координаты — пиксели ОРИГИНАЛА: backend `OcrZoneSerializer` принимает
/// `rect = [x, y, w, h]` (w, h > 0) или `bbox` (4 точки), `source = manual`.
/// Нормализованные (0..1) координаты рисования конвертируются один раз
/// при разметке — отправка не требует декодирования фото.
library;

/// Типы зон — контракт backend `OcrTask.ZONE_TYPES`.
class OcrZoneTypes {
  static const String workOrderCoded = 'work_order_coded';
  static const String workOrderIncoming = 'work_order_incoming';
  static const String containerNumber = 'container_number';
  static const String researchType = 'research_type';
  static const String sample = 'sample';
  static const String well = 'well';

  /// Порядок в UI выбора типа.
  static const List<String> order = [
    workOrderCoded,
    workOrderIncoming,
    containerNumber,
    researchType,
    sample,
    well,
  ];

  /// Подписи для UI (русский, как в web OCR_ZONE_LABELS).
  static const Map<String, String> labels = {
    workOrderCoded: 'Н/З (текущий)',
    workOrderIncoming: 'Н/З (входящий)',
    containerNumber: 'Номер тары',
    researchType: 'Тип исследования',
    sample: 'Проба',
    well: 'Скважина',
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
