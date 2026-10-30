/// Конфигурация приложения WMS Geology Mobile.
///
/// URL API определяется в таком порядке:
/// 1. `--dart-define=API_HOST=...` — если задан, probe не запускается.
/// 2. Auto-detect (c-6c): параллельный ping `/health/` на
///    `127.0.0.1` (USB), `192.168.0.77` (WiFi дома), `10.0.2.2` (эмулятор).
///    Первый живой → используется.
/// 3. Fallback `192.168.0.77` — если все мертвы (офлайн).
///
/// Пример:
///   flutter run --dart-define=API_HOST=127.0.0.1      # USB, явно
///   flutter run                                       # auto-detect
library;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'services/network_probe.dart';

class AppConfig {
  AppConfig._();

  // --- URL API ---
  // Если задан через --dart-define — используется без probe.
  static const String _apiHostOverride = String.fromEnvironment(
    'API_HOST',
    defaultValue: '',
  );

  /// Кандидаты для auto-detect (порядок = приоритет).
  static const List<String> _autoDetectCandidates = [
    '127.0.0.1', // USB adb reverse
    '192.168.0.77', // WiFi дома
    '10.0.2.2', // Android-эмулятор
  ];

  /// Fallback, если ни один кандидат не ответил.
  static const String _fallbackHost = '192.168.0.77';

  static String? _resolvedHost;

  /// Определить и закэшировать хост.
  ///
  /// Вызывается из `main()` до `runApp()`. Если `--dart-define=API_HOST`
  /// задан — probe не запускается, override имеет приоритет.
  ///
  /// [dio] — для тестов (подмена HttpClientAdapter).
  static Future<void> resolve({Dio? dio}) async {
    if (_apiHostOverride.isNotEmpty) {
      _resolvedHost = _apiHostOverride;
      if (kDebugMode) {
        debugPrint('[AppConfig] host (override): $_resolvedHost');
      }
      return;
    }

    final host = await NetworkProbe.resolve(
      candidates: _autoDetectCandidates,
      dio: dio,
    );
    _resolvedHost = host ?? _fallbackHost;

    if (kDebugMode) {
      debugPrint(
        '[AppConfig] host (probe): $_resolvedHost'
        '${host == null ? " (fallback)" : ""}',
      );
    }
  }

  /// Базовый URL API v1.
  static String get apiBaseUrl {
    final host = _resolvedHost ?? _fallbackHost;
    return 'http://$host:8000/api/v1';
  }

  /// Для тестов: сбросить закэшированный хост.
  @visibleForTesting
  static void setResolvedHost(String? host) {
    _resolvedHost = host;
  }

  // --- Таймауты HTTP ---
  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // --- Ключи хранилища ---
  static const String tokenAccessKey = 'wms_access_token';
  static const String tokenRefreshKey = 'wms_refresh_token';

  // --- Версия ---
  static const String appVersion = '0.1.0';
}
