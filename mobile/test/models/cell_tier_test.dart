import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/catalog.dart';

void main() {
  group('CellInfo.tier', () {
    test('парсит tier из JSON', () {
      final cell = CellInfo.fromJson({'id': 4, 'code': '1', 'tier': 10});
      expect(cell.tier, 10);
    });

    test('без tier — ноль', () {
      final cell = CellInfo.fromJson({'id': 5, 'code': '2'});
      expect(cell.tier, 0);
    });
  });
}
