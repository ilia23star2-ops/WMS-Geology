/// Статус сети с периодическим ping `/health/` (c-6g, c-6g-tap-ping).
///
/// Упрощённая версия откаченного `NetworkMonitor`:
/// - Timer.periodic (10 с) пингует `/health/` текущего `AppConfig.apiHost`.
/// - Если fail — пробует `NetworkProbe.resolve` (auto-detect заново).
/// - При смене хоста — вызывает `onBaseUrlChanged` (инжектируется из
///   `AuthGate`, чтобы обновить `ApiClient.dio.options.baseUrl`).
/// - При `--dart-define=API_HOST` — только статус, без swap.
///
/// c-6g-tap-ping: `pingNow()` — публичный метод для кнопки на иконке
/// `NetworkBadge` (быстрый реконект без ожидания 10-сек heartbeat).
///
/// Без `WidgetsBindingObserver` (lifecycle) — минимальные зависимости.
library;

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config.dart';
import '../services/network_probe.dart';

class NetworkStatusProvider extends ChangeNotifier {
  NetworkStatusProvider({
    Dio? dio,
    this.interval = const Duration(seconds: 10),
    this.timeout = const Duration(seconds: 2),
  }) : _dio =
           dio ??
           Dio(
             BaseOptions(
               connectTimeout: const Duration(seconds: 2),
               receiveTimeout: const Duration(seconds: 2),
             ),
           );

  final Dio _dio;
  final Duration interval;
  final Duration timeout;

  Timer? _timer;
  bool _isOnline = true;
  String? _lastHost;

  /// Вызывается при смене `baseUrl`. Регистрируется в `AuthGate`,
  /// чтобы обновить `AuthService.apiClient.dio.options.baseUrl`.
  void Function(String url)? onBaseUrlChanged;

  bool get isOnline => _isOnline;
  String? get lastHost => _lastHost;

  Future<void> start() async {
    await _ping();
    _timer?.cancel();
    _timer = Timer.periodic(interval, (_) => _ping());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Один цикл проверки. Публично — для тестов и для кнопки на
  /// `NetworkBadge` (быстрый реконект без ожидания 10-сек heartbeat).
  Future<void> pingNow() => _ping();

  Future<void> _ping() async {
    final currentHost = AppConfig.apiHost;

    // 1. Пинг текущего хоста.
    try {
      final resp = await _dio.get(
        'http://$currentHost:8000/health/',
        options: Options(receiveTimeout: timeout),
      );
      if (resp.statusCode == 200) {
        _markOnline(currentHost);
        return;
      }
    } catch (_) {
      // Идём к auto-detect (или к офлайну, если override).
    }

    // 2. При --dart-define=API_HOST не свапаем хост — только статус.
    if (AppConfig.isHostOverridden) {
      _markOffline();
      return;
    }

    // 3. Auto-detect заново через NetworkProbe (c-6c).
    final found = await NetworkProbe.resolve(
      candidates: const ['127.0.0.1', '192.168.0.77', '10.0.2.2'],
      dio: _dio,
    );
    if (found != null) {
      AppConfig.setResolvedHost(found);
      final newBase = 'http://$found:8000/api/v1';
      onBaseUrlChanged?.call(newBase);
      _markOnline(found);
    } else {
      _markOffline();
    }
  }

  void _markOnline(String host) {
    if (!_isOnline || _lastHost != host) {
      _isOnline = true;
      _lastHost = host;
      notifyListeners();
    }
  }

  void _markOffline() {
    if (_isOnline) {
      _isOnline = false;
      _lastHost = null;
      notifyListeners();
    }
  }
}
