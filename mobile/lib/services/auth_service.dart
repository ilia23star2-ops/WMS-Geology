/// Сервис аутентификации.
///
/// Фасад над `ApiClient` + `TokenStorage`:
/// - `login` — POST /auth/login/, сохраняет токены, сразу тянет `me`.
/// - `offlineLogin` — POST /auth/offline-login/, обмен offline-токена на JWT.
/// - `logout` — POST /auth/logout/ (blacklist refresh), чистит локально.
/// - `fetchMe` — GET /auth/me/.
/// - `savePendingOfflineToken` / `getPendingOfflineToken` /
///   `clearPendingOfflineToken` — для Deferred Offline Login.
/// - `refreshAccess` — внутренний метод для 401-перехватчика.
library;

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config.dart';
import '../models/offline_token_payload.dart';
import '../models/user.dart';
import 'api_client.dart';
import 'token_storage.dart';

class AuthService {
  AuthService({Dio? dio, TokenStorage? storage})
      : _storage = storage ?? TokenStorage(),
        _plainDio = dio ?? Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl)) {
    _client = ApiClient(
      dioOverride: _plainDio,
      tokenProvider: _storage.getAccess,
      tokenRefresher: refreshAccess,
    );
  }

  final TokenStorage _storage;
  final Dio _plainDio;
  late final ApiClient _client;
  final _secureStorage = const FlutterSecureStorage();

  static const _pendingTokenKey = 'pending_offline_token';
  static const _pendingExpiryKey = 'pending_offline_expiry';
  static const _pendingUserKey = 'pending_offline_user_json';

  ApiClient get apiClient => _client;

  /// Логин по паролю. При успехе сохраняет токены и возвращает пользователя.
  Future<User> login(String username, String password) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/auth/login/',
      data: {'username': username, 'password': password},
    );

    final data = response.data;
    if (data == null) {
      throw ApiException(message: 'Пустой ответ сервера при логине.');
    }
    final access = data['access'] as String?;
    final refresh = data['refresh'] as String?;
    if (access == null || refresh == null) {
      throw ApiException(message: 'Сервер не вернул токены.');
    }

    await _storage.set(access, refresh);
    return fetchMe();
  }

  /// Офлайн-логин: обмен offline-токена на JWT.
  Future<User> offlineLogin(String rawToken, String deviceId) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/auth/offline-login/',
      data: {'token': rawToken, 'device_id': deviceId},
    );

    final data = response.data;
    if (data == null) {
      throw ApiException(
        message: 'Пустой ответ сервера при офлайн-входе.',
      );
    }
    final access = data['access'] as String?;
    final refresh = data['refresh'] as String?;
    if (access == null || refresh == null) {
      throw ApiException(message: 'Сервер не вернул токены.');
    }

    await _storage.set(access, refresh);
    return fetchMe();
  }

  /// Сохранить offline-token для отложенного офлайн-входа.
  Future<void> savePendingOfflineToken(OfflineTokenPayload payload) async {
    await _secureStorage.write(
      key: _pendingTokenKey,
      value: payload.token,
    );
    await _secureStorage.write(
      key: _pendingExpiryKey,
      value: payload.expiresAt.toIso8601String(),
    );
    if (payload.user != null) {
      await _secureStorage.write(
        key: _pendingUserKey,
        value: jsonEncode(payload.user!.toJson()),
      );
    } else {
      await _secureStorage.delete(key: _pendingUserKey);
    }
  }

  /// Прочитать сохранённый offline-token (для восстановления при старте).
  Future<OfflineTokenPayload?> getPendingOfflineToken() async {
    final token = await _secureStorage.read(key: _pendingTokenKey);
    final expiryStr = await _secureStorage.read(key: _pendingExpiryKey);
    if (token == null || expiryStr == null) return null;
    final expiresAt = DateTime.tryParse(expiryStr);
    if (expiresAt == null) return null;

    OfflineUserInfo? userInfo;
    final userRaw = await _secureStorage.read(key: _pendingUserKey);
    if (userRaw != null) {
      try {
        userInfo = OfflineUserInfo.fromJson(
          jsonDecode(userRaw) as Map<String, dynamic>,
        );
      } catch (_) {
        userInfo = null;
      }
    }

    return OfflineTokenPayload(
      token: token,
      purpose: 'offline',
      expiresAt: expiresAt,
      user: userInfo,
    );
  }

  Future<void> clearPendingOfflineToken() async {
    await _secureStorage.delete(key: _pendingTokenKey);
    await _secureStorage.delete(key: _pendingExpiryKey);
    await _secureStorage.delete(key: _pendingUserKey);
  }

  /// Логаут: пытается blacklist-refresh на backend, чистит локально.
  Future<void> logout() async {
    final refresh = await _storage.getRefresh();
    if (refresh != null && refresh.isNotEmpty) {
      try {
        await _client.post('/auth/logout/', data: {'refresh': refresh});
      } on ApiException {
        // Игнор — токены всё равно чистим.
      }
    }
    await _storage.clear();
    await clearPendingOfflineToken();
  }

  /// Текущий пользователь: GET /auth/me/.
  Future<User> fetchMe() async {
    final response = await _client.get<Map<String, dynamic>>('/auth/me/');
    final data = response.data;
    if (data == null) {
      throw ApiException(message: 'Пустой ответ /auth/me/.');
    }
    return User.fromJson(data);
  }

  /// Есть ли сохранённый access-токен.
  Future<bool> hasToken() async {
    final access = await _storage.getAccess();
    return access != null && access.isNotEmpty;
  }

  /// Обновление access-токена. Вызывается 401-перехватчиком.
  Future<String?> refreshAccess() async {
    final refresh = await _storage.getRefresh();
    if (refresh == null || refresh.isEmpty) return null;

    try {
      final response = await _plainDio.post<Map<String, dynamic>>(
        '/auth/refresh/',
        data: {'refresh': refresh},
      );
      final newAccess = response.data?['access'] as String?;
      if (newAccess == null || newAccess.isEmpty) return null;
      await _storage.setAccess(newAccess);
      return newAccess;
    } catch (_) {
      await _storage.clear();
      return null;
    }
  }
}