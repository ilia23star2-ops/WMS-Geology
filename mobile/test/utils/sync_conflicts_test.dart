/// Тесты хранилища расхождений (пачка conflict-pull-6).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/record_batch_merge.dart';
import 'package:wms_geology_mobile/utils/record_merge.dart';
import 'package:wms_geology_mobile/utils/sync_conflicts.dart';

RecordConflict _conflict(int id, {String entity = 'container'}) =>
    RecordConflict(
      entity: entity,
      id: id,
      fields: const <FieldConflict>[
        FieldConflict(field: 'status', localValue: 'A', serverValue: 'B'),
      ],
    );

void main() {
  setUp(SyncConflicts.clear);

  test('расхождения страницы попадают в список', () {
    SyncConflicts.syncPage(
      'container',
      <int>{42},
      <RecordConflict>[_conflict(42)],
    );
    expect(SyncConflicts.count, 1);
    expect(SyncConflicts.items.first.id, 42);
  });

  test('повторная страница не плодит дубли', () {
    SyncConflicts.syncPage(
      'container',
      <int>{42},
      <RecordConflict>[_conflict(42)],
    );
    SyncConflicts.syncPage(
      'container',
      <int>{42},
      <RecordConflict>[_conflict(42)],
    );
    expect(SyncConflicts.count, 1);
  });

  test('расхождение исчезает, когда запись перестала спорить', () {
    SyncConflicts.syncPage(
      'container',
      <int>{42},
      <RecordConflict>[_conflict(42)],
    );
    SyncConflicts.syncPage('container', <int>{42}, <RecordConflict>[]);
    expect(SyncConflicts.isEmpty, isTrue);
  });

  test('разные сущности не мешают друг другу', () {
    SyncConflicts.syncPage(
      'container',
      <int>{42},
      <RecordConflict>[_conflict(42)],
    );
    SyncConflicts.syncPage(
      'sample',
      <int>{42},
      <RecordConflict>[_conflict(42, entity: 'sample')],
    );
    expect(SyncConflicts.count, 2);
    SyncConflicts.syncPage('container', <int>{42}, <RecordConflict>[]);
    expect(SyncConflicts.count, 1);
    expect(SyncConflicts.items.first.entity, 'sample');
  });

  test('remove убирает выбранное человеком расхождение', () {
    SyncConflicts.syncPage(
      'container',
      <int>{1, 2},
      <RecordConflict>[_conflict(1), _conflict(2)],
    );
    SyncConflicts.remove('container', 1);
    expect(SyncConflicts.count, 1);
    expect(SyncConflicts.items.first.id, 2);
  });
}
