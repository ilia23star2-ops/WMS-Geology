/// Тесты `SampleService.fetchByContainerId` (c-7e-1).
///
/// Проверяем:
/// - онлайн: данные с сервера, кэш обновляется;
/// - офлайн с кэшем: возвращает кэш;
/// - офлайн с пустым кэшем: возвращает `[]`, **не** бросает (это и был баг);
/// - валидационная ошибка (не network): пробрасывается.
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/sample_service.dart';

class _MockApi extends Fake implements ApiClient {
  bool offline = false;
  Object? otherError;
  List<Map<String, dynamic>> results = const [];

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
}

void main() {
  group('SampleService.fetchByContainerId (c-7e-1)', () {
    late _MockApi api;
    late List<Map<String, dynamic>> cached;
    late List<Map<String, dynamic>> savedToCache;

    setUp(() {
      api = _MockApi();
      cached = [];
      savedToCache = [];
    });

    SampleService createService() {
      return SampleService(
        api,
        saveSamples: (raw) async => savedToCache.addAll(raw),
        getCached: (_) async => cached,
      );
    }

    test('онлайн: возвращает данные с сервера, пишет в кэш', () async {
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
      expect(savedToCache.length, 2);
    });

    test('онлайн, пустая тара: пустой список, кэш обновляется', () async {
      api.results = const [];
      final service = createService();
      final list = await service.fetchByContainerId(10);
      expect(list, isEmpty);
      expect(savedToCache, isEmpty);
    });

    test('офлайн с кэшем: возвращает кэш', () async {
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
    });

    test('офлайн с пустым кэшем (пустая тара): [] без ошибки', () async {
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
}
