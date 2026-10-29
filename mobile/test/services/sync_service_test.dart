import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/sync_service.dart';

/// Фейковый ApiClient для теста, который возвращает заданные страницы.
class FakeApiClient extends ApiClient {
  FakeApiClient() : super(dioOverride: Dio());

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
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
            'next': null, // последняя страница
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
    }

    throw Exception('Unexpected path: $path, page: $page');
  }
}

void main() {
  test('SyncService pulls all containers and samples in pages', () async {
    final client = FakeApiClient();
    final savedContainers = <Map<String, dynamic>>[];
    final savedSamples = <Map<String, dynamic>>[];

    // Передаём кастомные функции сохранения, чтобы не использовать SQLite
    final service = SyncService(
      client,
      saveContainers: (list) async => savedContainers.addAll(list),
      saveSamples: (list) async => savedSamples.addAll(list),
    );

    await service.pullAll();

    // Должны скачаться 3 тары (2 из первой страницы, 1 из второй)
    expect(savedContainers.length, 3);
    expect(savedContainers[0]['id'], 1);
    expect(savedContainers[2]['id'], 3);

    // Должна скачаться 1 проба
    expect(savedSamples.length, 1);
    expect(savedSamples[0]['id'], 10);
  });
}
