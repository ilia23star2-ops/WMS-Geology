/// Тесты `NamedCatalog.fromJson` (c-2d-2c-fix-2).
///
/// Покрывает `fullAddress` — отдельное поле из `json['full_address']`,
/// приоритет `label` не меняется.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/catalog.dart';

void main() {
  group('NamedCatalog.fromJson (c-2d-2c-fix-2)', () {
    test('Cell с full_address: label=code, fullAddress=полный путь', () {
      final c = NamedCatalog.fromJson({
        'id': 5,
        'code': '2',
        'full_address': 'В4/1/1/B/2',
        'number': 2,
      });
      expect(c.id, 5);
      expect(c.label, '2'); // label — как было (короткий код)
      expect(c.fullAddress, 'В4/1/1/B/2');
    });

    test('Room без full_address: fullAddress = null', () {
      final c = NamedCatalog.fromJson({'id': 1, 'name': 'Комната 1'});
      expect(c.label, 'Комната 1');
      expect(c.fullAddress, isNull);
    });

    test('Rack без full_address: fullAddress = null', () {
      final c = NamedCatalog.fromJson({'id': 2, 'code': 'A'});
      expect(c.label, 'A');
      expect(c.fullAddress, isNull);
    });

    test('full_address пустая строка → fullAddress = null', () {
      final c = NamedCatalog.fromJson({
        'id': 5,
        'code': '2',
        'full_address': '',
      });
      expect(c.fullAddress, isNull);
    });

    test('name+code приоритетнее full_address для label', () {
      final c = NamedCatalog.fromJson({
        'id': 1,
        'name': 'Комната 1',
        'code': 'R1',
        'full_address': 'R1',
      });
      expect(c.label, 'R1 — Комната 1');
      expect(c.fullAddress, 'R1');
    });
  });
}
