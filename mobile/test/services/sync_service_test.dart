/// Тесты `SyncService` (c-2, c-7-offline-catalog, c-7e-3).
///
/// `pullAll` тянет:
/// - `containers`, `samples` — постранично;
/// - 9 справочников (`sites`, `research-types`, `laboratories`,
///   `storage/container-types`, `storage/rooms`, `storage/racks`,
///   `storage/sections`, `storage/tiers`, `storage/cells`);
/// - **историю каждой тары** (c-7e-3) — `saveHistory` вызывается N раз.
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
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

/// Регулярка для `/storage/containers/{id}/history/`.
final _historyRe = RegExp(r'^/storage/containers/(\d+)/history/$');

class FakeApiClient extends ApiClient {
  FakeApiClient() : super(dioOverride: Dio());

  final List<String> calls = [];

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    calls.add(path);
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
    } else if (_historyRe.hasMatch(path)) {
      final id = int.parse(_historyRe.firstMatch(path)!.group(1)!);
      return Response<T>(
        requestOptions: req,
        statusCode: 200,
        data: [
          {
            'id': id * 100 + 1,
            'action': 'CREATE',
            'action_display': 'Создана',
            'created_at': '2026-11-02T10:00:00Z',
          },
        ] as T,
      );
    }

    throw Exception('Unexpected path: $path, page: $page');
  }
}

void main() {
  test('SyncService pulls all containers and samples in pages', () async {
    final client = FakeApiClient();
    final savedContainers = <Map<String, dynamic>>[];
    final savedSamples = <Map<String, dynamic>>[];
    final savedCatalogs = <String, List<Map<String, dynamic>>>{};
    final savedHistory = <int, List<Map<String, dynamic>>>{};

    final service = SyncService(
      client,
      saveContainers: (list) async => savedContainers.addAll(list),
      saveSamples: (list) async => savedSamples.addAll(list),
      saveCatalog: (kind, items) async => savedCatalogs[kind] = items,
      saveHistory: (containerId, items) async =>
          savedHistory[containerId] = items,
    );

    await service.pullAll();

    // Тары: 3.
    expect(savedContainers.length, 3);
    expect(savedContainers[0]['id'], 1);
    expect(savedContainers[2]['id'], 3);

    // Пробы: 1.
    expect(savedSamples.length, 1);
    expect(savedSamples[0]['id'], 10);

    // Справочники: 9.
    expect(savedCatalogs.length, 9);
    expect(savedCatalogs.keys.toSet(), _catalogEndpoints.values.toSet());

    // c-7e-3: история для каждой тары (1, 2, 3).
    expect(savedHistory.keys.toSet(), {1, 2, 3});
    for (final id in [1, 2, 3]) {
      expect(savedHistory[id]!.length, 1);
      expect(savedHistory[id]!.first['action'], 'CREATE');
    }
    expect(client.calls, contains('/storage/containers/1/history/'));
    expect(client.calls, contains('/storage/containers/2/history/'));
    expect(client.calls, contains('/storage/containers/3/history/'));
  });

  test('ошибка истории по одной таре не валит Pull', () async {
    // Отдельный fake: на /history/ для тары #2 — исключение.
    final client = _FailingHistoryApi();
    final savedHistory = <int, List<Map<String, dynamic>>>{};

    final service = SyncService(
      client,
      saveContainers: (_) async {},
      saveSamples: (_) async {},
      saveCatalog: (_, __) async {},
      saveHistory: (containerId, items) async =>
          savedHistory[containerId] = items,
    );

    await service.pullAll();

    // История для тары #2 упала, но Pull завершился.
    expect(savedHistory.keys.toSet(), {1, 3});
  });
}

/// Fake, где `/history/` для тары #2 бросает.
class _FailingHistoryApi extends ApiClient {
  _FailingHistoryApi() : super(dioOverride: Dio());

  final _historyRe = RegExp(r'^/storage/containers/(\d+)/history/$');

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    final req = RequestOptions(path: path);
    final page = queryParameters?['page'] as int? ?? 1;

    if (path == '/storage/containers/') {
      return Response<T>(
        requestOptions: req,
        statusCode: 200,
        data: {
          'next': null,
          'results': [
            {'id': 1, 'container_number': 'T-1'},
            {'id': 2, 'container_number': 'T-2'},
            {'id': 3, 'container_number': 'T-3'},
          ],
        } as T,
      );
    } else if (path == '/samples/' || _catalogEndpoints.containsKey(path)) {
      return Response<T>(
        requestOptions: req,
        statusCode: 200,
        data: {'next': null, 'results': <Map<String, dynamic>>[]} as T,
      );
    } else if (_historyRe.hasMatch(path)) {
      final id = int.parse(_historyRe.firstMatch(path)!.group(1)!);
      if (id == 2) {
        throw ApiException(message: 'boom', statusCode: 500);
      }
      return Response<T>(
        requestOptions: req,
        statusCode: 200,
        data: [
          {'id': id, 'action': 'CREATE'},
        ] as T,
      );
    }
    throw Exception('Unexpected: $path page=$page');
  }
}
