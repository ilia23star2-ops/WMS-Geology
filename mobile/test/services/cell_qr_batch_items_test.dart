import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/catalog_service.dart';

void main() {
  group('cellQrBatchItems', () {
    test('строит пункты CELL по id', () {
      expect(cellQrBatchItems([1, 2]), [
        {'type': 'CELL', 'id': 1},
        {'type': 'CELL', 'id': 2},
      ]);
    });

    test('пустой список — пустые пункты', () {
      expect(cellQrBatchItems([]), isEmpty);
    });
  });
}
