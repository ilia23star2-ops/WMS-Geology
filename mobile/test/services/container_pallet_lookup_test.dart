/// Тест выбора поддона ячейки (topology-cellcontents-fix).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/container_service.dart';

void main() {
  group('ContainerService.firstPalletId', () {
    test('берёт id первого поддона', () {
      expect(
        ContainerService.firstPalletId({
          'results': [
            {'id': 5},
          ],
        }),
        5,
      );
    });

    test('пустой список → null', () {
      expect(ContainerService.firstPalletId({'results': []}), isNull);
    });

    test('null data → null', () {
      expect(ContainerService.firstPalletId(null), isNull);
    });
  });
}
