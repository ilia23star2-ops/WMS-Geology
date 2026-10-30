/// Тесты auto-detect сети (c-6c).
///
/// Покрывают `NetworkProbe.resolve` (первый/второй живой, все мертвы,
/// пустой список) и `AppConfig.resolve` (probe + fallback).
/// Dio подменяется через `HttpClientAdapter` — без сети.
library;

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/config.dart';
import 'package:wms_geology_mobile/services/network_probe.dart';

/// Фейковый HttpClientAdapter: «живёт» только для хостов из [aliveHosts].
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.aliveHosts);
  final Set<String> aliveHosts;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final host = Uri.parse(options.uri.toString()).host;
    if (aliveHosts.contains(host)) {
      return ResponseBody.fromString(
        '{"status":"ok"}',
        200,
        headers: {
          'content-type': ['application/json'],
        },
      );
    }
    throw DioException.connectionError(
      requestOptions: options,
      reason: 'fake unreachable',
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio _dioWithAlive(Set<String> alive) {
  final dio = Dio(BaseOptions(connectTimeout: const Duration(seconds: 1)));
  dio.httpClientAdapter = _FakeAdapter(alive);
  return dio;
}

void main() {
  group('NetworkProbe.resolve', () {
    test('возвращает первый живой хост', () async {
      final dio = _dioWithAlive({'127.0.0.1'});
      final r = await NetworkProbe.resolve(
        candidates: ['127.0.0.1', '192.168.0.77'],
        dio: dio,
      );
      expect(r, '127.0.0.1');
    });

    test('возвращает второй, если первый мёртв', () async {
      final dio = _dioWithAlive({'192.168.0.77'});
      final r = await NetworkProbe.resolve(
        candidates: ['127.0.0.1', '192.168.0.77'],
        dio: dio,
      );
      expect(r, '192.168.0.77');
    });

    test('null, если все мертвы', () async {
      final dio = _dioWithAlive({});
      final r = await NetworkProbe.resolve(
        candidates: ['127.0.0.1', '192.168.0.77', '10.0.2.2'],
        dio: dio,
      );
      expect(r, isNull);
    });

    test('null, если список кандидатов пуст', () async {
      final r = await NetworkProbe.resolve(candidates: []);
      expect(r, isNull);
    });
  });

  group('AppConfig', () {
    tearDown(() => AppConfig.setResolvedHost(null));

    test('fallback, если все хосты мертвы', () async {
      AppConfig.setResolvedHost(null);
      final dio = _dioWithAlive({});
      await AppConfig.resolve(dio: dio);
      expect(AppConfig.apiBaseUrl, 'http://192.168.0.77:8000/api/v1');
    });

    test('apiBaseUrl на 127.0.0.1, если он живой', () async {
      AppConfig.setResolvedHost(null);
      final dio = _dioWithAlive({'127.0.0.1'});
      await AppConfig.resolve(dio: dio);
      expect(AppConfig.apiBaseUrl, 'http://127.0.0.1:8000/api/v1');
    });
  });
}
