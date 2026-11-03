/// Тесты естественной сортировки (c-9-natural-sort).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/natural_sort.dart';

void main() {
  group('naturalCompare', () {
    test('числа сравниваются числами', () {
      expect(naturalCompare('TST6701', 'TST6702'), lessThan(0));
      expect(naturalCompare('TST6702', 'TST6710'), lessThan(0));
      expect(naturalCompare('TST6710', 'TST6702'), greaterThan(0));
    });

    test('TST6701 < TST6710 (не TST67010 < TST6702)', () {
      final list = ['TST6710', 'TST6702', 'TST6701', 'TST6703'];
      list.sort(naturalCompare);
      expect(list, ['TST6701', 'TST6702', 'TST6703', 'TST6710']);
    });

    test('разный префикс — префикс сравнивается лексикографически', () {
      final list = ['TST124', 'TAA-A34', 'TST6701', 'TST124'];
      list.sort(naturalCompare);
      expect(list.first, 'TAA-A34');
      expect(list.last, 'TST6701');
    });

    test('диапазоны с дефисами и ведущими нулями', () {
      final list = [
        'TAA-A34076001-031',
        'TAA-A34076001-001',
        'TAA-A34076001-002',
      ];
      list.sort(naturalCompare);
      expect(list, [
        'TAA-A34076001-001',
        'TAA-A34076001-002',
        'TAA-A34076001-031',
      ]);
    });

    test('равные строки → 0', () {
      expect(naturalCompare('TST6701', 'TST6701'), 0);
    });

    test('пустая строка < непустой', () {
      expect(naturalCompare('', 'TST6701'), lessThan(0));
    });
  });

  group('naturalCompareSampleNumber', () {
    test('сортирует Map по sample_number', () {
      final list = <Map<String, dynamic>>[
        {'sample_number': 'TST6710'},
        {'sample_number': 'TST6702'},
        {'sample_number': 'TST6701'},
      ];
      list.sort(naturalCompareSampleNumber);
      expect(list.map((m) => m['sample_number']).toList(), [
        'TST6701',
        'TST6702',
        'TST6710',
      ]);
    });

    test('null sample_number не падает', () {
      final list = <Map<String, dynamic>>[
        {'sample_number': 'TST6702'},
        {'sample_number': null},
        {'sample_number': 'TST6701'},
      ];
      expect(() => list.sort(naturalCompareSampleNumber), returnsNormally);
    });
  });
}
