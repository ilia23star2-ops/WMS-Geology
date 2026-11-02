/// Тесты моделей справочников и `CatalogService` (c-7b-full).
///
/// `Site.fromJson` / `ResearchType.fromJson` / `ContainerType.fromJson` —
/// парсинг. `CatalogService` — через fake HttpClientAdapter (без сети).
library;

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/catalog.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/catalog_service.dart';

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.responses);
  final Map<String, String> responses;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final path = options.uri.path;
    final body = responses[path];
    if (body == null) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'fake unreachable: $path',
      );
    }
    return ResponseBody.fromString(
      body,
      200,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio _dioWithResponses(Map<String, String> responses) {
  // baseUrl обязателен: CatalogService делает относительные запросы
  // (`/sites/`), они склеиваются с baseUrl.
  final dio = Dio(BaseOptions(baseUrl: 'http://test/api/v1'));
  dio.httpClientAdapter = _FakeAdapter(responses);
  return dio;
}

void main() {
  group('Site.fromJson', () {
    test('полный', () {
      final s = Site.fromJson({'id': 1, 'code': 'TST', 'name': 'Тестовый'});
      expect(s.id, 1);
      expect(s.code, 'TST');
      expect(s.name, 'Тестовый');
      expect(s.label, 'TST — Тестовый');
    });

    test('без code', () {
      final s = Site.fromJson({'id': 2, 'name': 'Без кода'});
      expect(s.code, '');
      expect(s.label, 'Без кода');
    });
  });

  group('ResearchType.fromJson', () {
    test('полный', () {
      final r = ResearchType.fromJson({'id': 1, 'code': 'ШЛ', 'name': 'Шлифы'});
      expect(r.label, 'ШЛ — Шлифы');
    });
  });

  group('ContainerType.fromJson', () {
    test('с лабораторией', () {
      final c = ContainerType.fromJson({
        'id': 1,
        'name': 'Коробка',
        'laboratory_name': 'ЛАБ-1',
      });
      expect(c.label, 'Коробка (ЛАБ-1)');
    });

    test('без лаборатории (общий)', () {
      final c = ContainerType.fromJson({'id': 2, 'name': 'Ящик'});
      expect(c.label, 'Ящик');
    });
  });

  group('CatalogService', () {
    test('fetchSites парсит results', () async {
      final dio = _dioWithResponses({
        '/api/v1/sites/':
            '{"count":1,"results":[{"id":1,"code":"TST","name":"Тестовый"}]}',
      });
      final service = CatalogService(ApiClient(dioOverride: dio));
      final sites = await service.fetchSites();
      expect(sites.length, 1);
      expect(sites.first.code, 'TST');
      expect(sites.first.label, 'TST — Тестовый');
    });

    test('fetchResearchTypes парсит results', () async {
      final dio = _dioWithResponses({
        '/api/v1/research-types/':
            '{"count":1,"results":[{"id":1,"code":"ШЛ","name":"Шлифы"}]}',
      });
      final service = CatalogService(ApiClient(dioOverride: dio));
      final types = await service.fetchResearchTypes();
      expect(types.length, 1);
      expect(types.first.code, 'ШЛ');
    });

    test('fetchContainerTypes парсит results', () async {
      final dio = _dioWithResponses({
        '/api/v1/storage/container-types/': '{"count":1,"results":[{"id":3,"name":"Коробка","laboratory_name":null}]}',
      });
      final service = CatalogService(ApiClient(dioOverride: dio));
      final types = await service.fetchContainerTypes();
      expect(types.length, 1);
      expect(types.first.id, 3);
      expect(types.first.label, 'Коробка');
    });
  });
}
