import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sync_queue_dao.dart';
import 'package:wms_geology_mobile/providers/sync_provider.dart';
import 'package:wms_geology_mobile/services/sync_pusher.dart';
import 'package:wms_geology_mobile/services/sync_service.dart';

class FakeSyncService extends Fake implements SyncService {
  int pullCallCount = 0;
  bool shouldThrow = false;
  PullStats nextStats = const PullStats(containers: 0, samples: 0);
  final List<DateTime?> updatedSinceArgs = [];

  @override
  Future<PullStats> pullAll({DateTime? updatedSince}) async {
    pullCallCount++;
    updatedSinceArgs.add(updatedSince);
    if (shouldThrow) throw Exception('Pull error');
    return nextStats;
  }
}

class FakeSyncPusher extends Fake implements SyncPusher {
  int pushCallCount = 0;
  bool shouldThrow = false;

  @override
  Future<PushResult> pushAll() async {
    pushCallCount++;
    if (shouldThrow) throw Exception('Push error');
    return const PushResult(sent: 0, failed: 0);
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

    test('первый pull — updatedSince=null (полный)', () async {
      final provider = createProvider();
      await provider.pull();

      expect(service.pullCallCount, 1);
      expect(service.updatedSinceArgs.first, isNull);
    });

    test('второй pull — updatedSince не null', () async {
      final provider = createProvider();
      await provider.pull();
      await provider.pull();

      expect(service.pullCallCount, 2);
      expect(service.updatedSinceArgs[0], isNull);
      expect(service.updatedSinceArgs[1], isNotNull);
    });

    test('push не трогает updatedSince', () async {
      final provider = createProvider();
      await provider.pull();
      final firstSince = service.updatedSinceArgs.first;
      await provider.push();
      await provider.pull();

      expect(service.updatedSinceArgs[0], firstSince);
      expect(service.updatedSinceArgs[1], isNotNull);
    });

    test('pull возвращает PullStats', () async {
      service.nextStats = const PullStats(containers: 5, samples: 20);
      final provider = createProvider();
      final stats = await provider.pull();

      expect(stats, isNotNull);
      expect(stats!.containers, 5);
      expect(stats.samples, 20);
      expect(stats.total, 25);
    });

    test('push вызывает SyncPusher.pushAll', () async {
      final provider = createProvider();
      await provider.push();
      expect(pusher.pushCallCount, 1);
    });

    test('syncAll вызывает pull и push', () async {
      final provider = createProvider();
      await provider.syncAll();
      expect(service.pullCallCount, 1);
      expect(pusher.pushCallCount, 1);
    });

    test(
      'ошибка в pull сохраняется в lastError, updatedSince не меняется',
      () async {
        service.shouldThrow = true;
        final provider = createProvider();
        final stats = await provider.pull();

        expect(stats, isNull);
        expect(provider.lastError, contains('Pull error'));
        expect(service.updatedSinceArgs.first, isNull);
        // Второй pull всё ещё null (первый упал, _lastPullSince не обновился).
        await provider.pull();
        expect(service.updatedSinceArgs[1], isNull);
      },
    );

    test('refresh обновляет pendingCount и errorCount', () async {
      pendingCount = 5;
      items = [
        SyncQueueItem(
          id: 1,
          action: 'POST',
          endpoint: '/',
          payload: {},
          status: 'ERROR',
          createdAt: '2026-10-29T00:00:00Z',
        ),
        SyncQueueItem(
          id: 2,
          action: 'POST',
          endpoint: '/',
          payload: {},
          status: 'PENDING',
          createdAt: '2026-10-29T00:00:00Z',
        ),
      ];
      final provider = createProvider();
      await provider.refresh();

      expect(provider.pendingCount, 5);
      expect(provider.errorCount, 1);
    });
  });
}
