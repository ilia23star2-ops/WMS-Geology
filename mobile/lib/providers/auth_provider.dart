/// ChangeNotifier-провайдер аутентификации.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/offline_token_payload.dart';
import '../models/user.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/device_id_service.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider({AuthService? service}) : _service = service ?? AuthService();

  final AuthService _service;
  final _storage = const FlutterSecureStorage();
  static const _userCacheKey = 'cached_user_json';

  User? _user;
  bool _isInitializing = true;
  bool _isLoading = false;
  bool _isOffline = false;
  bool _isPendingOffline = false;
  String? _error;

  User? get user => _user;
  bool get isInitializing => _isInitializing;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;
  bool get isOffline => _isOffline;
  bool get isPendingOffline => _isPendingOffline;
  String? get error => _error;

  AuthService get service => _service;

  Future<void> initialize() async {
    _isInitializing = true;
    notifyListeners();
    try {
      final hasToken = await _service.hasToken();
      if (hasToken) {
        try {
          _user = await _service.fetchMe();
          await _cacheUser(_user!);
          _isOffline = false;
          _isPendingOffline = false;
        } catch (e) {
          if (_isNetworkError(e)) {
            final cached = await _readCachedUser();
            if (cached != null) {
              _user = cached;
              _isOffline = true;
            } else {
              rethrow;
            }
          } else {
            rethrow;
          }
        }
      } else {
        // Нет JWT. Проверяем, есть ли pending offline token.
        final pending = await _service.getPendingOfflineToken();
        if (pending != null && pending.expiresAt.isAfter(DateTime.now())) {
          await _tryExchangePendingToken(pending);
        }
      }
    } catch (_) {
      _user = null;
    }
    _isInitializing = false;
    notifyListeners();
  }

  Future<void> _tryExchangePendingToken(OfflineTokenPayload pending) async {
    try {
      final deviceId = await DeviceIdService.getDeviceId();
      _user = await _service.offlineLogin(pending.token, deviceId);
      await _cacheUser(_user!);
      await _service.clearPendingOfflineToken();
      _isPendingOffline = false;
      _isOffline = false;
    } catch (e) {
      if (_isNetworkError(e)) {
        _isPendingOffline = true;
        _user = _userFromPayloadOrCache(pending);
      } else {
        await _service.clearPendingOfflineToken();
        _user = null;
      }
    }
  }

  Future<void> loginWithQr(OfflineTokenPayload payload) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    final deviceId = await DeviceIdService.getDeviceId();

    try {
      _user = await _service.offlineLogin(payload.token, deviceId);
      await _cacheUser(_user!);
      _isPendingOffline = false;
      _isOffline = false;
    } catch (e) {
      if (_isNetworkError(e)) {
        // Нет сети — сохраняем токен, включаем отложенный режим.
        await _service.savePendingOfflineToken(payload);
        _isPendingOffline = true;
        _user = _userFromPayloadOrCache(payload);
      } else {
        _error = 'Ошибка офлайн-входа: ${_extractMessage(e)}';
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _user = await _service.login(username, password);
      await _cacheUser(_user!);
      _isOffline = false;
      _isPendingOffline = false;
      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Ошибка входа: ${_extractMessage(e)}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();
    await _service.logout();
    await _storage.delete(key: _userCacheKey);
    _user = null;
    _isOffline = false;
    _isPendingOffline = false;
    _isLoading = false;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// Пользователь для pending-offline режима.
  ///
  /// Приоритет: данные из QR (payload.user) → кэш → техническая заглушка.
  /// Роль из QR — настоящая (admin / manager / worker), не «guest».
  User _userFromPayloadOrCache(OfflineTokenPayload payload) {
    final fromQr = payload.user;
    if (fromQr != null) {
      return User(
        id: fromQr.id,
        username: fromQr.username,
        email: '',
        fullName: fromQr.fullName.isNotEmpty
            ? fromQr.fullName
            : fromQr.username,
        role: fromQr.role,
      );
    }
    // Заглушка, если QR старого формата (без user).
    return User(
      id: 0,
      username: 'offline',
      email: '',
      fullName: 'Офлайн-пользователь',
      role: null,
    );
  }

  Future<void> _cacheUser(User user) async {
    await _storage.write(
      key: _userCacheKey,
      value: jsonEncode(user.toJson()),
    );
  }

  Future<User?> _readCachedUser() async {
    final raw = await _storage.read(key: _userCacheKey);
    if (raw == null) return null;
    try {
      return User.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  /// Является ли ошибка сетевой (нет связи с сервером).
  ///
  /// Сначала смотрим флаг `isNetworkError` из `ApiException`
  /// (выставляется в `_toApiException` по `DioExceptionType`).
  /// Fallback — statusCode == null, что тоже означает «сервер не ответил».
  bool _isNetworkError(Object e) {
    if (e is ApiException) {
      if (e.isNetworkError) return true;
      if (e.statusCode == null) return true;
    }
    final str = e.toString().toLowerCase();
    return str.contains('connection') ||
        str.contains('socketexception') ||
        str.contains('failed host lookup') ||
        str.contains('network is unreachable') ||
        str.contains('timeout') ||
        str.contains('не удалось подключиться');
  }

  /// Человекочитаемое сообщение из ошибки.
  String _extractMessage(Object e) {
    if (e is ApiException) {
      if (e.statusCode != null) {
        return '${e.message} (HTTP ${e.statusCode})';
      }
      return e.message;
    }
    return e.toString();
  }
}