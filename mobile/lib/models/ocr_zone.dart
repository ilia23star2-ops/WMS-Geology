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
