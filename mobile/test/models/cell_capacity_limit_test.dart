import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/catalog.dart';

void main() {
  group('CellInfo.capacityLimit', () {
    test('парсит capacity_limit из JSON', () {
      final cell = CellInfo.fromJson({
        'id': 1,
        'code': '1',
        'containers_count': 6,
        'capacity_limit': 10,
      });
      expect(cell.capacityLimit, 10);
    });

    test('без capacity_limit — null', () {
      final cell = CellInfo.fromJson({'id': 2, 'code': '2'});
      expect(cell.capacityLimit, isNull);
    });
  });
}
