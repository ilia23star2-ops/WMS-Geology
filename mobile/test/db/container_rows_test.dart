/// Тесты подготовки строк кэша тар (пачка conflict-pull-5).
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/container_dao.dart';

void main() {
  group('containerRowsForSave', () {
    test('серверная запись без правок → pending_sync 0', () {
      final rows = containerRowsForSave(<Map<String, dynamic>>[
        <String, dynamic>{
          'id': 42,
          'updated_at': '2026-11-24T10:00:00Z',
          'status': 'ACTIVE',
        },
      ]);
      expect(rows, hasLength(1));
      expect(rows.first['id'], 42);
      expect(rows.first['pending_sync'], 0);
      expect(rows.first['updated_at'], '2026-11-24T10:00:00Z');
    });

    test('флаг из слияния сохраняется', () {
      final rows = containerRowsForSave(<Map<String, dynamic>>[
        <String, dynamic>{'id': 42, 'pending_sync': 1},
      ]);
      expect(rows.first['pending_sync'], 1);
    });

    test('локальный флаг _pending_sync тоже учитывается', () {
      final rows = containerRowsForSave(<Map<String, dynamic>>[
        <String, dynamic>{'id': 7, '_pending_sync': true},
      ]);
      expect(rows.first['pending_sync'], 1);
    });

    test('запись без id пропускается, data — валидный JSON', () {
      final rows = containerRowsForSave(<Map<String, dynamic>>[
        <String, dynamic>{'status': 'ACTIVE'},
        <String, dynamic>{'id': 5, 'status': 'DISPOSED'},
      ]);
      expect(rows, hasLength(1));
      final decoded =
          jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
      expect(decoded['status'], 'DISPOSED');
    });
  });
}
