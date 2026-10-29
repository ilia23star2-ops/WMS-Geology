/// Базовый HTTP-клиент для API WMS Geology.
library;

import 'package:dio/dio.dart';

import '../config.dart';

typedef TokenProvider = Future<String?> Function();
typedef TokenRefresher = Future<String?> Function();

/// Исключение API с типизированной информацией об ошибке.
class ApiException implements Exception {
  ApiException({
    required this.message,
    this.statusCode,
    this.details,
    this.isNetworkError = false,
  });

  /// Человекочитаемое сообщение.
  final String message;

  /// HTTP-код ответа (null для сетевых ошибок).
  final int? statusCode;

  /// Дополнительные данные (например, ошибки валидации DRF).
  final Map<String, dynamic>? details;

  /// Является ли ошибка сетевой (Dio: connectionError / timeout).
  final bool isNetworkError;

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
          final refresher = tokenRefresher;
          if (error.response?.statusCode == 401 && refresher != null) {
            final newToken = await refresher();
            if (newToken != null && newToken.isNotEmpty) {
              final opts = error.requestOptions;
              opts.headers['Authorization'] = 'Bearer $newToken';
              try {
                final response = await dio.fetch(opts);
                return handler.resolve(response);
              } catch (_) {
                return handler.next(error);
              }
            }
          }
          handler.next(error);
        },
      ),
    );
  }

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

  Future<Response<T>> post<T>(String path, {Object? data}) async {
    try {
      return await dio.post<T>(path, data: data, options: _jsonOptions);
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Response<T>> patch<T>(String path, {Object? data}) async {
    try {
      return await dio.patch<T>(path, data: data, options: _jsonOptions);
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
    bool isNetwork = false;

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
    }

    // Классифицируем по DioExceptionType. Dio добавляет новые типы
    // (например, transformTimeout), поэтому default обязателен.
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        message = 'Превышено время ожидания ответа сервера';
        isNetwork = true;
        break;
      case DioExceptionType.connectionError:
        message = 'Не удалось подключиться к серверу';
        isNetwork = true;
        break;
      case DioExceptionType.badCertificate:
        message = 'Ошибка сертификата сервера';
        isNetwork = true;
        break;
      case DioExceptionType.cancel:
        message = 'Запрос отменён';
        break;
      case DioExceptionType.badResponse:
        // Сервер ответил — это не сетевая ошибка.
        break;
      case DioExceptionType.unknown:
        // В Dio 5.x 'unknown' обычно = SocketException (нет сети) или DNS-ошибка.
        if (statusCode == null) {
          message = 'Не удалось подключиться к серверу';
          isNetwork = true;
        }
        break;
      default:
        // Будущие типы Dio (transformTimeout и т.п.): считаем сетевыми,
        // если сервер не ответил.
        if (statusCode == null) {
          isNetwork = true;
        }
        break;
    }

    return ApiException(
      message: message,
      statusCode: statusCode,
      details: details,
      isNetworkError: isNetwork,
    );
  }
}