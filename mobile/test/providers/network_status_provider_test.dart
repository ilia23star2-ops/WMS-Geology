/// Тесты `NetworkStatusProvider` (c-6g).
///
/// Dio подменяется `HttpClientAdapter` — без сети.
library;

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/config.dart';
import 'package:wms_geology_mobile/providers/network_status_provider.dart';

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
      return ResponseBody.fromString('{"status":"ok"}', 200);
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
  tearDown(() => AppConfig.setResolvedHost(null));

  test('online: ping ok → isOnline=true, lastHost=127.0.0.1', () async {
    AppConfig.setResolvedHost('127.0.0.1');
    final p = NetworkStatusProvider(dio: _dioWithAlive({'127.0.0.1'}));
    await p.pingNow();
    expect(p.isOnline, isTrue);
    expect(p.lastHost, '127.0.0.1');
    p.dispose();
  });

  test(
    'USB выдернули, WiFi жив → switch на 192.168.0.77 + onBaseUrlChanged',
    () async {
      AppConfig.setResolvedHost('127.0.0.1');
      String? captured;
      final p = NetworkStatusProvider(dio: _dioWithAlive({'192.168.0.77'}));
      p.onBaseUrlChanged = (url) => captured = url;
      await p.pingNow();
      expect(p.isOnline, isTrue);
      expect(p.lastHost, '192.168.0.77');
      expect(captured, 'http://192.168.0.77:8000/api/v1');
      expect(AppConfig.apiBaseUrl, 'http://192.168.0.77:8000/api/v1');
      p.dispose();
    },
  );

  test('все мертвы → isOnline=false', () async {
    AppConfig.setResolvedHost('127.0.0.1');
    final p = NetworkStatusProvider(dio: _dioWithAlive({}));
    await p.pingNow();
    expect(p.isOnline, isFalse);
    expect(p.lastHost, isNull);
    p.dispose();
  });
}
