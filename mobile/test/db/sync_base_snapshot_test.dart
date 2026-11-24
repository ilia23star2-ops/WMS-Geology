/// Тесты подготовки снимка записи (пачка conflict-base-2).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sync_base_dao.dart';

void main() {
  group('snapshotOf', () {
    test('убирает локальный флаг pending_sync', () {
      final snap = snapshotOf(<String, dynamic>{
        'id': 42,
        'status': 'ACTIVE',
        'pending_sync': 1,
      });
      expect(snap.containsKey('pending_sync'), isFalse);
      expect(snap['id'], 42);
      expect(snap['status'], 'ACTIVE');
    });

    test('убирает локальный флаг _pending_sync', () {
      final snap = snapshotOf(<String, dynamic>{
        'id': 7,
        '_pending_sync': true,
      });
      expect(snap.containsKey('_pending_sync'), isFalse);
      expect(snap['id'], 7);
    });

    test('серверные поля сохраняет как есть', () {
      final snap = snapshotOf(<String, dynamic>{
        'id': 42,
        'updated_at': '2026-11-24T10:00:00Z',
        'container_number': 'T-123',
        'status': 'ACTIVE',
      });
      expect(snap['updated_at'], '2026-11-24T10:00:00Z');
      expect(snap['container_number'], 'T-123');
      expect(snap['status'], 'ACTIVE');
    });

    test('пустая запись → пустой снимок', () {
      expect(snapshotOf(<String, dynamic>{}), isEmpty);
    });

    test('исходную запись не меняет', () {
      final source = <String, dynamic>{'id': 1, 'pending_sync': 1};
      snapshotOf(source);
      expect(source['pending_sync'], 1);
      expect(source.length, 2);
    });
  });
}
