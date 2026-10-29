import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/db/sync_queue_dao.dart';
import 'package:mobile/services/api_client.dart';
import 'package:mobile/services/sync_pusher.dart';

class MockApiClient extends Fake implements ApiClient {
  final List<String> requests = [];
  bool shouldThrow = false;

  @override
  Future<dynamic> post(String path, {dynamic data}) async {
    requests.add('POST $path');
    if (shouldThrow) throw Exception('Network error');
    return null;
  }

  @override
  Future<dynamic> patch(String path, {dynamic data}) async {
    requests.add('PATCH $path');
    if (shouldThrow) throw Exception('Network error');
    return null;
  }

  @override
  Future<dynamic> delete(String path) async {
    requests.add('DELETE $path');
    if (shouldThrow) throw Exception('Network error');
    return null;
  }
}

void main() {
  group('SyncPusher', () {
    late MockApiClient client;
    late List<SyncQueueItem> mockQueue;
    late List<int> syncedIds;
    late List<String> errors;
    late bool resetCalled;

    setUp(() {
      client = MockApiClient();
      mockQueue = [];
      syncedIds = [];
      errors = [];
      resetCalled = false;
    });

    SyncPusher createPusher() {
      return SyncPusher(
        client,
        getPendingItems: () async => mockQueue,
        markSynced: (id) async => syncedIds.add(id),
        markError: (id, err) async => errors.add('$id: $err'),
        resetErrors: () async => resetCalled = true,
      );
    }

    test('пустая очередь — ничего не отправляет', () async {
      final pusher = createPusher();
      await pusher.pushAll();

      expect(resetCalled, isTrue);
      expect(client.requests, isEmpty);
      expect(syncedIds, isEmpty);
    });

    test('успешная отправка POST', () async {
      mockQueue = [
        SyncQueueItem(
          id: 1,
          action: 'POST',
          endpoint: '/samples/',
          payload: {'sample_number': 'T-001'},
          createdAt: '2026-10-29T00:00:00Z',
        ),
      ];
      final pusher = createPusher();
      await pusher.pushAll();

      expect(client.requests, contains('POST /samples/'));
      expect(syncedIds, contains(1));
      expect(errors, isEmpty);
    });

    test('ошибка сети — помечает элемент как ERROR', () async {
      client.shouldThrow = true;
      mockQueue = [
        SyncQueueItem(
          id: 2,
          action: 'PATCH',
          endpoint: '/samples/2/',
          payload: {'status': 'IN_STORAGE'},
          createdAt: '2026-10-29T00:00:00Z',
        ),
      ];
      final pusher = createPusher();
      await pusher.pushAll();

      expect(client.requests, contains('PATCH /samples/2/'));
      expect(syncedIds, isEmpty);
      expect(errors.length, 1);
      expect(errors.first, contains('2: Exception: Network error'));
    });
  });
}