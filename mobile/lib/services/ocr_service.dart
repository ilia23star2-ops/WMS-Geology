/// Сервис OCR (6a).
///
/// `recognize()` — отправка фото на сервер (`POST /api/v1/ocr/recognize/`).
library;

import '../models/ocr_task.dart';
import 'api_client.dart';

class OcrService {
  OcrService(this._client);

  final ApiClient _client;

  /// Отправить фото на распознавание.
  ///
  /// `cellId` — привязать к ячейке (записывается в `OcrBatch.cell`).
  /// `batchId` — добавить в существующий батч.
  /// `zones` — пока не используется в 6a, задел на 6c.
  Future<OcrRecognizeResult> recognize({
    required String imagePath,
    int? cellId,
    int? batchId,
  }) async {
    final fields = <String, dynamic>{};
    if (cellId != null) fields['cell_id'] = cellId.toString();
    if (batchId != null) fields['batch_id'] = batchId.toString();

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
}
