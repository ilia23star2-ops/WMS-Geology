/// Тест модели ячейки с метаданными (topology-parity-1).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/catalog.dart';

void main() {
  group('CellInfo.fromJson', () {
    test('парсит метаданные ячейки', () {
      final cell = CellInfo.fromJson({
        'id': 3,
        'code': '3',
        'full_address': 'B4 / R1 / S1 / A / 3',
        'cell_type': 'STANDARD',
        'is_active': true,
        'pallet_id': 5,
        'pallet_status': 'ACTIVE',
      });
      expect(cell.id, 3);
      expect(cell.label, '3');
      expect(cell.fullAddress, 'B4 / R1 / S1 / A / 3');
      expect(cell.cellType, 'STANDARD');
      expect(cell.isActive, true);
      expect(cell.palletId, 5);
      expect(cell.palletStatus, 'ACTIVE');
    });

    test('отсутствующие метаданные → null, label из full_address', () {
      final cell = CellInfo.fromJson({
        'id': 9,
        'full_address': 'B4 / R1 / S1 / B / 1',
      });
      expect(cell.label, 'B4 / R1 / S1 / B / 1');
      expect(cell.cellType, isNull);
      expect(cell.isActive, isNull);
      expect(cell.palletId, isNull);
      expect(cell.palletStatus, isNull);
    });

    test('чипы: активность и поддон', () {
      final active = CellInfo.fromJson({
        'id': 1,
        'code': '1',
        'is_active': false,
        'pallet_id': 5,
        'pallet_status': 'ACTIVE',
      });
      expect(active.activeLabel, 'Отключена');
      expect(active.palletChipLabel, 'Поддон #5 · активен');
      final noPallet = CellInfo.fromJson({'id': 2, 'code': '2'});
      expect(noPallet.activeLabel, 'Активна');
      expect(noPallet.palletChipLabel, isNull);
    });
  });
}
