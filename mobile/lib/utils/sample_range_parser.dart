/// Парсер строки ввода проб (c-7f).
///
/// Порт `web/src/utils/parseSampleInput.ts` — точно та же логика.
///
/// Формат:
///   `<prefix><base>-<range>`   — диапазон (range = конец)
///   `<prefix><base>`           — одна проба (seq = последние 3 цифры)
///
/// Примеры:
///   `TAA-A34076001-031` → prefix=TAA-A, middle=34076, seq 001–031, digits=3
///   `TST124001-005`     → prefix=TST,   middle=124,   seq 001–005, digits=3
///   `TAA-A34076001`     → prefix=TAA-A, middle=34076, seq 001,    digits=3
///
/// Префикс ищется в двух справочниках (приоритет — самый длинный
/// совпадающий, регистронезависимо):
///   1) `Laboratory.prefixes`
///   2) `Site.match_patterns`
///
/// `wellName`:
///   - если есть входящее Н/З → null (шифрованная проба);
///   - иначе → middle (нешифрованная, скважина = «середина»).
library;

class ParsedSampleRange {
  const ParsedSampleRange({
    required this.prefix,
    required this.middle,
    required this.sequenceFrom,
    required this.sequenceTo,
    required this.sequenceDigits,
    required this.wellName,
  });

  final String prefix;
  final String middle;
  final int sequenceFrom;
  final int sequenceTo;
  final int sequenceDigits;
  final String? wellName;
}

class ParseResult {
  const ParseResult.ok(this.value) : error = null;
  const ParseResult.fail(this.error) : value = null;

  final ParsedSampleRange? value;
  final String? error;

  bool get ok => value != null;
}

const int _defaultDigits = 3;
const int _maxRange = 1000;

/// Самый длинный совпадающий префикс из [candidates] (начало строки,
/// регистронезависимо).
String? _detectPrefix(String input, List<String> candidates) {
  final upper = input.toUpperCase();
  String? best;
  for (final c in candidates) {
    if (c.isEmpty) continue;
    if (upper.startsWith(c.toUpperCase())) {
      if (best == null || c.length > best.length) best = c;
    }
  }
  return best;
}

int? _parseNonNegativeInt(String s) {
  if (!RegExp(r'^\d+$').hasMatch(s)) return null;
  final n = int.tryParse(s);
  if (n == null || n < 0) return null;
  return n;
}

ParseResult parseSampleInput(
  String rawInput, {
  required List<String> laboratoryPrefixes,
  required List<String> siteMatchPatterns,
  required bool hasIncomingWorkOrder,
}) {
  final input = rawInput.trim();
  if (input.isEmpty) {
    return const ParseResult.fail('Введите номер пробы.');
  }

  // 1. Префикс.
  final candidates = [...laboratoryPrefixes, ...siteMatchPatterns];
  final prefix = _detectPrefix(input, candidates);
  if (prefix == null) {
    return const ParseResult.fail(
      'Префикс не найден в справочниках лабораторий и участков.',
    );
  }

  // 2. Тело после префикса.
  final body = input.substring(prefix.length);
  if (body.isEmpty) {
    return const ParseResult.fail('После префикса нет номера.');
  }

  // 3. Разбить на base + range.
  final parts = body.split('-');
  if (parts.length > 2) {
    return const ParseResult.fail('В номере больше одного дефиса.');
  }

  final base = parts[0];
  if (base.isEmpty) {
    return const ParseResult.fail('Пустое тело номера.');
  }

  late int sequenceDigits;
  late String middle;
  late int sequenceFrom;
  late int sequenceTo;

  if (parts.length == 2) {
    // Диапазон: base-end.
    final rangeStr = parts[1];
    if (rangeStr.isEmpty) {
      return const ParseResult.fail('Пустой диапазон после дефиса.');
    }
    final end = _parseNonNegativeInt(rangeStr);
    if (end == null) {
      return const ParseResult.fail('Конец диапазона должен быть числом.');
    }
    sequenceDigits = rangeStr.length;
    if (base.length < sequenceDigits) {
      return const ParseResult.fail('Слишком короткое тело номера.');
    }
    middle = base.substring(0, base.length - sequenceDigits);
    final startStr = base.substring(base.length - sequenceDigits);
    final start = _parseNonNegativeInt(startStr);
    if (start == null) {
      return const ParseResult.fail('Начало диапазона не число.');
    }
    if (start > end) {
      return const ParseResult.fail('Начало диапазона больше конца.');
    }
    sequenceFrom = start;
    sequenceTo = end;
  } else {
    // Одна проба: последние 3 цифры — sequence.
    if (base.length < _defaultDigits) {
      return const ParseResult.fail('Слишком короткий номер пробы.');
    }
    sequenceDigits = _defaultDigits;
    middle = base.substring(0, base.length - sequenceDigits);
    final seqStr = base.substring(base.length - sequenceDigits);
    final seq = _parseNonNegativeInt(seqStr);
    if (seq == null) {
      return const ParseResult.fail('Порядковый номер не число.');
    }
    sequenceFrom = seq;
    sequenceTo = seq;
  }

  if (middle.isEmpty) {
    return const ParseResult.fail('Пустое значение скважины/серии.');
  }

  final count = sequenceTo - sequenceFrom + 1;
  if (count > _maxRange) {
    return ParseResult.fail('Слишком большой диапазон (>$_maxRange проб).');
  }

  final wellName = hasIncomingWorkOrder ? null : middle;

  return ParseResult.ok(
    ParsedSampleRange(
      prefix: prefix,
      middle: middle,
      sequenceFrom: sequenceFrom,
      sequenceTo: sequenceTo,
      sequenceDigits: sequenceDigits,
      wellName: wellName,
    ),
  );
}

/// Предвычислить полные номера проб.
List<String> buildSampleNumbers(ParsedSampleRange parsed) {
  final result = <String>[];
  for (var i = parsed.sequenceFrom; i <= parsed.sequenceTo; i++) {
    final seq = i.toString().padLeft(parsed.sequenceDigits, '0');
    result.add('${parsed.prefix}${parsed.middle}$seq');
  }
  return result;
}
