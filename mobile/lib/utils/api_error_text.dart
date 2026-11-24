/// Человекочитаемый текст ошибки API (пачка sync-errors-13).
///
/// DRF на ошибку валидации отдаёт `{"поле": ["причина"]}`, а не
/// `{"detail": "..."}`. Раньше клиент видел только `detail` и для 400
/// показывал «Ошибка сети» — настоящая причина была скрыта.
library;

import 'field_labels.dart';

/// Разбирает тело ошибки в текст для человека.
///
/// [data] — распарсенное тело ответа (может быть null).
/// [statusCode] — код ответа; null означает отсутствие связи.
String apiErrorText(Map<String, dynamic>? data, {int? statusCode}) {
  final fallback = _fallbackFor(statusCode);
  if (data == null || data.isEmpty) return fallback;

  final detail = data['detail'];
  if (detail is String && detail.isNotEmpty) return detail;
  final err = data['error'];
  if (err is String && err.isNotEmpty) return err;

  final parts = <String>[];
  _collect(data, '', parts);
  if (parts.isEmpty) return fallback;
  return parts.join('; ');
}

void _collect(Map<String, dynamic> map, String prefix, List<String> out) {
  for (final entry in map.entries) {
    final key = entry.key;
    // Общие ошибки поля не имеют — показываем без префикса.
    final structural = entry.value is Map<String, dynamic> ||
        (entry.value is List &&
            (entry.value as List).any((x) => x is Map<String, dynamic>));
    final translated = fieldLabel(key);
    // Структурные ключи без перевода в путь не берём.
    final label =
        (key == 'non_field_errors' || (structural && translated == key))
        ? ''
        : translated;
    final path = label.isEmpty
        ? prefix
        : (prefix.isEmpty ? label : '$prefix · $label');
    final value = entry.value;

    if (value is String) {
      out.add(path.isEmpty ? value : '$path: $value');
    } else if (value is List) {
      for (final item in value) {
        if (item is String) {
          out.add(path.isEmpty ? item : '$path: $item');
        } else if (item is Map<String, dynamic>) {
          _collect(item, path, out);
        }
      }
    } else if (value is Map<String, dynamic>) {
      _collect(value, path, out);
    }
  }
}

String _fallbackFor(int? statusCode) {
  if (statusCode == null) return 'Нет связи с сервером';
  if (statusCode == 400) return 'Сервер отклонил данные (400)';
  if (statusCode == 401) return 'Нужно войти заново';
  if (statusCode == 403) return 'Недостаточно прав';
  if (statusCode == 404) return 'Запись не найдена на сервере';
  if (statusCode == 409) return 'Конфликт данных на сервере';
  if (statusCode >= 500) return 'Ошибка на сервере ($statusCode)';
  return 'Ошибка запроса ($statusCode)';
}
