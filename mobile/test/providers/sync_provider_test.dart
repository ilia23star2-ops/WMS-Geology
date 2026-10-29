import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sync_queue_dao.dart';
import 'package:wms_geology_mobile/providers/sync_provider.dart';
import 'package:wms_geology_mobile/services/sync_pusher.dart';
import 'package:wms_geology_mobile/services/sync_service.dart';

class FakeSyncService extends Fake implements SyncService {
  int pullCallCount = 0;
  bool shouldThrow = false;

  @override
  Future<void> pullAll() async {
    pullCallCount++;
    if (shouldThrow) throw Exception('Pull error');
  }
}

class FakeSyncPusher extends Fake implements SyncPusher {
  int pushCallCount = 0;
  bool shouldThrow = false;

  @override
  Future<void> pushAll() async {
    pushCallCount++;
    if (shouldThrow) throw Exception('Push error');
  }
}

void main() {
  group('SyncProvider', () {
    late FakeSyncService service;
    late FakeSyncPusher pusher;
    late int pendingCount;
    late List<SyncQueueItem> items;

    setUp(() {
      service = FakeSyncService();
      pusher = FakeSyncPusher();
      pendingCount = 0;
      items = [];
    });

    SyncProvider createProvider() {
      return SyncProvider(
        syncService: service,
        syncPusher: pusher,
        getPendingCount: () async => pendingCount,
        getPendingItems: () async => items,
      );
    }

    test('начальное состояние', () {
      final provider = createProvider();
      expect(provider.isSyncing, isFalse);
      expect(provider.lastSyncTime, isNull);
      expect(provider.pendingCount, 0);
      expect(provider.errorCount, 0);
    });

    test('pull вызывает SyncService.pullAll и обновляет время', () async {
      final provider = createProvider();
      await provider.pull();

      expect(service.pullCallCount, 1);
      expect(provider.lastSyncTime, isNotNull);
      expect(provider.isSyncing, isFalse);
      expect(provider.lastError, isNull);
    });

    test('push вызывает SyncPusher.pushAll', () async {
      final provider = createProvider();
      await provider.push();

      expect(pusher.pushCallCount, 1);
      expect(provider.lastSyncTime, isNotNull);
    });

    test('syncAll вызывает pull и push', () async {
      final provider = createProvider();
      await provider.syncAll();

      expect(service.pullCallCount, 1);
      expect(pusher.pushCallCount, 1);
    });

    test('ошибка в pull сохраняется в lastError', () async {
      service.shouldThrow = true;
      final provider = createProvider();
      await provider.pull();

      expect(provider.lastError, contains('Pull error'));
      expect(provider.isSyncing, isFalse);
    });

    test('ошибка в push сохраняется в lastError', () async {
      pusher.shouldThrow = true;
      final provider = createProvider();
      await provider.push();

      expect(provider.lastError, contains('Push error'));
    });

    test('refresh обновляет pendingCount и errorCount', () async {
      pendingCount = 5;
      items = [
        SyncQueueItem(
          id: 1, action: 'POST', endpoint: '/', payload: {},
          status: 'ERROR', createdAt: '2026-10-29T00:00:00Z',
        ),
        SyncQueueItem(
          id: 2, action: 'POST', endpoint: '/', payload: {},
          status: 'PENDING', createdAt: '2026-10-29T00:00:00Z',
        ),
      ];
      final provider = createProvider();
      await provider.refresh();

      expect(provider.pendingCount, 5);
      expect(provider.errorCount, 1);
    });
  });
}