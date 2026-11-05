/// Тесты `CatalogService` (c-8-catalog-create + c-8-catalog-create-offline).
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/catalog_service.dart';

class _MockApi extends Fake implements ApiClient {
  final List<MapEntry<String, Object?>> postCalls = [];
  Object? throwOnPost;
  Object? postData;

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
}

class _EnqueueCall {
  _EnqueueCall(this.action, this.endpoint, this.payload, this.localRef);
  final String action;
  final String endpoint;
  final Map<String, dynamic> payload;
  final String? localRef;
}

void main() {
  group('CatalogService.create (c-8-catalog-create)', () {
    late _MockApi client;
    late List<Map<String, dynamic>> savedCatalog;
    late List<_EnqueueCall> enqueued;
    int nextNegative = -1000;
    final savedLocalIds = <int>[];

    setUp(() {
      client = _MockApi();
      savedCatalog = [];
      enqueued = [];
      savedLocalIds.clear();
      nextNegative = -1000;
    });

    CatalogService createService() {
      return CatalogService(
        client,
        saveCatalog: (kind, items, {parentId}) async {
          savedCatalog.addAll(items);
        },
        saveLocalOffline: (kind, payload) async {
          final id = nextNegative--;
          savedLocalIds.add(id);
          return id;
        },
        enqueue:
            ({
              required String action,
              required String endpoint,
              required Map<String, dynamic> payload,
              String? localRef,
            }) async {
              enqueued.add(_EnqueueCall(action, endpoint, payload, localRef));
            },
      );
    }

    test('онлайн: POST уходит, id из ответа, queued=false', () async {
      client.postData = {'id': 42, 'code': 'TST', 'name': 'Тестовый'};
      final result = await createService().create('site', {
        'code': 'TST',
        'name': 'Тестовый',
      });

      expect(result.id, 42);
      expect(result.queued, isFalse);
      expect(client.postCalls.length, 1);
      expect(client.postCalls.first.key, '/sites/');
      expect(savedCatalog.length, 1);
      expect(enqueued, isEmpty);
      expect(savedLocalIds, isEmpty);
    });

    test('офлайн: saveLocalOffline + enqueue + queued=true', () async {
      client.throwOnPost = ApiException(
        message: 'timeout',
        isNetworkError: true,
      );
      final result = await createService().create('site', {
        'code': 'TST',
        'name': 'Тестовый',
      });

      expect(result.queued, isTrue);
      expect(result.id, lessThan(0));
      expect(savedLocalIds, [result.id]);
      expect(enqueued.length, 1);
      expect(enqueued.first.action, 'POST');
      expect(enqueued.first.endpoint, '/sites/');
      expect(enqueued.first.localRef, '${result.id}');
      expect(enqueued.first.payload['code'], 'TST');
    });

    test('офлайн research_type: endpoint /research-types/', () async {
      client.throwOnPost = ApiException(
        message: 'нет сети',
        isNetworkError: true,
      );
      await createService().create('research_type', {
        'code': 'ШЛ',
        'name': 'Шлифы',
      });
      expect(enqueued.first.endpoint, '/research-types/');
    });

    test('офлайн laboratory: endpoint /laboratories/', () async {
      client.throwOnPost = ApiException(
        message: 'нет сети',
        isNetworkError: true,
      );
      await createService().create('laboratory', {
        'code': 'ЛАБ-1',
        'name': 'Лаборатория 1',
      });
      expect(enqueued.first.endpoint, '/laboratories/');
    });

    test('офлайн container_type: endpoint /storage/container-types/', () async {
      client.throwOnPost = ApiException(
        message: 'нет сети',
        isNetworkError: true,
      );
      await createService().create('container_type', {
        'name': 'Ящик',
        'size_class': 'M',
      });
      expect(enqueued.first.endpoint, '/storage/container-types/');
    });

    test('валидация (4xx): пробрасывается, очередь пуста', () async {
      client.throwOnPost = ApiException(
        message: 'code: duplicate',
        statusCode: 400,
        isNetworkError: false,
      );
      await expectLater(
        createService().create('site', {'code': 'TST', 'name': 'X'}),
        throwsA(isA<ApiException>()),
      );
      expect(enqueued, isEmpty);
      expect(savedLocalIds, isEmpty);
    });

    test('неизвестный kind → ArgumentError', () async {
      await expectLater(
        createService().create('unknown', {'name': 'X'}),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
