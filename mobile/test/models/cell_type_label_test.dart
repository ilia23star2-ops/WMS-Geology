/// Тест русского типа ячейки (topology-chips-fix).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/catalog.dart';

void main() {
  group('CellInfo.cellTypeLabel', () {
    test('STANDARD → Обычная (как в вебе)', () {
      final cell = CellInfo.fromJson({
        'id': 1,
        'code': '1',
        'cell_type': 'STANDARD',
      });
      expect(cell.cellTypeLabel, 'Обычная');
    });

    test('неизвестный тип → как есть', () {
      final cell = CellInfo.fromJson({
        'id': 2,
        'code': '2',
        'cell_type': 'OVERSIZED',
      });
      expect(cell.cellTypeLabel, 'OVERSIZED');
    });

    test('тип отсутствует → прочерк', () {
      final cell = CellInfo.fromJson({'id': 3, 'code': '3'});
      expect(cell.cellTypeLabel, '—');
    });
  });
}
