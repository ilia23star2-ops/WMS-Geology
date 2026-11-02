/// Тесты модели ContainerHistoryEntry (c-7a).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/container_history_entry.dart';

void main() {
  group('ContainerHistoryEntry.fromJson', () {
    test('CREATE с new_value', () {
      final e = ContainerHistoryEntry.fromJson({
        'id': 1,
        'username': 'admin',
        'action': 'CREATE',
        'action_display': 'Создана',
        'old_value': null,
        'new_value': {'status': 'PENDING_FILLING', 'container_number': 'T-001'},
        'created_at': '2026-10-30T10:00:00Z',
      });
      expect(e.action, 'CREATE');
      expect(e.actionDisplay, 'Создана');
      expect(e.username, 'admin');
      expect(e.oldValue, isNull);
      expect(e.newValue, isNotNull);
      expect(e.newValue!['status'], 'PENDING_FILLING');
      expect(e.createdAt, isNotNull);
    });

    test('UPDATE с old_value и new_value', () {
      final e = ContainerHistoryEntry.fromJson({
        'id': 2,
        'username': 'worker1',
        'action': 'UPDATE',
        'action_display': 'Изменена',
        'old_value': {'container_number': 'T-001'},
        'new_value': {'container_number': 'T-002'},
        'created_at': '2026-10-30T11:00:00Z',
      });
      expect(e.oldValue!['container_number'], 'T-001');
      expect(e.newValue!['container_number'], 'T-002');
    });
  });
}
