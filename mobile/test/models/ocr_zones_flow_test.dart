import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:wms_geology_mobile/models/ocr_session.dart';
import 'package:wms_geology_mobile/models/ocr_zone.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/ocr_service.dart';

class _FakeApiClient implements ApiClient {
  Map<String, dynamic>? lastFields;

  @override
  Future<Response<T>> uploadMultipart<T>(
    String path, {
    required String imagePath,
    Map<String, dynamic>? fields,
  }) async {
    lastFields = fields;
    return Response<T>(
      data: {'task_id': 1, 'batch_id': 2} as T,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('Not used in test');
}

void main() {
  test('recognize: zones → zones_json JSON-строкой', () async {
    final fake = _FakeApiClient();
    final service = OcrService(fake);
    final payload = const OcrZoneMark(
      type: OcrZoneTypes.sample,
      x: 1,
      y: 2,
      w: 3,
      h: 4,
    ).toPayload();

    await service.recognize(imagePath: '/tmp/x.jpg', zones: [payload]);

    expect(fake.lastFields!['zones_json'], jsonEncode([payload]));
  });

  test('recognize: пустые zones → zones_json не отправляется', () async {
    final fake = _FakeApiClient();
    final service = OcrService(fake);

    await service.recognize(imagePath: '/tmp/x.jpg', zones: []);

    expect(fake.lastFields, isNull);
  });

  test('CellPhotos: setZones / zonesFor', () {
    final cell = CellPhotos(cellId: 1, fullAddress: 'A');
    const z = OcrZoneMark(type: OcrZoneTypes.well, x: 0, y: 0, w: 10, h: 10);

    cell.setZones('/tmp/a.jpg', [z]);

    expect(cell.zonesFor('/tmp/a.jpg'), [z]);
    expect(cell.zonesFor('/tmp/other.jpg'), isEmpty);
  });

  test('CellPhotos: removePhoto чистит зоны удалённого фото', () {
    final cell = CellPhotos(cellId: 1, fullAddress: 'A');
    cell.addPhoto(XFile('/tmp/a.jpg'));
    cell.setZones('/tmp/a.jpg', [
      const OcrZoneMark(type: OcrZoneTypes.sample, x: 0, y: 0, w: 5, h: 5),
    ]);

    cell.removePhoto(0);

    expect(cell.zonesFor('/tmp/a.jpg'), isEmpty);
  });

  test('CellPhotos: setZones уведомляет сессию', () {
    final session = OcrSession();
    session.addCell(1, 'A');
    var notified = 0;
    session.addListener(() => notified++);

    session.getCell(1)!.setZones('/tmp/a.jpg', [
      const OcrZoneMark(type: OcrZoneTypes.sample, x: 0, y: 0, w: 5, h: 5),
    ]);

    expect(notified, 1);
  });
}
