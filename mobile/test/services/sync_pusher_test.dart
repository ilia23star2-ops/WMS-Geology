/// Тесты `SyncPusher` (c-3, c-9-fill-offline-2c-3-fix-2).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:wms_geology_mobile/db/sync_queue_dao.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/sync_pusher.dart';

class MockApiClient extends Fake implements ApiClient {
  final List<String> requests = [];
  bool shouldThrow = false;

  @override
  Future<Response<T>> post<T>(String path, {Object? data}) async {
    requests.add('POST $path');
    if (shouldThrow) throw Exception('Network error');
    return Response<T>(requestOptions: RequestOptions(path: path));
  }

  @override
  Future<Response<T>> patch<T>(String path, {Object? data}) async {
    requests.add('PATCH $path');
    if (shouldThrow) throw Exception('Network error');
    return Response<T>(requestOptions: RequestOptions(path: path));
  }

  @override
  Future<Response<T>> delete<T>(String path) async {
    requests.add('DELETE $path');
    if (shouldThrow) throw Exception('Network error');
    return Response<T>(requestOptions: RequestOptions(path: path));
  }
}

void main() {
  group('SyncPusher', () {
    late MockApiClient client;
    late List<SyncQueueItem> mockQueue;
    late List<int> syncedIds;
    late List<String> errors;
    late List<String> onSuccessCalls;
    late bool resetCalled;

    setUp(() {
      client = MockApiClient();
      mockQueue = [];
      syncedIds = [];
      errors = [];
      onSuccessCalls = [];
      resetCalled = false;
    });

    SyncPusher createPusher() {
      return SyncPusher(
        client,
        getPendingItems: () async => mockQueue,
        markSynced: (id) async => syncedIds.add(id),
        markError: (id, err) async => errors.add('$id: $err'),
        resetErrors: () async => resetCalled = true,
        onSuccess: (endpoint, payload) async {
          onSuccessCalls.add(endpoint);
        },
      );
    }

    test('пустая очередь — ничего не отправляет', () async {
      final pusher = createPusher();
      final result = await pusher.pushAll();

      expect(resetCalled, isTrue);
      expect(client.requests, isEmpty);
      expect(syncedIds, isEmpty);
      expect(result.sent, 0);
      expect(result.failed, 0);
      expect(onSuccessCalls, isEmpty);
    });

    test('успешная отправка POST: sent=1, onSuccess вызван', () async {
      mockQueue = [
        SyncQueueItem(
          id: 1,
          action: 'POST',
          endpoint: '/samples/5/dispose/',
          payload: {'disposal_reason': ''},
          createdAt: '2026-10-29T00:00:00Z',
        ),
      ];
      final pusher = createPusher();
      final result = await pusher.pushAll();

      expect(client.requests, contains('POST /samples/5/dispose/'));
      expect(syncedIds, contains(1));
      expect(errors, isEmpty);
      expect(result.sent, 1);
      expect(result.failed, 0);
      expect(onSuccessCalls, ['/samples/5/dispose/']);
    });

    test('ошибка сети: failed=1, onSuccess не вызван', () async {
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
      final result = await pusher.pushAll();

      expect(client.requests, contains('PATCH /samples/2/'));
      expect(syncedIds, isEmpty);
      expect(errors.length, 1);
      expect(errors.first, contains('2: Exception: Network error'));
      expect(result.sent, 0);
      expect(result.failed, 1);
      expect(onSuccessCalls, isEmpty);
    });

    test('две операции: одна успешна, одна упала', () async {
      mockQueue = [
        SyncQueueItem(
          id: 1,
          action: 'POST',
          endpoint: '/samples/5/dispose/',
          payload: {},
          createdAt: '2026-10-29T00:00:00Z',
        ),
        SyncQueueItem(
          id: 2,
          action: 'DELETE',
          endpoint: '/samples/6/',
          payload: {},
          createdAt: '2026-10-29T00:00:01Z',
        ),
      ];
      // Первый запрос успешен, второй — упадёт.
      final realClient = MockApiClient();
      final failingOnce = _FailingOnceClient(realClient, failOnCall: 2);
      final pusher = SyncPusher(
        failingOnce,
        getPendingItems: () async => mockQueue,
        markSynced: (id) async => syncedIds.add(id),
        markError: (id, err) async => errors.add('$id: $err'),
        resetErrors: () async => resetCalled = true,
        onSuccess: (endpoint, payload) async {
          onSuccessCalls.add(endpoint);
        },
      );
      final result = await pusher.pushAll();

      expect(result.sent, 1);
      expect(result.failed, 1);
      expect(syncedIds, contains(1));
      expect(errors.length, 1);
      expect(onSuccessCalls, ['/samples/5/dispose/']);
    });
  });
}

/// Клиент, который падает на N-м вызове (для теста mixed).
class _FailingOnceClient extends Fake implements ApiClient {
  _FailingOnceClient(this._inner, {required this.failOnCall});
  final ApiClient _inner;
  final int failOnCall;
  int _calls = 0;

  @override
  Future<Response<T>> post<T>(String path, {Object? data}) {
    _calls++;
    if (_calls == failOnCall) throw Exception('Network error');
    return _inner.post<T>(path, data: data);
  }

  @override
  Future<Response<T>> patch<T>(String path, {Object? data}) {
    _calls++;
    if (_calls == failOnCall) throw Exception('Network error');
    return _inner.patch<T>(path, data: data);
  }

  @override
  Future<Response<T>> delete<T>(String path) {
    _calls++;
    if (_calls == failOnCall) throw Exception('Network error');
    return _inner.delete<T>(path);
  }
}
