/// Тесты `ContainerService` (c-7c, c-7e-2, c-9-container-list, c-9-container-create, c-2d-2).
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/container.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/container_service.dart';

class _MockApi extends Fake implements ApiClient {
  final List<MapEntry<String, Object?>> postCalls = [];
  Object? throwOnPost;
  Object? postData;

  final List<String> getCalls = [];
  final List<Map<String, dynamic>?> getQueryParams = [];
  Object? throwOnGet;
  Object? getData;

  @override
  Future<Response<T>> post<T>(String path, {Object? data}) async {
    postCalls.add(MapEntry(path, data));
    final e = throwOnPost;
    if (e != null) throw e;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: postData as T?,
    );
  }

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    getCalls.add(path);
    getQueryParams.add(queryParameters);
    final e = throwOnGet;
    if (e != null) throw e;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: getData as T,
    );
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
    late _MockApi client;
    late List<_EnqueueCall> enqueued;

    setUp(() {
      client = _MockApi();
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
              String? localRef,
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

  group('ContainerService.fetchHistory (c-7e-2)', () {
    late _MockApi client;
    late List<Map<String, dynamic>> cached;
    late List<Map<String, dynamic>> savedToCache;

    setUp(() {
      client = _MockApi();
      cached = [];
      savedToCache = [];
    });

    ContainerService createService() {
      return ContainerService(
        client,
        saveHistory: (containerId, items) async {
          savedToCache.addAll(items);
        },
        getCachedHistory: (_) async => cached,
      );
    }

    test('онлайн: возвращает с сервера, пишет в кэш', () async {
      client.getData = [
        {
          'id': 1,
          'action': 'CREATE',
          'action_display': 'Создана',
          'created_at': '2026-11-02T10:00:00Z',
        },
        {
          'id': 2,
          'action': 'PLACE',
          'action_display': 'Размещена',
          'created_at': '2026-11-02T11:00:00Z',
        },
      ];
      final service = createService();
      final list = await service.fetchHistory(10);

      expect(list.length, 2);
      expect(list[0].action, 'CREATE');
      expect(savedToCache.length, 2);
      expect(client.getCalls, contains('/storage/containers/10/history/'));
    });

    test('офлайн с кэшем: возвращает кэш', () async {
      cached = [
        {
          'id': 3,
          'action': 'UPDATE',
          'action_display': 'Изменена',
          'created_at': '2026-11-02T09:00:00Z',
        },
      ];
      client.throwOnGet = ApiException(
        message: 'нет сети',
        isNetworkError: true,
      );
      final service = createService();
      final list = await service.fetchHistory(10);

      expect(list.length, 1);
      expect(list.first.action, 'UPDATE');
    });

    test('офлайн с пустым кэшем: [] без ошибки', () async {
      cached = [];
      client.throwOnGet = ApiException(
        message: 'нет сети',
        isNetworkError: true,
      );
      final service = createService();
      final list = await service.fetchHistory(999);
      expect(list, isEmpty);
    });

    test('валидация (не network): пробрасывается', () async {
      client.throwOnGet = ApiException(
        message: 'forbidden',
        statusCode: 403,
        isNetworkError: false,
      );
      final service = createService();
      await expectLater(service.fetchHistory(10), throwsA(isA<ApiException>()));
    });
  });

  group('ContainerService.fetchList (c-9-container-list)', () {
    late _MockApi client;
    late List<Map<String, dynamic>> cached;

    setUp(() {
      client = _MockApi();
      cached = [];
    });

    ContainerService createService() {
      return ContainerService(client, getAllCached: () async => cached);
    }

    test('онлайн: count + items', () async {
      client.getData = {
        'count': 2,
        'next': null,
        'previous': null,
        'results': [
          {
            'id': 1,
            'container_number': 'T-1',
            'container_type': 1,
            'status': 'ACTIVE',
          },
          {
            'id': 2,
            'container_number': 'T-2',
            'container_type': 1,
            'status': 'PENDING_PLACEMENT',
          },
        ],
      };
      final page = await createService().fetchList(page: 1);

      expect(page.count, 2);
      expect(page.items.length, 2);
      expect(page.items[0].id, 1);
      expect(page.items[0].status, ContainerStatus.active);
      expect(client.getCalls, contains('/storage/containers/'));
    });

    test('онлайн: фильтры уходят в query', () async {
      client.getData = {
        'count': 0,
        'next': null,
        'previous': null,
        'results': <dynamic>[],
      };
      await createService().fetchList(
        page: 2,
        status: ContainerStatus.pendingPlacement,
        containerTypeId: 3,
        draftWorkOrderCoded: 'TST0001',
        draftResearchTypeId: 5,
      );

      final q = client.getQueryParams.last!;
      expect(q['page'], 2);
      expect(q['status'], 'PENDING_PLACEMENT');
      expect(q['container_type_id'], 3);
      expect(q['draft_work_order_coded'], 'TST0001');
      expect(q['draft_research_type_id'], 5);
    });

    test('офлайн: пустой кэш → пустая страница', () async {
      client.throwOnGet = ApiException(
        message: 'нет сети',
        isNetworkError: true,
      );
      final page = await createService().fetchList(page: 1);
      expect(page.count, 0);
      expect(page.items, isEmpty);
    });
  });

  group('ContainerService.bulkCreate (c-9-container-create + c-2d-2)', () {
    late _MockApi client;

    setUp(() {
      client = _MockApi();
    });

    ContainerService createService() => ContainerService(client);

    test('онлайн: POST .../bulk-create/, count + queued=false', () async {
      client.postData = {'total_containers': 3, 'created_containers': []};
      final result = await createService().bulkCreate(
        containers: [
          {'container_type_id': 5},
          {'container_type_id': 5},
          {'container_type_id': 5},
        ],
        draftSiteId: 1,
        draftResearchTypeId: 2,
        draftWorkOrderCoded: 'TST0001',
        draftWorkOrderIncoming: '02-Тест001',
      );

      expect(result.count, 3);
      expect(result.queued, isFalse);
      expect(client.postCalls.length, 1);
      expect(client.postCalls.first.key, '/storage/containers/bulk-create/');
      expect(client.postCalls.first.value, {
        'containers': [
          {'container_type_id': 5},
          {'container_type_id': 5},
          {'container_type_id': 5},
        ],
        'draft_site_id': 1,
        'draft_research_type_id': 2,
        'draft_work_order_coded': 'TST0001',
        'draft_work_order_incoming': '02-Тест001',
      });
    });

    test(
      'без опциональных: draft_site_id и draft_research_type_id не шлём',
      () async {
        client.postData = {'total_containers': 1};
        await createService().bulkCreate(
          containers: [
            {'container_type_id': 5},
          ],
          draftWorkOrderCoded: 'TST0001',
        );

        expect(client.postCalls.first.value, {
          'containers': [
            {'container_type_id': 5},
          ],
          'draft_work_order_coded': 'TST0001',
          'draft_work_order_incoming': '',
        });
      },
    );
  });
}
