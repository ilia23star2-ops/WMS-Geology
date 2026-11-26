import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/catalog.dart';

void main() {
  group('CellInfo.containersCount', () {
    test('парсит containers_count из JSON', () {
      final cell = CellInfo.fromJson({
        'id': 1,
        'code': '1',
        'full_address': 'B4 / 1 / 1 / A / 1',
        'cell_type': 'STANDARD',
        'is_active': true,
        'pallet_id': 5,
        'pallet_status': 'ACTIVE',
        'containers_count': 6,
      });
      expect(cell.containersCount, 6);
    });

    test('без containers_count — 0', () {
      final cell = CellInfo.fromJson({'id': 2, 'code': '2'});
      expect(cell.containersCount, 0);
    });
  });
}
