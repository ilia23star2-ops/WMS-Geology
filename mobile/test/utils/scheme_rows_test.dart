import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/catalog.dart';
import 'package:wms_geology_mobile/utils/scheme_rows.dart';

void main() {
  group('occupancyKey', () {
    test('пусто — empty', () {
      expect(occupancyKey(0, 10), 'empty');
    });

    test('без лимита — filled', () {
      expect(occupancyKey(3, null), 'filled');
    });

    test('>=70% лимита — near', () {
      expect(occupancyKey(7, 10), 'near');
    });

    test('>=100% лимита — full', () {
      expect(occupancyKey(10, 10), 'full');
    });
  });

  group('buildSchemeRows', () {
    test('строки D→A, ячейки в числовом порядке', () {
      final tiers = [
        const NamedCatalog(id: 1, label: 'A'),
        const NamedCatalog(id: 2, label: 'B'),
      ];
      final cells = {
        1: [
          const CellInfo(id: 11, label: '2'),
          const CellInfo(id: 10, label: '1'),
        ],
      };
      final rows = buildSchemeRows(tiers, cells);
      expect(rows.first.label, 'B');
      expect(rows.last.cells.first.id, 10);
    });
  });
}
