/// Сервис аутентификации.
///
/// Фасад над `ApiClient` + `TokenStorage`:
/// - `login` — POST /auth/login/, сохраняет токены, сразу тянет `me`.
/// - `logout` — POST /auth/logout/ (blacklist refresh), чистит локально.
/// - `fetchMe` — GET /auth/me/.
/// - `refreshAccess` — внутренний метод для 401-перехватчика.
///
/// `ApiClient` получает `tokenProvider` (читает access из хранилища)
/// и `tokenRefresher` (наш refreshAccess), поэтому 401 автоматом
/// обновляет токен и повторяет запрос.
///
/// `apiClient` — публичный геттер: другие сервисы (ContainerService
/// и пр.) используют тот же клиент с JWT и авто-refresh.
library;

import 'package:dio/dio.dart';

import '../config.dart';
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

  /// Публичный доступ к `ApiClient` — используется другими
  /// сервисами (ContainerService и пр.), чтобы использовать тот же
  /// клиент с JWT и авто-refresh.
  ApiClient get apiClient => _client;

  /// Логин. При успехе сохраняет токены и возвращает пользователя.
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
  ///
  /// Использует отдельный Dio **без** интерцепторов — чтобы не
  /// зациклиться, если refresh сам вернёт 401.
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