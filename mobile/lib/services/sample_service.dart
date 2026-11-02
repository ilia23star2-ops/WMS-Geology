/// Сервис проб (c-1, c-7f, c-7g, c-7e-1).
///
/// - `fetchByContainerId` — список проб в таре (с офлайн-кэшем).
/// - `fillSamples` — заполнить тару пробами (`POST .../fill-samples/`).
/// - `deleteSample` — удалить пробу (`DELETE /samples/{id}/`).
/// - `fetchById` / `update` / `dispose` / `restore` — одна проба.
///
/// c-7e-1: `fetchByContainerId` при `ApiException.isNetworkError == true`
/// возвращает кэш **всегда** — включая пустой список. Пустая тара офлайн —
/// нормальный случай, не ошибка. Валидационные ошибки (не network) —
/// пробрасываются.
library;

import '../db/sample_dao.dart';
import '../models/sample.dart';
import 'api_client.dart';

/// DI-хук для тестов. По умолчанию — `SampleDao.saveAll`.
typedef SaveSamples = Future<void> Function(List<Map<String, dynamic>> raw);
typedef GetSamplesByContainer = Future<List<Map<String, dynamic>>> Function(
  int containerId,
);

class SampleService {
  SampleService(
    this._client, {
    SaveSamples? saveSamples,
    GetSamplesByContainer? getCached,
  }) : _saveSamples = saveSamples ?? SampleDao.saveAll,
       _getCached = getCached ?? SampleDao.getByContainerId;

  final ApiClient _client;
  final SaveSamples _saveSamples;
  final GetSamplesByContainer _getCached;

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
        await _saveSamples(rawList);
      } catch (_) {
        // Кэш не критичен.
      }

      return rawList.map(Sample.fromJson).toList();
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      // c-7e-1: офлайн — возвращаем кэш, включая пустой.
      final cached = await _getCached(containerId);
      return cached.map(Sample.fromJson).toList();
    }
  }

  /// GET /samples/{id}/
  Future<Sample> fetchById(int id) async {
    final response = await _client.get<Map<String, dynamic>>('/samples/$id/');
    final data = response.data;
    if (data == null) {
      throw ApiException(
        message: 'Пустой ответ /samples/$id/.',
        statusCode: response.statusCode,
      );
    }
    return Sample.fromJson(data);
  }

  /// POST /storage/containers/{id}/fill-samples/
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
  Future<void> deleteSample(int sampleId) async {
    await _client.delete<dynamic>('/samples/$sampleId/');
  }

  /// PATCH /samples/{id}/
  ///
  /// payload — `{sample_number, research_type, site, status}`.
  Future<Sample> update(int id, Map<String, dynamic> payload) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '/samples/$id/',
      data: payload,
    );
    final data = response.data;
    if (data == null) {
      throw ApiException(
        message: 'Пустой ответ при обновлении пробы #$id.',
        statusCode: response.statusCode,
      );
    }
    return Sample.fromJson(data);
  }

  /// POST /samples/{id}/dispose/
  Future<Sample> dispose(int id, {String reason = ''}) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/samples/$id/dispose/',
      data: {'disposal_reason': reason},
    );
    final data = response.data;
    if (data == null) {
      throw ApiException(
        message: 'Пустой ответ при утилизации пробы #$id.',
        statusCode: response.statusCode,
      );
    }
    return Sample.fromJson(data);
  }

  /// POST /samples/{id}/restore/
  Future<Sample> restore(int id) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/samples/$id/restore/',
      data: const {},
    );
    final data = response.data;
    if (data == null) {
      throw ApiException(
        message: 'Пустой ответ при возврате пробы #$id.',
        statusCode: response.statusCode,
      );
    }
    return Sample.fromJson(data);
  }
}
