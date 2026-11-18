/// Сервис OCR (6a, 6e-a3, 6e-2b).
///
/// `recognize()` — отправка фото на сервер (`POST /api/v1/ocr/recognize/`).
/// `sendBatch()` — отправка батча в статус SENT (`PATCH /api/v1/ocr/batches/{id}/`).
library;

import 'dart:convert';

import '../models/ocr_task.dart';
import 'api_client.dart';

class OcrService {
  OcrService(this._client);

  final ApiClient _client;

  /// Отправить фото на распознавание.
  ///
  /// `cellId` — привязать к ячейке (записывается в `OcrTask.cell`).
  /// `batchId` — добавить в существующий батч.
  /// `zones` — разметка зон (6e-2b): список payload'ов `{type, rect, source}`,
  /// уходит как `zones_json` (JSON-строка), backend сам развернёт rect в bbox.
  Future<OcrRecognizeResult> recognize({
    required String imagePath,
    int? cellId,
    int? batchId,
    List<Map<String, dynamic>>? zones,
  }) async {
    final fields = <String, dynamic>{};
    if (cellId != null) fields['cell_id'] = cellId.toString();
    if (batchId != null) fields['batch_id'] = batchId.toString();
    if (zones != null && zones.isNotEmpty) {
      fields['zones_json'] = jsonEncode(zones);
    }

    final response = await _client.uploadMultipart<Map<String, dynamic>>(
      '/ocr/recognize/',
      imagePath: imagePath,
      fields: fields.isEmpty ? null : fields,
    );

    final data = response.data;
    if (data == null) {
      throw ApiException(
        message: 'Пустой ответ от сервера OCR.',
        statusCode: response.statusCode,
      );
    }
    return OcrRecognizeResult.fromJson(data);
  }

  /// Отправить батч в обработку (статус SENT).
  Future<void> sendBatch(int batchId) async {
    await _client.patch<Map<String, dynamic>>(
      '/ocr/batches/$batchId/',
      data: {'status': 'SENT'},
    );
  }
}
