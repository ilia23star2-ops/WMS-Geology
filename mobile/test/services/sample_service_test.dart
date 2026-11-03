/// Тесты `SampleService` (c-7e-1, c-9-fill-offline-2a, -2a-fix, -2b, -2c-1).
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/sample.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/sample_service.dart';

class _MockApi extends Fake implements ApiClient {
  bool offline = false;
  Object? otherError;
  List<Map<String, dynamic>> results = const [];

  final List<MapEntry<String, Object?>> postCalls = [];
  Object? throwOnPost;
  Object? postData;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    if (offline) {
      throw ApiException(message: 'нет сети', isNetworkError: true);
    }
    final e = otherError;
    if (e != null) throw e;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: {
        'count': results.length,
        'next': null,
        'previous': null,
        'results': results,
      } as T,
    );
  }

  @override
  Future<Response<T>> post<T>(String path, {Object? data}) async {
    postCalls.add(MapEntry(path, data));
    if (offline) {
      throw ApiException(message: 'нет сети', isNetworkError: true);
    }
    final e = throwOnPost;
    if (e != null) throw e;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: postData as T?,
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
  group('SampleService.fetchByContainerId (c-7e-1)', () {
    late _MockApi api;
    late List<Map<String, dynamic>> cached;
    late List<Map<String, dynamic>> savedToCache;
    late List<int> cleanupCalls;
    late List<Set<String>> cleanupNumbers;

    setUp(() {
      api = _MockApi();
      cached = [];
      savedToCache = [];
      cleanupCalls = [];
      cleanupNumbers = [];
    });

    SampleService createService() {
      return SampleService(
        api,
        saveSamples: (raw) async => savedToCache.addAll(raw),
        getCached: (_) async => cached,
        cleanupOffline: (containerId, numbers) async {
          cleanupCalls.add(containerId);
          cleanupNumbers.add(numbers);
        },
      );
    }

    test('онлайн: возвращает данные, пишет в кэш, cleanup вызван', () async {
      api.results = [
        {
          'id': 1,
          'sample_number': 'S-1',
          'container': 10,
          'status': 'IN_STORAGE',
        },
        {
          'id': 2,
          'sample_number': 'S-2',
          'container': 10,
          'status': 'IN_STORAGE',
        },
      ];
      final service = createService();
      final list = await service.fetchByContainerId(10);

      expect(list.length, 2);
      expect(list[0].id, 1);
      expect(list[0].isOfflinePending, false);
      expect(savedToCache.length, 2);
      expect(cleanupCalls, [10]);
      expect(cleanupNumbers.first, {'S-1', 'S-2'});
    });

    test('онлайн, пустая тара: пустой список, cleanup с пустым set', () async {
      api.results = const [];
      final service = createService();
      final list = await service.fetchByContainerId(10);
      expect(list, isEmpty);
      expect(cleanupCalls, [10]);
      expect(cleanupNumbers.first, isEmpty);
    });

    test('офлайн с кэшем: возвращает кэш, cleanup не вызван', () async {
      cached = [
        {
          'id': 5,
          'sample_number': 'S-5',
          'container': 10,
          'status': 'IN_STORAGE',
        },
      ];
      api.offline = true;
      final service = createService();
      final list = await service.fetchByContainerId(10);
      expect(list.length, 1);
      expect(list.first.id, 5);
      expect(cleanupCalls, isEmpty);
    });

    test('офлайн с пустым кэшем: [] без ошибки', () async {
      cached = [];
      api.offline = true;
      final service = createService();
      final list = await service.fetchByContainerId(999);
      expect(list, isEmpty);
    });

    test('валидация (не network): исключение пробрасывается', () async {
      api.otherError = ApiException(
        message: 'container_id: invalid',
        statusCode: 400,
        isNetworkError: false,
      );
      final service = createService();
      await expectLater(
        service.fetchByContainerId(10),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('SampleService.fillSamples (c-9-fill-offline-2a + 2a-fix)', () {
    late _MockApi api;
    late List<Map<String, dynamic>> localSaved;
    late List<_EnqueueCall> enqueued;
    late List<MapEntry<int, String>> updatedNumbers;
    late List<MapEntry<int, String>> updatedStatuses;

    setUp(() {
      api = _MockApi();
      localSaved = [];
      enqueued = [];
      updatedNumbers = [];
      updatedStatuses = [];
    });

    SampleService createService() {
      return SampleService(
        api,
        saveLocalOffline: ({required containerId, required samples}) async {
          localSaved.addAll(samples);
        },
        enqueue:
            ({
              required String action,
              required String endpoint,
              required Map<String, dynamic> payload,
            }) async {
              enqueued.add(_EnqueueCall(action, endpoint, payload));
            },
        updateContainerNumber: (id, number) async {
          updatedNumbers.add(MapEntry(id, number));
        },
        updateContainerStatus: (id, status) async {
          updatedStatuses.add(MapEntry(id, status));
        },
        setPendingSync: (id, pending) async {},
      );
    }

    test('онлайн: POST уходит, online, локально не сохраняет', () async {
      api.postData = {'total_samples': 3};
      final service = createService();
      final outcome = await service.fillSamples(
        10,
        containerNumber: 'T-001',
        workOrderCoded: 'TST0001',
        researchTypeId: 1,
        siteId: 2,
        sampleGroups: [
          {
            'prefix': 'TST',
            'middle': '124',
            'sequence_from': 1,
            'sequence_to': 3,
            'sequence_digits': 3,
            'well_name': '124',
            'status': 'NORMAL',
          },
        ],
      );

      expect(outcome, FillOutcome.online);
      expect(api.postCalls.length, 1);
      expect(localSaved, isEmpty);
      expect(enqueued, isEmpty);
      expect(updatedNumbers, isEmpty);
      expect(updatedStatuses, isEmpty);
    });

    test('офлайн: локальные пробы + enqueue, PENDING_PLACEMENT', () async {
      api.offline = true;
      final service = createService();
      final outcome = await service.fillSamples(
        10,
        workOrderCoded: 'TST0001',
        researchTypeId: 1,
        sampleGroups: [
          {
            'prefix': 'TST',
            'middle': '124',
            'sequence_from': 1,
            'sequence_to': 3,
            'sequence_digits': 3,
            'well_name': '124',
            'status': 'NORMAL',
          },
        ],
      );

      expect(outcome, FillOutcome.queued);
      expect(localSaved.length, 3);
      expect(localSaved.first['status'], 'PENDING_PLACEMENT');
      expect(localSaved.first['_prefix'], 'TST');
      expect(localSaved.first['_middle'], '124');
      expect(localSaved.first['_sequence'], 1);
      expect(localSaved.first['_sequence_digits'], 3);
      expect(localSaved.first['_well_name'], '124');
      expect(enqueued.length, 1);
    });

    test('офлайн: SELECTED → SELECTED', () async {
      api.offline = true;
      final service = createService();
      await service.fillSamples(
        10,
        workOrderCoded: 'TST0001',
        researchTypeId: 1,
        sampleGroups: [
          {
            'prefix': 'TST',
            'middle': '124',
            'sequence_from': 5,
            'sequence_to': 5,
            'sequence_digits': 3,
            'well_name': null,
            'status': 'SELECTED',
          },
        ],
      );
      expect(localSaved.first['status'], 'SELECTED');
    });

    test('офлайн: ТИ/участок попадают в локальные пробы', () async {
      api.offline = true;
      final service = createService();
      await service.fillSamples(
        10,
        workOrderCoded: 'TST0001',
        researchTypeId: 1,
        siteId: 2,
        researchTypeName: 'Шлифы',
        siteName: 'Тестовый',
        sampleGroups: [
          {
            'prefix': 'TST',
            'middle': '124',
            'sequence_from': 1,
            'sequence_to': 1,
            'sequence_digits': 3,
            'well_name': null,
            'status': 'NORMAL',
          },
        ],
      );
      expect(localSaved.first['research_type_name'], 'Шлифы');
      expect(localSaved.first['site_name'], 'Тестовый');
    });

    test('офлайн с container_number: updateContainerNumber вызван', () async {
      api.offline = true;
      final service = createService();
      await service.fillSamples(
        10,
        containerNumber: 'T-001',
        workOrderCoded: 'TST0001',
        researchTypeId: 1,
        sampleGroups: [
          {
            'prefix': 'TST',
            'middle': '124',
            'sequence_from': 1,
            'sequence_to': 1,
            'sequence_digits': 3,
            'well_name': null,
            'status': 'NORMAL',
          },
        ],
      );
      expect(updatedNumbers.length, 1);
      expect(updatedNumbers.first.value, 'T-001');
    });

    test(
      'офлайн без container_number: updateContainerNumber не вызван',
      () async {
        api.offline = true;
        final service = createService();
        await service.fillSamples(
          10,
          workOrderCoded: 'TST0001',
          researchTypeId: 1,
          sampleGroups: [
            {
              'prefix': 'TST',
              'middle': '124',
              'sequence_from': 1,
              'sequence_to': 1,
              'sequence_digits': 3,
              'well_name': null,
              'status': 'NORMAL',
            },
          ],
        );
        expect(updatedNumbers, isEmpty);
      },
    );

    test('офлайн: PENDING_PLACEMENT в updatedStatuses', () async {
      api.offline = true;
      final service = createService();
      await service.fillSamples(
        10,
        workOrderCoded: 'TST0001',
        researchTypeId: 1,
        sampleGroups: [
          {
            'prefix': 'TST',
            'middle': '124',
            'sequence_from': 1,
            'sequence_to': 1,
            'sequence_digits': 3,
            'well_name': null,
            'status': 'NORMAL',
          },
        ],
      );
      expect(updatedStatuses.length, 1);
      expect(updatedStatuses.first.key, 10);
      expect(updatedStatuses.first.value, 'PENDING_PLACEMENT');
    });

    test('валидация (не network): пробрасывается', () async {
      api.throwOnPost = ApiException(
        message: 'research_type_id: invalid',
        statusCode: 400,
        isNetworkError: false,
      );
      final service = createService();
      await expectLater(
        service.fillSamples(
          10,
          workOrderCoded: 'TST0001',
          researchTypeId: 1,
          sampleGroups: [
            {
              'prefix': 'TST',
              'middle': '124',
              'sequence_from': 1,
              'sequence_to': 1,
              'sequence_digits': 3,
              'well_name': null,
              'status': 'NORMAL',
            },
          ],
        ),
        throwsA(isA<ApiException>()),
      );
      expect(localSaved, isEmpty);
      expect(enqueued, isEmpty);
    });
  });

  group('SampleService.updateLocalOffline / deleteLocalOffline (2c-1)', () {
    late List<Map<String, dynamic>> locals;
    late Map<String, dynamic>? queuePayload;
    late List<MapEntry<String, Map<String, dynamic>>> updateCalls;
    late List<MapEntry<int, String>> localStatusUpdates;
    late List<int> localDeletes;

    setUp(() {
      locals = [];
      queuePayload = null;
      updateCalls = [];
      localStatusUpdates = [];
      localDeletes = [];
    });

    SampleService createService() {
      return SampleService(
        _MockApi(),
        getLocalNegative: (_) async => locals,
        updateLocalStatus: (sampleId, status) async {
          localStatusUpdates.add(MapEntry(sampleId, status));
          for (final l in locals) {
            if (l['id'] == sampleId) l['status'] = status;
          }
        },
        deleteLocal: (sampleId) async {
          localDeletes.add(sampleId);
          locals.removeWhere((l) => l['id'] == sampleId);
        },
        getQueuePayload: (_) async => queuePayload,
        updateQueuePayload: (endpoint, payload) async {
          updateCalls.add(MapEntry(endpoint, payload));
          queuePayload = payload;
          return true;
        },
      );
    }

    Map<String, dynamic> local({
      required int id,
      required String prefix,
      required String middle,
      required int seq,
      int digits = 3,
      String? well,
      String status = 'PENDING_PLACEMENT',
    }) {
      return {
        'id': id,
        'status': status,
        '_prefix': prefix,
        '_middle': middle,
        '_sequence': seq,
        '_sequence_digits': digits,
        '_well_name': well,
      };
    }

    test('updateLocalOffline: status обновлён + payload пересобран', () async {
      locals = [
        local(id: -1, prefix: 'TST', middle: '124', seq: 1),
        local(id: -2, prefix: 'TST', middle: '124', seq: 2),
      ];
      queuePayload = {
        'work_order_coded': 'TST0001',
        'research_type_id': 1,
        'sample_groups': [
          {
            'prefix': 'TST',
            'middle': '124',
            'sequence_from': 1,
            'sequence_to': 2,
            'sequence_digits': 3,
            'well_name': null,
            'status': 'NORMAL',
          },
        ],
      };
      final service = createService();
      await service.updateLocalOffline(
        -1,
        containerId: 10,
        status: SampleStatus.selected,
      );

      expect(localStatusUpdates.length, 1);
      expect(localStatusUpdates.first.key, -1);
      expect(localStatusUpdates.first.value, 'SELECTED');
      expect(updateCalls.length, 1);
      expect(updateCalls.first.key, '/storage/containers/10/fill-samples/');
      final groups = updateCalls.first.value['sample_groups'] as List;
      expect(groups.length, 2);
      final selected = groups.firstWhere(
        (g) => (g as Map)['status'] == 'SELECTED',
      );
      expect(selected['sequence_from'], 1);
      expect(selected['sequence_to'], 1);
      final normal = groups.firstWhere((g) => (g as Map)['status'] == 'NORMAL');
      expect(normal['sequence_from'], 2);
      expect(normal['sequence_to'], 2);
    });

    test('deleteLocalOffline: проба удалена + payload пересобран', () async {
      locals = [
        local(id: -1, prefix: 'TST', middle: '124', seq: 1),
        local(id: -2, prefix: 'TST', middle: '124', seq: 2),
      ];
      queuePayload = {
        'work_order_coded': 'TST0001',
        'research_type_id': 1,
        'sample_groups': [
          {
            'prefix': 'TST',
            'middle': '124',
            'sequence_from': 1,
            'sequence_to': 2,
            'sequence_digits': 3,
            'well_name': null,
            'status': 'NORMAL',
          },
        ],
      };
      final service = createService();
      await service.deleteLocalOffline(-1, containerId: 10);

      expect(localDeletes, [-1]);
      expect(updateCalls.length, 1);
      final groups = updateCalls.first.value['sample_groups'] as List;
      expect(groups.length, 1);
      expect((groups.first as Map)['sequence_from'], 2);
      expect((groups.first as Map)['sequence_to'], 2);
    });

    test('updateLocalOffline без payload в очереди: тихо игнорируем', () async {
      locals = [local(id: -1, prefix: 'TST', middle: '124', seq: 1)];
      queuePayload = null;
      final service = createService();
      await service.updateLocalOffline(
        -1,
        containerId: 10,
        status: SampleStatus.selected,
      );
      expect(localStatusUpdates.length, 1);
      expect(updateCalls, isEmpty);
    });
  });

  group('Sample.isOfflinePending', () {
    test('negative id → true', () {
      final s = Sample.fromJson({
        'id': -1,
        'sample_number': 'X',
        'status': 'PENDING_PLACEMENT',
      });
      expect(s.isOfflinePending, true);
    });

    test('positive id → false', () {
      final s = Sample.fromJson({
        'id': 5,
        'sample_number': 'X',
        'status': 'IN_STORAGE',
      });
      expect(s.isOfflinePending, false);
    });
  });
}
