import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/ocr_service.dart';

class _FakeApiClient implements ApiClient {
  _FakeApiClient({this.response, this.failNetwork = false});

  final Map<String, dynamic>? response;
  final bool failNetwork;

  String? lastPath;
  String? lastImagePath;
  Map<String, dynamic>? lastFields;
  Object? lastData;

  @override
  Future<Response<T>> uploadMultipart<T>(
    String path, {
    required String imagePath,
    Map<String, dynamic>? fields,
  }) async {
    lastPath = path;
    lastImagePath = imagePath;
    lastFields = fields;
    if (failNetwork) {
      throw ApiException(
        message: 'Не удалось подключиться',
        isNetworkError: true,
      );
    }
    return Response<T>(
      data: response as T,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
    );
  }

  @override
  Future<Response<T>> patch<T>(String path, {Object? data}) async {
    lastPath = path;
    lastData = data;
    if (failNetwork) {
      throw ApiException(
        message: 'Не удалось подключиться',
        isNetworkError: true,
      );
    }
    return Response<T>(
      data: response as T,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('Not used in test');
}

void main() {
  test('recognize: без cell_id → fields=null', () async {
    final fake = _FakeApiClient(
      response: {
        'status': 'success',
        'task_id': 7,
        'batch_id': 3,
        'data': {'text': 'TST0001', 'words': <dynamic>[]},
        'extracted': {
          'work_order_coded': 'TST0001',
          'work_order_incoming': null,
          'container_number': null,
          'research_type': null,
          'samples': <String>[],
          'wells': <String>[],
          'source': 'zones',
        },
      },
    );
    final service = OcrService(fake);

    final result = await service.recognize(imagePath: '/tmp/x.jpg');

    expect(fake.lastPath, '/ocr/recognize/');
    expect(fake.lastFields, isNull);
    expect(result.taskId, 7);
    expect(result.batchId, 3);
    expect(result.extracted?.workOrderCoded, 'TST0001');
  });

  test('recognize: с cell_id → fields={"cell_id":"15"}', () async {
    final fake = _FakeApiClient(
      response: {
        'status': 'success',
        'task_id': 8,
        'batch_id': 4,
        'data': {'text': '', 'words': <dynamic>[]},
        'extracted': null,
      },
    );
    final service = OcrService(fake);

    await service.recognize(imagePath: '/tmp/x.jpg', cellId: 15);

    expect(fake.lastFields, {'cell_id': '15'});
  });

  test('recognize: с cell_id и batch_id', () async {
    final fake = _FakeApiClient(
      response: {
        'status': 'success',
        'task_id': 9,
        'batch_id': 5,
        'data': null,
      },
    );
    final service = OcrService(fake);

    await service.recognize(imagePath: '/tmp/x.jpg', cellId: 15, batchId: 5);

    expect(fake.lastFields, {'cell_id': '15', 'batch_id': '5'});
  });

  test('recognize: сетевая ошибка → ApiException', () async {
    final fake = _FakeApiClient(failNetwork: true);
    final service = OcrService(fake);

    expect(
      () => service.recognize(imagePath: '/tmp/x.jpg'),
      throwsA(isA<ApiException>()),
    );
  });

  test('sendBatch: PATCH /ocr/batches/3/ со status=SENT', () async {
    final fake = _FakeApiClient(response: {'id': 3, 'status': 'SENT'});
    final service = OcrService(fake);

    await service.sendBatch(3);

    expect(fake.lastPath, '/ocr/batches/3/');
    expect(fake.lastData, {'status': 'SENT'});
  });

  test('sendBatch: сетевая ошибка → ApiException', () async {
    final fake = _FakeApiClient(failNetwork: true);
    final service = OcrService(fake);

    expect(() => service.sendBatch(3), throwsA(isA<ApiException>()));
  });
}
