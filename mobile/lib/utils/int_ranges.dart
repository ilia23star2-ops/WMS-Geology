/// Парсер списков int с диапазонами (c-7f).
///
/// Используется в `RangeEditDialog` (skip/selected sequences).
/// Формат: "2, 4-7, 9" → [2, 4, 5, 6, 7, 9].
/// Разделители: `,` `;` пробел. Диапазон: `a-b`.
library;

/// Разобрать строку с диапазонами. Ошибки — игнорируются.
List<int> parseIntRanges(String input) {
  final text = input.trim();
  if (text.isEmpty) return const [];

  final result = <int>[];
  final chunks = text.split(RegExp(r'[\s,;]+'));

  for (final chunk in chunks) {
    if (chunk.isEmpty) continue;
    if (chunk.contains('-')) {
      final parts = chunk.split('-');
      if (parts.length != 2) continue;
      final from = int.tryParse(parts[0]);
      final to = int.tryParse(parts[1]);
      if (from == null || to == null) continue;
      final lo = from <= to ? from : to;
      final hi = from <= to ? to : from;
      for (var i = lo; i <= hi; i++) {
        result.add(i);
      }
    } else {
      final n = int.tryParse(chunk);
      if (n != null) result.add(n);
    }
  }

  result.sort();
  return result;
}

/// Форматировать список int как диапазоны: [1,2,3,5,7,8,9] → "1-3, 5, 7-9".
String formatIntRanges(List<int> values) {
  if (values.isEmpty) return '';
  final sorted = [...values]..sort();
  final parts = <String>[];
  var start = sorted[0];
  var prev = sorted[0];

  for (var i = 1; i < sorted.length; i++) {
    final v = sorted[i];
    if (v == prev + 1) {
      prev = v;
    } else {
      parts.add(start == prev ? '$start' : '$start-$prev');
      start = v;
      prev = v;
    }
  }
  parts.add(start == prev ? '$start' : '$start-$prev');
  return parts.join(', ');
}
