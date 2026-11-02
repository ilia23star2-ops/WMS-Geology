/// Сервис проб (c-1, c-7f).
///
/// - `fetchByContainerId` — список проб в таре (с офлайн-кэшем).
/// - `fillSamples` — заполнить тару пробами (`POST .../fill-samples/`).
/// - `deleteSample` — удалить пробу (`DELETE /samples/{id}/`).
library;

import '../db/sample_dao.dart';
import '../models/sample.dart';
import 'api_client.dart';

class SampleService {
  SampleService(this._client);

  final ApiClient _client;

  /// GET /samples/?container_id={id}
  ///
  /// 1. Пытается загрузить с сервера.
  /// 2. При успехе кэширует ответ в SQLite.
  /// 3. При ошибке сети — отдаёт данные из SQLite.
  Future<List<Sample>> fetchByContainerId(int containerId) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/samples/',
        queryParameters: {'container_id': containerId},
      );
      final data = response.data;
      if (data == null) {
        throw ApiException(
          message: 'Пустой ответ от сервера для проб тары #$containerId.',
          statusCode: response.statusCode,
        );
      }
      final results = data['results'];
      if (results is! List) return const [];
      final rawList = results.cast<Map<String, dynamic>>();

      try {
        await SampleDao.saveAll(rawList);
      } catch (_) {
        // Кэш не критичен.
      }

      return rawList.map(Sample.fromJson).toList();
    } catch (e) {
      final cached = await SampleDao.getByContainerId(containerId);
      if (cached.isNotEmpty) {
        return cached.map(Sample.fromJson).toList();
      }
      rethrow;
    }
  }

  /// POST /storage/containers/{id}/fill-samples/
  ///
  /// Создать пробы по диапазонам. Возвращает количество созданных.
  /// Только онлайн.
  Future<int> fillSamples(
    int containerId, {
    String? containerNumber,
    required String workOrderCoded,
    String workOrderIncoming = '',
    required int researchTypeId,
    int? siteId,
    required List<Map<String, dynamic>> sampleGroups,
  }) async {
    final payload = <String, dynamic>{
      if (containerNumber != null) 'container_number': containerNumber,
      'work_order_coded': workOrderCoded,
      'work_order_incoming': workOrderIncoming,
      'research_type_id': researchTypeId,
      if (siteId != null) 'site_id': siteId,
      'sample_groups': sampleGroups,
    };

    final response = await _client.post<Map<String, dynamic>>(
      '/storage/containers/$containerId/fill-samples/',
      data: payload,
    );
    final data = response.data;
    if (data == null) {
      throw ApiException(
        message: 'Пустой ответ при заполнении тары #$containerId.',
        statusCode: response.statusCode,
      );
    }
    return (data['total_samples'] as int?) ?? 0;
  }

  /// DELETE /samples/{id}/
  ///
  /// Hard-delete пробы. `ProtectedError` (проба в отгрузке) → 409.
  /// Только онлайн.
  Future<void> deleteSample(int sampleId) async {
    await _client.delete<dynamic>('/samples/$sampleId/');
  }
}
