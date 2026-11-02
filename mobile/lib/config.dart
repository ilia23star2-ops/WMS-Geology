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
  static const String _apiHostOverride = String.fromEnvironment(
    'API_HOST',
    defaultValue: '',
  );

  /// `true`, если хост задан через `--dart-define=API_HOST`.
  /// В этом случае `NetworkStatusProvider` не свапает хост (только статус).
  static bool get isHostOverridden => _apiHostOverride.isNotEmpty;

  static const List<String> _autoDetectCandidates = [
    '127.0.0.1', // USB adb reverse
    '192.168.0.77', // WiFi дома
    '10.0.2.2', // Android-эмулятор
  ];

  static const String _fallbackHost = '192.168.0.77';

  static String? _resolvedHost;

  /// Определить и закэшировать хост.
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

  /// Хост без `/api/v1` — для пинга `/health/`.
  static String get apiHost => _resolvedHost ?? _fallbackHost;

  /// Установить хост вручную.
  ///
  /// Используется:
  /// - `NetworkStatusProvider._ping` при auto-switch (production);
  /// - тестами для сброса состояния (`setResolvedHost(null)`).
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
