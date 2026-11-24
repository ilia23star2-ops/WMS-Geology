/// Тесты слияния партии при Pull (пачка conflict-pull-4).
///
/// Главное: обычная работа не требует подтверждений, а своё значение
/// при расхождении не теряется.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/record_batch_merge.dart';

void main() {
  group('mergeBatch', () {
    test('без офлайн-правок берём серверное как есть', () {
      final result = mergeBatch(
        entity: 'container',
        serverRecords: <Map<String, dynamic>>[
          <String, dynamic>{'id': 42, 'status': 'ACTIVE'},
        ],
        localById: <int, Map<String, dynamic>>{
          42: <String, dynamic>{'id': 42, 'status': 'ACTIVE'},
        },
        baseById: <int, Map<String, dynamic>>{},
        pendingIds: <int>{},
      );
      expect(result.needsDecision, isFalse);
      expect(result.toSave.first['status'], 'ACTIVE');
      expect(result.toSave.first.containsKey('pending_sync'), isFalse);
    });

    test('правки и серверные изменения в разных полях — объединяем', () {
      final result = mergeBatch(
        entity: 'container',
        serverRecords: <Map<String, dynamic>>[
          <String, dynamic>{'id': 42, 'status': 'ACTIVE', 'note': 'с сервера'},
        ],
        localById: <int, Map<String, dynamic>>{
          42: <String, dynamic>{
            'id': 42,
            'status': 'PENDING_FILLING',
            'note': '',
          },
        },
        baseById: <int, Map<String, dynamic>>{
          42: <String, dynamic>{'id': 42, 'status': 'ACTIVE', 'note': ''},
        },
        pendingIds: <int>{42},
      );
      expect(result.needsDecision, isFalse);
      expect(result.toSave.first['status'], 'PENDING_FILLING');
      expect(result.toSave.first['note'], 'с сервера');
      expect(result.toSave.first['pending_sync'], 1);
      expect(result.autoMergedFields, 2);
    });

    test('одно поле разошлось — своё сохраняем, расхождение в список', () {
      final result = mergeBatch(
        entity: 'container',
        serverRecords: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 42,
            'status': 'DISPOSED',
            'container_number': 'T-123',
          },
        ],
        localById: <int, Map<String, dynamic>>{
          42: <String, dynamic>{'id': 42, 'status': 'PENDING_FILLING'},
        },
        baseById: <int, Map<String, dynamic>>{
          42: <String, dynamic>{'id': 42, 'status': 'ACTIVE'},
        },
        pendingIds: <int>{42},
        titleOf: (r) => r['container_number'] as String? ?? '',
      );
      expect(result.needsDecision, isTrue);
      expect(result.toSave.first['status'], 'PENDING_FILLING');
      expect(result.conflicts, hasLength(1));
      expect(result.conflicts.first.title, 'T-123');
      expect(result.conflicts.first.fields.first.serverValue, 'DISPOSED');
      expect(result.conflicts.first.fields.first.localValue, 'PENDING_FILLING');
    });

    test('нет снимка — спрашиваем, своё не теряем', () {
      final result = mergeBatch(
        entity: 'container',
        serverRecords: <Map<String, dynamic>>[
          <String, dynamic>{'id': 42, 'status': 'DISPOSED'},
        ],
        localById: <int, Map<String, dynamic>>{
          42: <String, dynamic>{'id': 42, 'status': 'PENDING_FILLING'},
        },
        baseById: <int, Map<String, dynamic>>{},
        pendingIds: <int>{42},
      );
      expect(result.needsDecision, isTrue);
      expect(result.toSave.first['status'], 'PENDING_FILLING');
    });

    test('партия: часть записей спорные, часть нет', () {
      final result = mergeBatch(
        entity: 'container',
        serverRecords: <Map<String, dynamic>>[
          <String, dynamic>{'id': 1, 'status': 'ACTIVE'},
          <String, dynamic>{'id': 2, 'status': 'DISPOSED'},
        ],
        localById: <int, Map<String, dynamic>>{
          1: <String, dynamic>{'id': 1, 'status': 'ACTIVE'},
          2: <String, dynamic>{'id': 2, 'status': 'PENDING_FILLING'},
        },
        baseById: <int, Map<String, dynamic>>{
          1: <String, dynamic>{'id': 1, 'status': 'ACTIVE'},
          2: <String, dynamic>{'id': 2, 'status': 'ACTIVE'},
        },
        pendingIds: <int>{1, 2},
      );
      expect(result.toSave, hasLength(2));
      expect(result.conflicts, hasLength(1));
      expect(result.conflicts.first.id, 2);
    });

    test('запись без id не ломает партию', () {
      final result = mergeBatch(
        entity: 'container',
        serverRecords: <Map<String, dynamic>>[
          <String, dynamic>{'status': 'ACTIVE'},
        ],
        localById: <int, Map<String, dynamic>>{},
        baseById: <int, Map<String, dynamic>>{},
        pendingIds: <int>{},
      );
      expect(result.toSave, hasLength(1));
      expect(result.needsDecision, isFalse);
    });
  });
}
