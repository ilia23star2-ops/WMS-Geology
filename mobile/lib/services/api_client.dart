/// Базовый HTTP-клиент для API WMS Geology.
///
/// Оборачивает `Dio`:
/// - устанавливает базовый URL и таймауты;
/// - добавляет JWT access-токен в заголовок `Authorization`;
/// - трансформирует ошибки сервера в `ApiException`.
///
/// Хранение токена — через `TokenStorage` (см. `auth_service.dart`).
///
/// ВАЖНО: `post` и `patch` явно ставят `Content-Type: application/json`.
/// Без этого Dio отправляет `Map` как `form-urlencoded`, и DRF
/// отвечает HTML (Browsable API), а не JSON.
library;

import 'package:dio/dio.dart';

import '../config.dart';

/// Провайдер access-токена. Возвращает текущий токен или null.
typedef TokenProvider = Future<String?> Function();

/// Провайдер refresh-токена. Возвращает новый access-токен или null.
typedef TokenRefresher = Future<String?> Function();

/// Исключение API с типизированной информацией об ошибке.
class ApiException implements Exception {
  ApiException({
    required this.message,
    this.statusCode,
    this.details,
  });

  /// Человекочитаемое сообщение.
  final String message;

  /// HTTP-код ответа (null для сетевых ошибок).
  final int? statusCode;

  /// Дополнительные данные (например, ошибки валидации DRF).
  final Map<String, dynamic>? details;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Базовый API-клиент.
class ApiClient {
  ApiClient({
    String? baseUrl,
    this.tokenProvider,
    this.tokenRefresher,
    Dio? dioOverride,
  }) : dio = dioOverride ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
                connectTimeout: AppConfig.connectTimeout,
                receiveTimeout: AppConfig.receiveTimeout,
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
              ),
            ) {
    _setupInterceptors();
  }

  final Dio dio;
  final TokenProvider? tokenProvider;
  final TokenRefresher? tokenRefresher;

  /// Общие опции запроса — гарантируют JSON и на вход, и на выход.
  static final Options _jsonOptions = Options(
    contentType: Headers.jsonContentType,
    responseType: ResponseType.json,
    headers: {
      'Accept': 'application/json',
    },
  );

  void _setupInterceptors() {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final provider = tokenProvider;
          if (provider != null) {
            final token = await provider();
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          // Попытка refresh при 401.
          final refresher = tokenRefresher;
          if (error.response?.statusCode == 401 && refresher != null) {
            final newToken = await refresher();
            if (newToken != null && newToken.isNotEmpty) {
              final opts = error.requestOptions;
              opts.headers['Authorization'] = 'Bearer $newToken';
              try {
                final response = await dio.fetch(opts);
                return handler.resolve(response);
              } catch (e) {
                return handler.next(error);
              }
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  // --- Обёртки над Dio с приведением ошибок ---

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      return await dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: _jsonOptions,
      );
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Response<T>> post<T>(
    String path, {
    Object? data,
  }) async {
    try {
      return await dio.post<T>(
        path,
        data: data,
        options: _jsonOptions,
      );
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Response<T>> patch<T>(
    String path, {
    Object? data,
  }) async {
    try {
      return await dio.patch<T>(
        path,
        data: data,
        options: _jsonOptions,
      );
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Response<T>> delete<T>(String path) async {
    try {
      return await dio.delete<T>(path, options: _jsonOptions);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  /// Преобразует ошибку Dio в ApiException.
  ApiException _toApiException(DioException e) {
    final response = e.response;
    final statusCode = response?.statusCode;

    String message = 'Ошибка сети';
    Map<String, dynamic>? details;

    if (response?.data is Map<String, dynamic>) {
      final data = response!.data as Map<String, dynamic>;
      details = data;
      if (data['detail'] is String) {
        message = data['detail'] as String;
      } else if (data['error'] is String) {
        message = data['error'] as String;
      } else {
        for (final entry in data.entries) {
          if (entry.value is List && (entry.value as List).isNotEmpty) {
            message = '${entry.key}: ${(entry.value as List).first}';
            break;
          } else if (entry.value is String) {
            message = '${entry.key}: ${entry.value}';
            break;
          }
        }
      }
    } else if (response?.data is String &&
        (response!.data as String).isNotEmpty) {
      message = response.data as String;
    } else if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      message = 'Превышено время ожидания ответа сервера';
    } else if (e.type == DioExceptionType.connectionError) {
      message = 'Не удалось подключиться к серверу';
    }

    return ApiException(
      message: message,
      statusCode: statusCode,
      details: details,
    );
  }
}