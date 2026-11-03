/// Тесты `SampleService` (c-7e-1, c-9-fill-samples-offline,
/// c-9-fill-samples-offline-2a).
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

  group('SampleService.fillSamples (c-9-fill-samples-offline + 2a)', () {
    late _MockApi api;
    late List<Map<String, dynamic>> localSaved;
    late List<_EnqueueCall> enqueued;
    late List<MapEntry<int, String>> updatedNumbers;

    setUp(() {
      api = _MockApi();
      localSaved = [];
      enqueued = [];
      updatedNumbers = [];
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
      );
    }

    test(
      'онлайн: POST уходит, возвращает online, локально не сохраняет',
      () async {
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
        expect(api.postCalls.first.key, '/storage/containers/10/fill-samples/');
        expect(localSaved, isEmpty);
        expect(enqueued, isEmpty);
        expect(updatedNumbers, isEmpty);
      },
    );

    test(
      'офлайн: локальные пробы + enqueue, статус PENDING_PLACEMENT',
      () async {
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
        expect(localSaved.map((s) => s['sample_number']).toList(), [
          'TST124001',
          'TST124002',
          'TST124003',
        ]);
        // c-9-fill-samples-offline-2a: NORMAL → PENDING_PLACEMENT.
        expect(localSaved.first['status'], 'PENDING_PLACEMENT');
        expect(localSaved.first['well_name'], '124');
        expect(enqueued.length, 1);
        expect(enqueued.first.action, 'POST');
        expect(enqueued.first.endpoint, '/storage/containers/10/fill-samples/');
        expect(enqueued.first.payload['work_order_coded'], 'TST0001');
      },
    );

    test('офлайн: SELECTED → SELECTED (не PENDING_PLACEMENT)', () async {
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
      expect(localSaved.length, 1);
      expect(localSaved.first['status'], 'SELECTED');
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
      expect(updatedNumbers.first.key, 10);
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

    test('офлайн: несколько групп разворачиваются в плоский список', () async {
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
            'sequence_to': 2,
            'sequence_digits': 3,
            'well_name': null,
            'status': 'NORMAL',
          },
          {
            'prefix': 'TST',
            'middle': '124',
            'sequence_from': 5,
            'sequence_to': 6,
            'sequence_digits': 3,
            'well_name': null,
            'status': 'SELECTED',
          },
        ],
      );

      expect(localSaved.length, 4);
      expect(localSaved.map((s) => s['sample_number']).toList(), [
        'TST124001',
        'TST124002',
        'TST124005',
        'TST124006',
      ]);
      expect(localSaved[0]['status'], 'PENDING_PLACEMENT');
      expect(localSaved[2]['status'], 'SELECTED');
    });

    test(
      'валидация (не network): пробрасывается, локально не сохраняет',
      () async {
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
        expect(updatedNumbers, isEmpty);
      },
    );
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
