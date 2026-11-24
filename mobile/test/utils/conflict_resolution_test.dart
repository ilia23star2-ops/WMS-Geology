/// Тесты применения выбора человека (пачка conflict-apply-7).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/conflict_resolution.dart';

void main() {
  group('resolveField', () {
    test('оставить с планшета — кэш и очередь не меняются', () {
      final r = resolveField(
        field: 'status',
        serverValue: 'DISPOSED',
        localRecord: <String, dynamic>{'id': 42, 'status': 'PENDING_FILLING'},
        queuePayload: <String, dynamic>{'status': 'PENDING_FILLING'},
        keepLocal: true,
      );
      expect(r.localRecord['status'], 'PENDING_FILLING');
      expect(r.queuePayload, <String, dynamic>{'status': 'PENDING_FILLING'});
      expect(r.dropQueueItem, isFalse);
    });

    test('взять с сервера — значение попадает в кэш', () {
      final r = resolveField(
        field: 'status',
        serverValue: 'DISPOSED',
        localRecord: <String, dynamic>{'id': 42, 'status': 'PENDING_FILLING'},
        queuePayload: <String, dynamic>{'status': 'PENDING_FILLING'},
        keepLocal: false,
      );
      expect(r.localRecord['status'], 'DISPOSED');
    });

    test('взять с сервера — поле уходит из payload, остальные остаются', () {
      final r = resolveField(
        field: 'status',
        serverValue: 'DISPOSED',
        localRecord: <String, dynamic>{'id': 42, 'status': 'PENDING_FILLING'},
        queuePayload: <String, dynamic>{
          'status': 'PENDING_FILLING',
          'comment': 'моё',
        },
        keepLocal: false,
      );
      expect(r.queuePayload!.containsKey('status'), isFalse);
      expect(r.queuePayload!['comment'], 'моё');
      expect(r.dropQueueItem, isFalse);
    });

    test('payload опустел — операция удаляется', () {
      final r = resolveField(
        field: 'status',
        serverValue: 'DISPOSED',
        localRecord: <String, dynamic>{'id': 42, 'status': 'PENDING_FILLING'},
        queuePayload: <String, dynamic>{'status': 'PENDING_FILLING'},
        keepLocal: false,
      );
      expect(r.dropQueueItem, isTrue);
      expect(r.queuePayload, isNull);
    });

    test('очереди нет — кэш обновляется, удалять нечего', () {
      final r = resolveField(
        field: 'status',
        serverValue: 'DISPOSED',
        localRecord: <String, dynamic>{'id': 42, 'status': 'PENDING_FILLING'},
        queuePayload: null,
        keepLocal: false,
      );
      expect(r.localRecord['status'], 'DISPOSED');
      expect(r.dropQueueItem, isFalse);
      expect(r.queuePayload, isNull);
    });

    test('исходные Map не мутируются', () {
      final local = <String, dynamic>{'id': 42, 'status': 'PENDING_FILLING'};
      final payload = <String, dynamic>{'status': 'PENDING_FILLING'};
      resolveField(
        field: 'status',
        serverValue: 'DISPOSED',
        localRecord: local,
        queuePayload: payload,
        keepLocal: false,
      );
      expect(local['status'], 'PENDING_FILLING');
      expect(payload.containsKey('status'), isTrue);
    });
  });
}
