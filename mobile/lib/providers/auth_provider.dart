/// ChangeNotifier-провайдер аутентификации.
///
/// Обёртка над `AuthService` для UI (provider).
/// - `isInitializing` — первичная проверка токена при старте.
/// - `isLoading` — идёт запрос login/logout.
/// - `error` — сообщение об ошибке логина.
///
/// `service` — публичный геттер: нужен в `main.dart` для получения
/// `ApiClient`, чтобы создать `ContainerService`.
library;

import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider({AuthService? service}) : _service = service ?? AuthService();

  final AuthService _service;

  User? _user;
  bool _isInitializing = true;
  bool _isLoading = false;
  String? _error;

  User? get user => _user;
  bool get isInitializing => _isInitializing;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;
  String? get error => _error;

  /// Публичный доступ к `AuthService` — для получения `ApiClient`.
  AuthService get service => _service;

  /// Первичная загрузка: если есть токен — тянем пользователя.
  Future<void> initialize() async {
    _isInitializing = true;
    notifyListeners();
    try {
      final has = await _service.hasToken();
      if (has) {
        _user = await _service.fetchMe();
      }
    } catch (_) {
      _user = null;
    }
    _isInitializing = false;
    notifyListeners();
  }

  /// Логин. Возвращает `true` при успехе.
  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _user = await _service.login(username, password);
      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Ошибка входа: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Логаут: чистит сессию на backend и локально.
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();
    await _service.logout();
    _user = null;
    _isLoading = false;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}