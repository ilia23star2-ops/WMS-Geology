/// Тесты применения выбора человека (пачка conflict-apply-9).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/conflict_apply_service.dart';
import 'package:wms_geology_mobile/utils/record_batch_merge.dart';
import 'package:wms_geology_mobile/utils/record_merge.dart';
import 'package:wms_geology_mobile/utils/sync_conflicts.dart';

RecordConflict _conflict({
  String entity = 'container',
  List<FieldConflict> fields = const <FieldConflict>[
    FieldConflict(field: 'status', localValue: 'A', serverValue: 'B'),
  ],
}) => RecordConflict(entity: entity, id: 42, fields: fields);

void main() {
  late List<String> calls;
  late Map<String, dynamic> writtenFields;
  late Map<String, dynamic> writtenPayload;
  late String deletedEndpoint;
  late Map<String, dynamic>? queuePayload;

  setUp(() {
    SyncConflicts.clear();
    calls = <String>[];
    writtenFields = <String, dynamic>{};
    writtenPayload = <String, dynamic>{};
    deletedEndpoint = '';
    queuePayload = <String, dynamic>{'status': 'A'};
  });

  ConflictApplyService make() => ConflictApplyService(
    getLocal: (id) async {
      calls.add('getLocal');
      return <String, dynamic>{'id': id, 'status': 'A'};
    },
    getQueuePayload: (endpoint) async {
      calls.add('getPayload');
      return queuePayload;
    },
    updateQueuePayload: (endpoint, payload) async {
      calls.add('updatePayload');
      writtenPayload = payload;
    },
    deleteQueueItem: (endpoint) async {
      calls.add('deleteItem');
      deletedEndpoint = endpoint;
    },
    updateLocalFields: (id, fields) async {
      calls.add('updateLocal');
      writtenFields = fields;
    },
  );

  test('оставить с планшета — ничего не пишем, расхождение снято', () async {
    SyncConflicts.syncPage(
      'container',
      <int>{42},
      <RecordConflict>[_conflict()],
    );
    await make().apply(_conflict(), keepLocal: true);
    expect(calls, isEmpty);
    expect(SyncConflicts.isEmpty, isTrue);
  });

  test('взять с сервера — серверное значение уходит в кэш', () async {
    await make().apply(_conflict(), keepLocal: false);
    expect(writtenFields, <String, dynamic>{'status': 'B'});
  });

  test('взять с сервера — поле убрано из payload, остальные целы', () async {
    queuePayload = <String, dynamic>{'status': 'A', 'comment': 'моё'};
    await make().apply(_conflict(), keepLocal: false);
    expect(writtenPayload.containsKey('status'), isFalse);
    expect(writtenPayload['comment'], 'моё');
    expect(calls, isNot(contains('deleteItem')));
  });

  test('payload опустел — операция удалена по адресу тары', () async {
    await make().apply(_conflict(), keepLocal: false);
    expect(deletedEndpoint, '/storage/containers/42/');
    expect(calls, contains('deleteItem'));
  });

  test('неизвестная сущность — ничего не трогаем', () async {
    await make().apply(_conflict(entity: 'site'), keepLocal: false);
    expect(calls, isEmpty);
  });

  test('несколько спорных полей применяются вместе', () async {
    queuePayload = <String, dynamic>{'status': 'A', 'comment': 'моё'};
    final conflict = _conflict(
      fields: const <FieldConflict>[
        FieldConflict(field: 'status', localValue: 'A', serverValue: 'B'),
        FieldConflict(field: 'comment', localValue: 'моё', serverValue: 'их'),
      ],
    );
    await make().apply(conflict, keepLocal: false);
    expect(writtenFields, <String, dynamic>{'status': 'B', 'comment': 'их'});
    expect(calls, contains('deleteItem'));
  });
}
