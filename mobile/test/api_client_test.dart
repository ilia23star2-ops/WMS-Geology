// Тесты базового API-клиента.
//
// Проверяют:
// - создание Dio с правильными базовыми опциями;
// - вставку JWT-токена в заголовок Authorization;
// - трансформацию ошибок Dio в ApiException;
// - обработку разных форматов ошибок DRF.

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/api_client.dart';

void main() {
  group('ApiClient — базовая конфигурация', () {
    test('создаёт Dio с таймаутами и заголовками', () {
      final client = ApiClient(baseUrl: 'http://test.local/api');
      expect(client.dio.options.baseUrl, 'http://test.local/api');
      expect(client.dio.options.connectTimeout, isNotNull);
      expect(client.dio.options.receiveTimeout, isNotNull);
      expect(client.dio.options.headers['Content-Type'], 'application/json');
      expect(client.dio.options.headers['Accept'], 'application/json');
    });
  });

  group('ApiClient — интерцептор токена', () {
    test('добавляет Authorization, если TokenProvider вернул токен',
        () async {
      String? capturedAuth;
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local'));

      // Важно: тестовый перехватчик добавляется ПОСЛЕ ApiClient,
      // чтобы он выполнялся после интерцептора ApiClient.
      final client = ApiClient(
        dioOverride: dio,
        tokenProvider: () async => 'TEST_TOKEN',
      );

      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            capturedAuth = options.headers['Authorization'] as String?;
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.cancel,
              ),
              true,
            );
          },
        ),
      );

      try {
        await client.get('/whatever');
      } on ApiException {
        // Ожидаемо — отменили запрос.
      }

      expect(capturedAuth, 'Bearer TEST_TOKEN');
    });

    test('не добавляет Authorization, если токен null', () async {
      String? capturedAuth = 'sentinel';
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local'));

      final client = ApiClient(
        dioOverride: dio,
        tokenProvider: () async => null,
      );

      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            capturedAuth = options.headers['Authorization'] as String?;
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.cancel,
              ),
              true,
            );
          },
        ),
      );

      try {
        await client.get('/whatever');
      } on ApiException {
        // ожидаемо
      }

      expect(capturedAuth, isNull);
    });
  });

  group('ApiClient — трансформация ошибок', () {
    test('DioException c detail → ApiException с сообщением', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local'));
      final client = ApiClient(dioOverride: dio);

      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response(
                  requestOptions: options,
                  statusCode: 403,
                  data: {'detail': 'Forbidden'},
                ),
              ),
              true,
            );
          },
        ),
      );

      await expectLater(
        client.get('/x'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'statusCode', 403)
              .having((e) => e.message, 'message', 'Forbidden'),
        ),
      );
    });

    test('DioException c field-ошибкой → ApiException', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local'));
      final client = ApiClient(dioOverride: dio);

      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response(
                  requestOptions: options,
                  statusCode: 400,
                  data: {
                    'sample_number': ['Это поле обязательно.'],
                  },
                ),
              ),
              true,
            );
          },
        ),
      );

      await expectLater(
        client.post('/x'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('sample_number'),
          ),
        ),
      );
    });

    test('DioException c error-полем → ApiException', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local'));
      final client = ApiClient(dioOverride: dio);

      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response(
                  requestOptions: options,
                  statusCode: 400,
                  data: {'error': 'Неверные данные'},
                ),
              ),
              true,
            );
          },
        ),
      );

      await expectLater(
        client.get('/x'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            'Неверные данные',
          ),
        ),
      );
    });

    test('timeout → ApiException с понятным сообщением', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local'));
      final client = ApiClient(dioOverride: dio);

      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionTimeout,
              ),
              true,
            );
          },
        ),
      );

      await expectLater(
        client.get('/x'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('время ожидания'),
          ),
        ),
      );
    });

    test('connectionError → ApiException с понятным сообщением', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test.local'));
      final client = ApiClient(dioOverride: dio);

      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
              ),
              true,
            );
          },
        ),
      );

      await expectLater(
        client.get('/x'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('подключиться'),
          ),
        ),
      );
    });
  });
}