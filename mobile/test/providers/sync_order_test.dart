/// Тесты порядка синхронизации (пачка sync-fix-3).
///
/// Баг: `syncAll` делал pull ДО push. Pull перезаписывал локальный кэш
/// старыми серверными данными, а reconcile внутри pull снимал
/// pending-флаги ещё до отправки очереди. Правильный порядок: push → pull.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/providers/sync_provider.dart';
import 'package:wms_geology_mobile/services/sync_pusher.dart';
import 'package:wms_geology_mobile/services/sync_service.dart';

class _OrderService extends Fake implements SyncService {
  _OrderService(this.calls);

  final List<String> calls;
  final List<DateTime?> sinceArgs = [];
  bool shouldThrow = false;

  @override
  Future<DateTime?> fetchServerTime() async => DateTime.utc(2026, 11, 24, 10);

  @override
  Future<PullStats> pullAll({DateTime? updatedSince}) async {
    calls.add('pull');
    sinceArgs.add(updatedSince);
    if (shouldThrow) throw Exception('Pull error');
    return const PullStats();
  }
}

class _OrderPusher extends Fake implements SyncPusher {
  _OrderPusher(this.calls);

  final List<String> calls;
  bool shouldThrow = false;

  @override
  Future<PushResult> pushAll() async {
    calls.add('push');
    if (shouldThrow) throw Exception('Push error');
    return const PushResult(sent: 1, failed: 0);
  }
}

void main() {
  test('syncAll: сначала push, потом pull', () async {
    final calls = <String>[];
    final provider = SyncProvider(
      syncService: _OrderService(calls),
      syncPusher: _OrderPusher(calls),
      getPendingCount: () async => 0,
      getPendingItems: () async => [],
    );

    await provider.syncAll();

    expect(calls, <String>['push', 'pull']);
  });

  test('syncAll: push упал — pull не идёт, ошибка видна', () async {
    final calls = <String>[];
    final pusher = _OrderPusher(calls)..shouldThrow = true;
    final provider = SyncProvider(
      syncService: _OrderService(calls),
      syncPusher: pusher,
      getPendingCount: () async => 0,
      getPendingItems: () async => [],
    );

    final result = await provider.syncAll();

    expect(result, isNull);
    expect(calls, <String>['push']);
    expect(provider.lastError, contains('Push error'));
  });

  test('syncAll: при падении push отметка Pull не сдвигается', () async {
    final calls = <String>[];
    final service = _OrderService(calls);
    final pusher = _OrderPusher(calls)..shouldThrow = true;
    final provider = SyncProvider(
      syncService: service,
      syncPusher: pusher,
      getPendingCount: () async => 0,
      getPendingItems: () async => [],
    );

    await provider.syncAll();
    pusher.shouldThrow = false;
    await provider.pull();

    expect(service.sinceArgs, <DateTime?>[null]);
  });
}
