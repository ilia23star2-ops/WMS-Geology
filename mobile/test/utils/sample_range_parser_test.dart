/// Тесты `parseSampleInput` + `buildSampleNumbers` + `parseIntRanges` (c-7f).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/int_ranges.dart';
import 'package:wms_geology_mobile/utils/sample_range_parser.dart';

void main() {
  const labPrefixes = ['TAA-A', 'TAA-B'];
  const sitePatterns = ['TST', 'TAA'];

  group('parseSampleInput', () {
    test('диапазон TAA-A34076001-031', () {
      final r = parseSampleInput(
        'TAA-A34076001-031',
        laboratoryPrefixes: labPrefixes,
        siteMatchPatterns: sitePatterns,
        hasIncomingWorkOrder: true,
      );
      expect(r.ok, isTrue);
      expect(r.value!.prefix, 'TAA-A');
      expect(r.value!.middle, '34076');
      expect(r.value!.sequenceFrom, 1);
      expect(r.value!.sequenceTo, 31);
      expect(r.value!.sequenceDigits, 3);
      expect(r.value!.wellName, isNull); // hasIncoming
    });

    test('одна проба TST124001', () {
      final r = parseSampleInput(
        'TST124001',
        laboratoryPrefixes: labPrefixes,
        siteMatchPatterns: sitePatterns,
        hasIncomingWorkOrder: false,
      );
      expect(r.ok, isTrue);
      expect(r.value!.prefix, 'TST');
      expect(r.value!.middle, '124');
      expect(r.value!.sequenceFrom, 1);
      expect(r.value!.sequenceTo, 1);
      expect(r.value!.wellName, '124');
    });

    test('без вх. Н/З — wellName = middle', () {
      final r = parseSampleInput(
        'TAA-A34076001-005',
        laboratoryPrefixes: labPrefixes,
        siteMatchPatterns: sitePatterns,
        hasIncomingWorkOrder: false,
      );
      expect(r.value!.wellName, '34076');
    });

    test('с вх. Н/З — wellName = null', () {
      final r = parseSampleInput(
        'TAA-A34076001-005',
        laboratoryPrefixes: labPrefixes,
        siteMatchPatterns: sitePatterns,
        hasIncomingWorkOrder: true,
      );
      expect(r.value!.wellName, isNull);
    });

    test('префикс не найден', () {
      final r = parseSampleInput(
        'XXX34076001-005',
        laboratoryPrefixes: labPrefixes,
        siteMatchPatterns: sitePatterns,
        hasIncomingWorkOrder: false,
      );
      expect(r.ok, isFalse);
      expect(r.error, contains('Префикс'));
    });

    test('пустой ввод', () {
      final r = parseSampleInput(
        '   ',
        laboratoryPrefixes: labPrefixes,
        siteMatchPatterns: sitePatterns,
        hasIncomingWorkOrder: false,
      );
      expect(r.ok, isFalse);
      expect(r.error, contains('Введите'));
    });

    test('начало больше конца', () {
      final r = parseSampleInput(
        'TAA-A34076010-001',
        laboratoryPrefixes: labPrefixes,
        siteMatchPatterns: sitePatterns,
        hasIncomingWorkOrder: false,
      );
      expect(r.ok, isFalse);
      expect(r.error, contains('больше'));
    });

    test('самый длинный префикс имеет приоритет', () {
      final r = parseSampleInput(
        'TAA-A34076001-005',
        laboratoryPrefixes: ['TAA-A'],
        siteMatchPatterns: ['TAA'],
        hasIncomingWorkOrder: false,
      );
      expect(r.value!.prefix, 'TAA-A');
    });
  });

  group('buildSampleNumbers', () {
    test('диапазон 001–005', () {
      final nums = buildSampleNumbers(
        const ParsedSampleRange(
          prefix: 'TST',
          middle: '124',
          sequenceFrom: 1,
          sequenceTo: 5,
          sequenceDigits: 3,
          wellName: null,
        ),
      );
      expect(nums, [
        'TST124001',
        'TST124002',
        'TST124003',
        'TST124004',
        'TST124005',
      ]);
    });
  });

  group('parseIntRanges', () {
    test('пустая строка', () {
      expect(parseIntRanges(''), []);
    });

    test('одиночные через запятую', () {
      expect(parseIntRanges('2, 4, 7'), [2, 4, 7]);
    });

    test('с диапазонами', () {
      expect(parseIntRanges('2, 4-7, 9'), [2, 4, 5, 6, 7, 9]);
    });

    test('пробелы как разделители', () {
      expect(parseIntRanges('2 4-7 9'), [2, 4, 5, 6, 7, 9]);
    });
  });

  group('formatIntRanges', () {
    test('пустой', () {
      expect(formatIntRanges([]), '');
    });

    test('подряд', () {
      expect(formatIntRanges([1, 2, 3, 5, 7, 8, 9]), '1-3, 5, 7-9');
    });
  });
}
