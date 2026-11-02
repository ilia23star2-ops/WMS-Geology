/// Тесты `SyncService` (c-2, c-7-offline-catalog).
///
/// `pullAll` тянет:
/// - `containers`, `samples` — постранично, с реальными данными;
/// - 9 справочников (`sites`, `research-types`, `laboratories`,
///   `storage/container-types`, `storage/rooms`, `storage/racks`,
///   `storage/sections`, `storage/tiers`, `storage/cells`) — по одной
///   записи на эндпоинт, чтобы `saveCatalog` реально вызывался.
///
/// `saveCatalog` / `saveContainers` / `saveSamples` подменяются на
/// списки в памяти (без SQLite).
///
/// ВАЖНО: `_pullCatalog` на **пустой** странице `saveCatalog` не вызывает
/// (не перезаписываем кэш пустотой) — поэтому fake отдаёт по одной записи.
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
      // c-7-offline-catalog: 9 эндпоинтов справочников.
      // Одна запись — чтобы saveCatalog реально вызывался (пустая
      // страница = save не вызывается, чтобы не затирать кэш).
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

    final service = SyncService(
      client,
      saveContainers: (list) async => savedContainers.addAll(list),
      saveSamples: (list) async => savedSamples.addAll(list),
      saveCatalog: (kind, items) async => savedCatalogs[kind] = items,
    );

    await service.pullAll();

    // Тары: 3 (2 из первой страницы, 1 из второй).
    expect(savedContainers.length, 3);
    expect(savedContainers[0]['id'], 1);
    expect(savedContainers[2]['id'], 3);

    // Пробы: 1.
    expect(savedSamples.length, 1);
    expect(savedSamples[0]['id'], 10);

    // Справочники: 9 вызовов saveCatalog, по одному на эндпоинт.
    expect(savedCatalogs.length, 9);
    expect(savedCatalogs.keys.toSet(), _catalogEndpoints.values.toSet());

    // Все 9 catalog-эндпоинтов были запрошены.
    for (final endpoint in _catalogEndpoints.keys) {
      expect(
        client.calls,
        contains(endpoint),
        reason: 'Ожидался запрос к $endpoint',
      );
    }
  });
}
