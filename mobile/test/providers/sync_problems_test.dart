/// Тесты видимости проблем синхронизации (пачка sync-problems-1).
///
/// Баг: errorCount считался по списку из getPending(), который отдаёт
/// только PENDING — ошибки не были видны ни счётчиком, ни списком.
/// Плюс mappingErrors собирались в pusher, но наружу не выходили.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sync_queue_dao.dart';
import 'package:wms_geology_mobile/providers/sync_provider.dart';
import 'package:wms_geology_mobile/services/sync_pusher.dart';
import 'package:wms_geology_mobile/services/sync_service.dart';

class _Service extends Fake implements SyncService {
  @override
  Future<DateTime?> fetchServerTime() async => DateTime.utc(2026, 11, 24, 10);

  @override
  Future<PullStats> pullAll({DateTime? updatedSince}) async =>
      const PullStats();
}

class _Pusher extends Fake implements SyncPusher {
  _Pusher(this.result);

  PushResult result;

  @override
  Future<PushResult> pushAll() async => result;
}

SyncQueueItem _item(int id, {String? error}) => SyncQueueItem(
  id: id,
  action: 'POST',
  endpoint: '/sites/',
  payload: const <String, dynamic>{},
  status: error == null ? 'PENDING' : 'ERROR',
  errorMessage: error,
  createdAt: '2026-11-24T10:00:0${id}Z',
);

SyncProvider _make({
  required PushResult result,
  List<SyncQueueItem> items = const <SyncQueueItem>[],
}) {
  return SyncProvider(
    syncService: _Service(),
    syncPusher: _Pusher(result),
    getPendingCount: () async => items.length,
    getPendingItems: () async => items,
  );
}

void main() {
  test('ошибки очереди видны: счётчик и список с текстом', () async {
    final provider = _make(
      result: const PushResult(sent: 0, failed: 0),
      items: <SyncQueueItem>[
        _item(1, error: 'Не удалось подключиться к серверу'),
        _item(2),
      ],
    );

    await provider.refresh();

    expect(provider.errorCount, 1);
    expect(provider.errorItems, hasLength(1));
    expect(provider.errorItems.first.errorMessage, contains('Не удалось'));
  });

  test('проблемы связывания из push видны наружу', () async {
    final provider = _make(
      result: const PushResult(
        sent: 1,
        failed: 0,
        mappingErrors: <String>['тара не связана с серверной'],
      ),
    );

    await provider.push();

    expect(provider.mappingErrors, <String>['тара не связана с серверной']);
  });

  test('проблемы связывания из syncAll видны наружу', () async {
    final provider = _make(
      result: const PushResult(
        sent: 2,
        failed: 0,
        mappingErrors: <String>['справочник не связан'],
      ),
    );

    await provider.syncAll();

    expect(provider.mappingErrors, <String>['справочник не связан']);
  });

  test('успешная отправка очищает прошлые проблемы связывания', () async {
    final pusher = _Pusher(
      const PushResult(
        sent: 1,
        failed: 0,
        mappingErrors: <String>['старая проблема'],
      ),
    );
    final provider = SyncProvider(
      syncService: _Service(),
      syncPusher: pusher,
      getPendingCount: () async => 0,
      getPendingItems: () async => <SyncQueueItem>[],
    );

    await provider.push();
    expect(provider.mappingErrors, hasLength(1));

    pusher.result = const PushResult(sent: 1, failed: 0);
    await provider.push();
    expect(provider.mappingErrors, isEmpty);
  });
}
