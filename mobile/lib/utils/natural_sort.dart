/// Естественная сортировка строк (c-9-natural-sort).
///
/// Разбивает строку на куски «цифры | не-цифры», сравнивает:
/// - цифровые куски — числами (`TST6701` < `TST6710`);
/// - не-цифровые — лексикографически (`A` < `B`).
///
/// Примеры:
/// - `TST6701` < `TST6702` < ... < `TST6710` (а не `TST6701 < TST67010 < TST6702`);
/// - `TAA-A34076001-001` < `TAA-A34076001-002` < ... < `TAA-A34076001-031`;
/// - `TST124` < `TST6701` (`124` < `6701`).
///
/// Используется для сортировки проб в карточке тары (офлайн- и
/// онлайн-ветки) и в PDF-предпросмотре (`LabelData`).
library;

/// Сравнить две строки естественным образом (числа — числами).
int naturalCompare(String a, String b) {
  final ra = _splitRuns(a);
  final rb = _splitRuns(b);
  final len = ra.length < rb.length ? ra.length : rb.length;
  for (var i = 0; i < len; i++) {
    final c = _compareChunk(ra[i], rb[i]);
    if (c != 0) return c;
  }
  return ra.length.compareTo(rb.length);
}

/// Компаратор для `List<Map<String, dynamic>>` по полю `sample_number`.
/// Удобно передавать в `.sort()`.
int naturalCompareSampleNumber(Map<String, dynamic> a, Map<String, dynamic> b) {
  final sa = a['sample_number'] as String? ?? '';
  final sb = b['sample_number'] as String? ?? '';
  return naturalCompare(sa, sb);
}

/// Разбить на куски «цифры | не-цифры», сохраняя порядок.
/// Пример: `TST6701` → `['TST', '6701']`, `TAA-A34-01` →
/// `['TAA-A', '34', '-', '01']`.
List<String> _splitRuns(String s) {
  final result = <String>[];
  if (s.isEmpty) return result;
  final buf = StringBuffer();
  bool? wasDigit;
  for (final rune in s.runes) {
    final ch = String.fromCharCode(rune);
    final code = rune;
    final isDigit = code >= 0x30 && code <= 0x39;
    if (wasDigit == null || wasDigit == isDigit) {
      buf.write(ch);
      wasDigit = isDigit;
    } else {
      result.add(buf.toString());
      buf.clear();
      buf.write(ch);
      wasDigit = isDigit;
    }
  }
  if (buf.isNotEmpty) result.add(buf.toString());
  return result;
}

/// Сравнить два куска. Если оба — числа, сравнить числами.
/// Иначе — лексикографически (кодпоинт-за-кодпоинтом).
int _compareChunk(String a, String b) {
  final aNum = int.tryParse(a);
  final bNum = int.tryParse(b);
  if (aNum != null && bNum != null) {
    return aNum.compareTo(bNum);
  }
  return a.compareTo(b);
}
