/// Тесты подготовки строк кэша проб (пачка conflict-samples-12).
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sample_dao.dart';

void main() {
  group('sampleRowsForSave', () {
    test('container_id берётся из поля container', () {
      final rows = sampleRowsForSave(<Map<String, dynamic>>[
        <String, dynamic>{'id': 7, 'container': 42, 'status': 'IN_STORAGE'},
      ]);
      expect(rows, hasLength(1));
      expect(rows.first['container_id'], 42);
      expect(rows.first['id'], 7);
    });

    test('флаг слияния переводится в _pending_sync внутри JSON', () {
      final rows = sampleRowsForSave(<Map<String, dynamic>>[
        <String, dynamic>{'id': 7, 'container': 42, 'pending_sync': 1},
      ]);
      final data =
          jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
      expect(data['_pending_sync'], true);
      expect(data.containsKey('pending_sync'), isFalse);
    });

    test('без правок флаг не появляется', () {
      final rows = sampleRowsForSave(<Map<String, dynamic>>[
        <String, dynamic>{'id': 7, 'container': 42},
      ]);
      final data =
          jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
      expect(data.containsKey('_pending_sync'), isFalse);
    });

    test('запись без id пропускается, без container — без падения', () {
      final rows = sampleRowsForSave(<Map<String, dynamic>>[
        <String, dynamic>{'status': 'IN_STORAGE'},
        <String, dynamic>{'id': 8},
      ]);
      expect(rows, hasLength(1));
      expect(rows.first['container_id'], isNull);
    });

    test('существовавший _pending_sync сохраняется', () {
      final rows = sampleRowsForSave(<Map<String, dynamic>>[
        <String, dynamic>{'id': 7, 'container': 42, '_pending_sync': true},
      ]);
      final data =
          jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
      expect(data['_pending_sync'], true);
    });
  });
}
