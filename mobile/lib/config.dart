/// Конфигурация приложения WMS Geology Mobile.
///
/// URL API зависит от того, где запускается приложение:
/// - Android-эмулятор: localhost хост-машины доступен как `10.0.2.2`.
/// - Реальное устройство (USB): через `adb reverse` → `127.0.0.1`.
/// - Реальное устройство (Wi-Fi): IP хост-машины (например, `192.168.0.77`).
///
/// Значение задаётся через `--dart-define=API_HOST=...` при запуске.
/// Дефолт — домашний IP (`192.168.0.77`), чтобы дома работало «из коробки».
/// На работе `start_dev.bat` передаёт `--dart-define=API_HOST=127.0.0.1`.
///
/// Пример:
///   flutter run --dart-define=API_HOST=127.0.0.1
///   flutter run --dart-define=API_HOST=192.168.0.77
class AppConfig {
  AppConfig._();

  // --- URL API ---
  // Значение по умолчанию — домашний IP. Переопределяется через --dart-define.
  static const String _apiHostOverride = String.fromEnvironment(
    'API_HOST',
    defaultValue: '192.168.0.77',
  );

  /// Базовый URL API v1.
  static String get apiBaseUrl {
    if (_apiHostOverride.isNotEmpty) {
      return 'http://$_apiHostOverride:8000/api/v1';
    }
    return 'http://10.0.2.2:8000/api/v1';
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
