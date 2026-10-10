/// Парсер QR-payload'ов.
///
/// Формат: `WMSG:<ТИП>:<ID>`, где ТИП — один из:
///   `CONTAINER`, `CELL`, `SECTION`, `SAMPLE`.
///
/// Чистая логика, без I/O. Тесты — `test/qr_parser_test.dart`.
library;

enum QrEntityType { container, cell, section, sample }

const Map<QrEntityType, String> qrEntityTypeLabels = {
  QrEntityType.container: 'Тара',
  QrEntityType.cell: 'Ячейка',
  QrEntityType.section: 'Секция',
  QrEntityType.sample: 'Проба',
};

/// Префикс всех QR-payload'ов проекта.
const String qrPrefix = 'WMSG';

/// Результат разбора payload.
///
/// `isValid == true` — успешно. Иначе `error` содержит причину.
class QrParseResult {
  const QrParseResult._({
    this.type,
    this.id,
    this.error,
    required this.raw,
  });

  factory QrParseResult.success({
    required QrEntityType type,
    required int id,
    required String raw,
  }) =>
      QrParseResult._(type: type, id: id, raw: raw);

  factory QrParseResult.failure(String error, String raw) =>
      QrParseResult._(error: error, raw: raw);

  final QrEntityType? type;
  final int? id;
  final String? error;
  final String raw;

  bool get isValid => type != null && id != null && error == null;

  @override
  String toString() => isValid
      ? 'QrParseResult(${type!.name}: $id)'
      : 'QrParseResult(error: $error)';
}

QrParseResult parseQrPayload(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) {
    return QrParseResult.failure('Пустой QR-код.', raw);
  }

  final parts = trimmed.split(':');
  if (parts.length != 3) {
    return QrParseResult.failure(
      'Неверный формат. Ожидается $qrPrefix:<ТИП>:<ID>.',
      raw,
    );
  }

  if (parts[0] != qrPrefix) {
    return QrParseResult.failure('Не $qrPrefix-код.', raw);
  }

  final typeStr = parts[1].toUpperCase();
  final QrEntityType type;
  switch (typeStr) {
    case 'CONTAINER':
      type = QrEntityType.container;
      break;
    case 'CELL':
      type = QrEntityType.cell;
      break;
    case 'SECTION':
      type = QrEntityType.section;
      break;
    case 'SAMPLE':
      type = QrEntityType.sample;
      break;
    default:
      return QrParseResult.failure('Неизвестный тип: $typeStr', raw);
  }

  final id = int.tryParse(parts[2]);
  if (id == null || id <= 0) {
    return QrParseResult.failure('Неверный ID: ${parts[2]}', raw);
  }

  return QrParseResult.success(type: type, id: id, raw: trimmed);
}