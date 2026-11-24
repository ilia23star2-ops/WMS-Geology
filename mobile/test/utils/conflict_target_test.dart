/// Тесты адреса записи для поиска операции в очереди (conflict-wire-8).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/conflict_target.dart';

void main() {
  group('recordPatchEndpoint', () {
    test('тара → адрес правки', () {
      expect(recordPatchEndpoint('container', 42), '/storage/containers/42/');
    });

    test('проба → адрес правки', () {
      expect(recordPatchEndpoint('sample', 7), '/samples/7/');
    });

    test('офлайн-запись с отрицательным ID тоже адресуется', () {
      expect(recordPatchEndpoint('container', -5), '/storage/containers/-5/');
      expect(recordPatchEndpoint('sample', -3), '/samples/-3/');
    });

    test('неизвестная сущность → null, без падения', () {
      expect(recordPatchEndpoint('site', 3), isNull);
      expect(recordPatchEndpoint('', 1), isNull);
    });
  });
}
