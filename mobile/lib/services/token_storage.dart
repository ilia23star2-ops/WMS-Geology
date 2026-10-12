/// Хранилище JWT-токенов.
///
/// Оборачивает `FlutterSecureStorage` (Android Keystore).
/// Ключи — из `AppConfig`.
library;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config.dart';

class TokenStorage {
  TokenStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  Future<String?> getAccess() =>
      _storage.read(key: AppConfig.tokenAccessKey);

  Future<String?> getRefresh() =>
      _storage.read(key: AppConfig.tokenRefreshKey);

  Future<void> set(String access, String refresh) async {
    await _storage.write(key: AppConfig.tokenAccessKey, value: access);
    await _storage.write(key: AppConfig.tokenRefreshKey, value: refresh);
  }

  Future<void> setAccess(String access) =>
      _storage.write(key: AppConfig.tokenAccessKey, value: access);

  Future<void> clear() async {
    await _storage.delete(key: AppConfig.tokenAccessKey);
    await _storage.delete(key: AppConfig.tokenRefreshKey);
  }
}