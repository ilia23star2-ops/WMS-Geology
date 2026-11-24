/// Базовый HTTP-клиент для API WMS Geology.
library;

import 'package:dio/dio.dart';

import '../config.dart';
import '../utils/api_error_text.dart';

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

  final String message;
  final int? statusCode;
  final Map<String, dynamic>? details;
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
  }) : dio =
           dioOverride ??
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
    headers: {'Accept': 'application/json'},
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

  /// Скачать бинарный файл (PDF, картинку).
  Future<List<int>> download(String path) async {
    try {
      final response = await dio.get<List<int>>(
        path,
        options: Options(responseType: ResponseType.bytes),
      );
      final data = response.data;
      if (data == null) {
        throw ApiException(
          message: 'Пустой ответ от сервера.',
          statusCode: response.statusCode,
        );
      }
      return data;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  /// 6a: multipart POST (загрузка файла + доп. поля).
  Future<Response<T>> uploadMultipart<T>(
    String path, {
    required String imagePath,
    Map<String, dynamic>? fields,
  }) async {
    try {
      final formMap = <String, dynamic>{
        'image': await MultipartFile.fromFile(imagePath),
      };
      if (fields != null) {
        formMap.addAll(fields);
      }
      final formData = FormData.fromMap(formMap);
      return await dio.post<T>(
        path,
        data: formData,
        options: Options(
          contentType: 'multipart/form-data',
          responseType: ResponseType.json,
          headers: {'Accept': 'application/json'},
        ),
      );
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  ApiException _toApiException(DioException e) {
    final response = e.response;
    final statusCode = response?.statusCode;

    Map<String, dynamic>? details;
    bool isNetwork = false;

    if (response?.data is Map<String, dynamic>) {
      details = response!.data as Map<String, dynamic>;
    }
    // sync-errors-14: все причины по-русски, а не первое поле.
    String message = apiErrorText(details, statusCode: statusCode);
    if (details == null &&
        response?.data is String &&
        (response!.data as String).isNotEmpty) {
      message = response.data as String;
    }

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
        break;
      case DioExceptionType.unknown:
        if (statusCode == null) {
          message = 'Не удалось подключиться к серверу';
          isNetwork = true;
        }
        break;
      default:
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
