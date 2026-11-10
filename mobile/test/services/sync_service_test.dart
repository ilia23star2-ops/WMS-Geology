/// Тесты `SyncService` (c-2, c-7-offline-catalog, c-7e-3,
/// c-9-fill-offline-2c-3-fix-3a, c-6b-updated-since, ТД-59).
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sync_queue_dao.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/sync_service.dart';

const _catalogEndpoints = <String, String>{
  '/sites/': 'site',
  '/research-types/': 'research_type',
  '/laboratories/': 'laboratory',
  '/storage/container-types/': 'container_type',
  '/storage/rooms/': 'room',
  '/storage/racks/': 'rack',
  '/storage/sections/': 'section',
  '/storage/tiers/': 'tier',
  '/storage/cells/': 'cell',
};

class FakeApiClient extends ApiClient {
  FakeApiClient() : super(dioOverride: Dio());

  final List<String> calls = [];
  final List<Map<String, dynamic>?> queryParams = [];

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    calls.add(path);
    queryParams.add(queryParameters);
    final page = queryParameters?['page'] as int? ?? 1;
    final req = RequestOptions(path: path);

    if (path == '/storage/containers/') {
      if (page == 1) {
        return Response<T>(
          requestOptions: req,
          statusCode: 200,
          data: {
            'next': 'http://localhost:8000/api/v1/storage/containers/?page=2',
            'results': [
              {'id': 1, 'container_number': 'T-1'},
              {'id': 2, 'container_number': 'T-2'},
            ],
          } as T,
        );
      } else if (page == 2) {
        return Response<T>(
          requestOptions: req,
          statusCode: 200,
          data: {
            'next': null,
            'results': [
              {'id': 3, 'container_number': 'T-3'},
            ],
          } as T,
        );
      }
    } else if (path == '/samples/') {
      if (page == 1) {
        return Response<T>(
          requestOptions: req,
          statusCode: 200,
          data: {
            'next': null,
            'results': [
              {'id': 10, 'sample_number': 'S-1'},
            ],
          } as T,
        );
      }
    } else if (_catalogEndpoints.containsKey(path)) {
      return Response<T>(
        requestOptions: req,
        statusCode: 200,
        data: {
          'next': null,
          'results': [
            {'id': 1, 'name': 'item-$path'},
          ],
        } as T,
      );
    } else if (path == '/audit-logs/') {
      // ТД-59: отдаем батч-историю (группировку делает клиент)
      return Response<T>(
        requestOptions: req,
        statusCode: 200,
        data: {
          'next': null,
          'results': [
            {
              'id': 101,
              'entity_id': 1,
              'action': 'CREATE',
              'action_display': 'Создана',
              'created_at': '2026-11-02T10:00:00Z',
            },
            {
              'id': 102,
              'entity_id': 2,
              'action': 'UPDATE',
              'action_display': 'Изменена',
              'created_at': '2026-11-02T10:05:00Z',
            },
          ],
        } as T,
      );
    }

    throw Exception('Unexpected path: $path, page: $page');
  }
}

void main() {
  test('pullAll без updatedSince — полный Pull, PullStats по числу', () async {
    final client = FakeApiClient();
    final savedContainers = <Map<String, dynamic>>[];
    final savedSamples = <Map<String, dynamic>>[];
    final savedHistory = <int, List<Map<String, dynamic>>>{};

    final service = SyncService(
      client,
      saveContainers: (list) async => savedContainers.addAll(list),
      saveSamples: (list) async => savedSamples.addAll(list),
      saveCatalog: (_, __) async {},
      saveHistory: (id, items) async => savedHistory[id] = items,
      getQueueItems: () async => const [],
      reconcileSamples: (_) async => 0,
      reconcileContainers: (_) async => 0,
    );

    final stats = await service.pullAll();

    expect(stats.containers, 3);
    expect(stats.samples, 1);
    expect(stats.total, 4);
    // Ни в одном запросе нет updated_since.
    for (final q in client.queryParams) {
      if (q != null) expect(q.containsKey('updated_since'), isFalse);
    }
    // Проверяем, что история сгруппировалась по контейнерам
    expect(savedHistory.keys.toSet(), {1, 2});
    expect(savedHistory[1]!.first['action'], 'CREATE');
    expect(savedHistory[2]!.first['action'], 'UPDATE');
  });

  test(
    'pullAll(updatedSince) — ?updated_since= уходит в containers/samples/audit',
    () async {
      final client = FakeApiClient();
      final since = DateTime.utc(2026, 11, 2, 10);

      final service = SyncService(
        client,
        saveContainers: (_) async {},
        saveSamples: (_) async {},
        saveCatalog: (_, __) async {},
        saveHistory: (_, __) async {},
        getQueueItems: () async => const [],
        reconcileSamples: (_) async => 0,
        reconcileContainers: (_) async => 0,
      );

      await service.pullAll(updatedSince: since);

      final hasUpdated = client.queryParams.any(
        (q) => q != null && q['updated_since'] == '2026-11-02T10:00:00.000Z',
      );
      expect(hasUpdated, isTrue);
    },
  );

  test(
    'reconcile: пробы без записи в очереди — сброс, с записью — нет',
    () async {
      final client = FakeApiClient();
      Set<int>? keptSampleIds;
      Set<int>? keptContainerIds;

      final service = SyncService(
        client,
        saveContainers: (_) async {},
        saveSamples: (_) async {},
        saveCatalog: (_, __) async {},
        saveHistory: (_, __) async {},
        getQueueItems: () async => [
          SyncQueueItem(
            id: 1,
            action: 'PATCH',
            endpoint: '/samples/5/',
            payload: const {'status': 'SELECTED'},
            createdAt: '2026-11-02T10:00:00Z',
          ),
          SyncQueueItem(
            id: 2,
            action: 'POST',
            endpoint: '/samples/7/dispose/',
            payload: const {'disposal_reason': ''},
            createdAt: '2026-11-02T10:00:01Z',
          ),
          SyncQueueItem(
            id: 3,
            action: 'POST',
            endpoint: '/storage/containers/10/fill-samples/',
            payload: const {},
            createdAt: '2026-11-02T10:00:02Z',
          ),
          SyncQueueItem(
            id: 4,
            action: 'POST',
            endpoint: '/storage/containers/bulk-place/',
            payload: const {
              'container_ids': [11, 12],
            },
            createdAt: '2026-11-02T10:00:03Z',
          ),
        ],
        reconcileSamples: (ids) async {
          keptSampleIds = ids;
          return 0;
        },
        reconcileContainers: (ids) async {
          keptContainerIds = ids;
          return 0;
        },
      );

      await service.pullAll();

      expect(keptSampleIds, {5, 7});
      expect(keptContainerIds, {10, 11, 12});
    },
  );
}
