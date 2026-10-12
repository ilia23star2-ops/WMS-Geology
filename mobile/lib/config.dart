/// Конфигурация приложения WMS Geology Mobile.
///
/// URL API зависит от того, где запускается приложение:
/// - Android-эмулятор: localhost хост-машины доступен как `10.0.2.2`.
/// - Реальное устройство (USB-отладка): нужно указать IP хост-машины
///   в локальной сети (например, `192.168.0.77`).
/// - Windows/Chrome (для быстрого теста): `localhost`.
///
/// Для реального устройства обязательно поменяй `_apiHostOverride`
/// на IP твоей машины в локальной сети.
class AppConfig {
  AppConfig._();

  // --- URL API ---
  // Если поле НЕ пустое — используется вместо автоматического
  // определения. Установи сюда IP хост-машины при работе на реальном
  // устройстве. Пример: '192.168.1.100'.
  //
  // Тип `String?` оставлен намеренно: на эмуляторе значение может
  // быть null (тогда берётся 10.0.2.2).
  // ignore: unnecessary_nullable_for_final_variable_declarations
  static const String? _apiHostOverride = '192.168.0.77';

  /// Базовый URL API v1.
  static String get apiBaseUrl {
    final override = _apiHostOverride;
    if (override != null && override.isNotEmpty) {
      return 'http://$override:8000/api/v1';
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