/// Тесты `ContainerService.bulkPlace` (c-7c, офлайн-размещение).
///
/// Проверяем три сценария:
/// - онлайн — POST уходит, `PlaceOutcome.online`, очередь пуста;
/// - офлайн (`isNetworkError`) — `PlaceOutcome.queued`, POST в очередь;
/// - валидация (не network) — исключение пробрасывается, очередь пуста.
///
/// И `ArgumentError`, если нарушен контракт «ровно один из cellId /
/// floorRoomId».
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/container_service.dart';

class _MockApiClient extends Fake implements ApiClient {
  final List<MapEntry<String, Object?>> postCalls = [];

  /// Если задано — `post` бросает это значение.
  Object? throwOnPost;

  @override
  Future<Response<T>> post<T>(String path, {Object? data}) async {
    postCalls.add(MapEntry(path, data));
    final e = throwOnPost;
    if (e != null) throw e;
    return Response<T>(requestOptions: RequestOptions(path: path));
  }
}

class _EnqueueCall {
  _EnqueueCall(this.action, this.endpoint, this.payload);
  final String action;
  final String endpoint;
  final Map<String, dynamic> payload;
}

void main() {
  group('ContainerService.bulkPlace (c-7c offline)', () {
    late _MockApiClient client;
    late List<_EnqueueCall> enqueued;

    setUp(() {
      client = _MockApiClient();
      enqueued = [];
    });

    ContainerService createService() {
      return ContainerService(
        client,
        enqueue:
            ({
              required String action,
              required String endpoint,
              required Map<String, dynamic> payload,
            }) async {
              enqueued.add(_EnqueueCall(action, endpoint, payload));
            },
      );
    }

    test('онлайн: POST уходит, результат online, очередь пуста', () async {
      final service = createService();
      final outcome = await service.bulkPlace(containerIds: [10], cellId: 5);

      expect(outcome, PlaceOutcome.online);
      expect(client.postCalls.length, 1);
      expect(client.postCalls.first.key, '/storage/containers/bulk-place/');
      expect(client.postCalls.first.value, {
        'container_ids': [10],
        'cell_id': 5,
      });
      expect(enqueued, isEmpty);
    });

    test('онлайн (на пол): body с floor_room_id', () async {
      final service = createService();
      final outcome = await service.bulkPlace(
        containerIds: [11, 12],
        floorRoomId: 3,
      );

      expect(outcome, PlaceOutcome.online);
      expect(client.postCalls.first.value, {
        'container_ids': [11, 12],
        'floor_room_id': 3,
      });
      expect(enqueued, isEmpty);
    });

    test('офлайн: POST в очередь, результат queued', () async {
      client.throwOnPost = ApiException(
        message: 'Не удалось подключиться к серверу',
        isNetworkError: true,
      );
      final service = createService();
      final outcome = await service.bulkPlace(containerIds: [10], cellId: 7);

      expect(outcome, PlaceOutcome.queued);
      expect(enqueued.length, 1);
      expect(enqueued.first.action, 'POST');
      expect(enqueued.first.endpoint, '/storage/containers/bulk-place/');
      expect(enqueued.first.payload, {
        'container_ids': [10],
        'cell_id': 7,
      });
    });

    test('офлайн (на пол): payload с floor_room_id в очередь', () async {
      client.throwOnPost = ApiException(
        message: 'timeout',
        isNetworkError: true,
      );
      final service = createService();
      await service.bulkPlace(containerIds: [20], floorRoomId: 4);

      expect(enqueued.length, 1);
      expect(enqueued.first.payload, {
        'container_ids': [20],
        'floor_room_id': 4,
      });
    });

    test('валидация (не network): исключение, очередь пуста', () async {
      client.throwOnPost = ApiException(
        message: 'cell_id: invalid',
        statusCode: 400,
        isNetworkError: false,
      );
      final service = createService();
      await expectLater(
        service.bulkPlace(containerIds: [10], cellId: 5),
        throwsA(isA<ApiException>()),
      );
      expect(enqueued, isEmpty);
    });

    test('ArgumentError: ни cellId, ни floorRoomId', () async {
      final service = createService();
      expect(() => service.bulkPlace(containerIds: [10]), throwsArgumentError);
      expect(client.postCalls, isEmpty);
      expect(enqueued, isEmpty);
    });

    test('ArgumentError: оба cellId и floorRoomId', () async {
      final service = createService();
      expect(
        () => service.bulkPlace(containerIds: [10], cellId: 5, floorRoomId: 2),
        throwsArgumentError,
      );
      expect(client.postCalls, isEmpty);
      expect(enqueued, isEmpty);
    });
  });
}
