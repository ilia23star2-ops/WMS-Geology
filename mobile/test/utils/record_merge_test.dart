/// Тесты слияния записей (пачка conflict-merge-1).
///
/// Главное требование: обычные действия не требуют подтверждения.
/// Вопрос человеку — только когда одно поле изменено с двух сторон.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/record_merge.dart';

void main() {
  group('mergeRecords', () {
    test('значения совпадают — ни вопросов, ни правок', () {
      final result = mergeRecords(
        base: <String, dynamic>{'status': 'ACTIVE'},
        local: <String, dynamic>{'status': 'ACTIVE'},
        server: <String, dynamic>{'status': 'ACTIVE'},
      );
      expect(result.needsDecision, isFalse);
      expect(result.merged['status'], 'ACTIVE');
      expect(result.autoMerged, isEmpty);
    });

    test('меняли только на планшете — берём планшет без вопроса', () {
      final result = mergeRecords(
        base: <String, dynamic>{'status': 'ACTIVE'},
        local: <String, dynamic>{'status': 'PENDING_FILLING'},
        server: <String, dynamic>{'status': 'ACTIVE'},
      );
      expect(result.needsDecision, isFalse);
      expect(result.merged['status'], 'PENDING_FILLING');
      expect(result.autoMerged, contains('status'));
    });

    test('меняли только на сервере — берём сервер без вопроса', () {
      final result = mergeRecords(
        base: <String, dynamic>{'status': 'ACTIVE'},
        local: <String, dynamic>{'status': 'ACTIVE'},
        server: <String, dynamic>{'status': 'DISPOSED'},
      );
      expect(result.needsDecision, isFalse);
      expect(result.merged['status'], 'DISPOSED');
    });

    test('разные поля — взаимодополнение без вопроса', () {
      final result = mergeRecords(
        base: <String, dynamic>{'status': 'ACTIVE', 'note': ''},
        local: <String, dynamic>{'status': 'PENDING_FILLING', 'note': ''},
        server: <String, dynamic>{'status': 'ACTIVE', 'note': 'проверено'},
      );
      expect(result.needsDecision, isFalse);
      expect(result.merged['status'], 'PENDING_FILLING');
      expect(result.merged['note'], 'проверено');
      expect(result.autoMerged, hasLength(2));
    });

    test('одно поле изменено с двух сторон — вопрос человеку', () {
      final result = mergeRecords(
        base: <String, dynamic>{'status': 'ACTIVE'},
        local: <String, dynamic>{'status': 'PENDING_FILLING'},
        server: <String, dynamic>{'status': 'DISPOSED'},
      );
      expect(result.needsDecision, isTrue);
      expect(result.conflicts, hasLength(1));
      expect(result.conflicts.first.field, 'status');
      expect(result.conflicts.first.localValue, 'PENDING_FILLING');
      expect(result.conflicts.first.serverValue, 'DISPOSED');
      // Разошедшееся поле не применяется молча.
      expect(result.merged.containsKey('status'), isFalse);
    });

    test('нет снимка и значения разные — спрашиваем, не теряем правку', () {
      final result = mergeRecords(
        base: null,
        local: <String, dynamic>{'status': 'PENDING_FILLING'},
        server: <String, dynamic>{'status': 'DISPOSED'},
      );
      expect(result.needsDecision, isTrue);
      expect(result.conflicts.first.field, 'status');
    });

    test('служебные поля берём серверные, вопросов по ним нет', () {
      final result = mergeRecords(
        base: <String, dynamic>{'id': -5, 'status': 'ACTIVE'},
        local: <String, dynamic>{'id': -5, 'status': 'ACTIVE'},
        server: <String, dynamic>{
          'id': 42,
          'updated_at': '2026-11-24T10:00:00Z',
          'status': 'ACTIVE',
        },
      );
      expect(result.needsDecision, isFalse);
      expect(result.merged['id'], 42);
      expect(result.merged['updated_at'], '2026-11-24T10:00:00Z');
    });

    test('поле появилось только на планшете — сохраняется', () {
      final result = mergeRecords(
        base: <String, dynamic>{'status': 'ACTIVE'},
        local: <String, dynamic>{'status': 'ACTIVE', 'note': 'новая'},
        server: <String, dynamic>{'status': 'ACTIVE'},
      );
      expect(result.needsDecision, isFalse);
      expect(result.merged['note'], 'новая');
    });
    test('поле удалено на планшете — удаляем без вопроса', () {
      final result = mergeRecords(
        base: <String, dynamic>{'note': 'старая'},
        local: <String, dynamic>{},
        server: <String, dynamic>{'note': 'старая'},
      );
      expect(result.needsDecision, isFalse);
      expect(result.merged.containsKey('note'), isFalse);
    });
  });
}