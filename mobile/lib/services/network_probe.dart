/// Проверка «есть ли бэкенд на этом адресе» через GET /health/.
///
/// Используется в `AppConfig.resolve()` для auto-detect сети:
/// - `127.0.0.1` — USB (`adb reverse`).
/// - `192.168.0.77` — WiFi (домашний ПК).
/// - `10.0.2.2` — Android-эмулятор.
///
/// Пишет на `/health/` (c-6a), который отдаёт `{"status":"ok"}` без авторизации.
library;

import 'package:dio/dio.dart';

class NetworkProbe {
  NetworkProbe._();

  /// Таймаут одного пинга. Должен быть меньше таймаутов ApiClient:
  /// это только проверка живости, не передача данных.
  static const Duration timeout = Duration(seconds: 2);

  /// Порт бэкенда (совпадает с `AppConfig`).
  static const int port = 8000;

  /// Возвращает первый живой хост из [candidates] (порядок сохраняется)
  /// или `null`, если ни один не ответил.
  ///
  /// Проверки идут параллельно. Если [dio] передан — используется он
  /// (для тестов). Иначе создаётся одноразовый клиент с таймаутом [timeout]
  /// и закрывается в `finally`.
  static Future<String?> resolve({
    required List<String> candidates,
    Dio? dio,
  }) async {
    if (candidates.isEmpty) return null;

    final client =
        dio ??
        Dio(BaseOptions(connectTimeout: timeout, receiveTimeout: timeout));
    final owned = dio == null;

    try {
      final probes = candidates.map((h) => _ping(client, h)).toList();
      final results = await Future.wait(probes);
      for (var i = 0; i < candidates.length; i++) {
        if (results[i]) return candidates[i];
      }
      return null;
    } finally {
      if (owned) client.close(force: true);
    }
  }

  static Future<bool> _ping(Dio client, String host) async {
    try {
      final r = await client.get('http://$host:$port/health/');
      return r.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
