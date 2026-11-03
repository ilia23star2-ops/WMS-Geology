/// Сервис проб (c-1, c-7f, c-7g, c-7e-1, c-9-fill-samples-offline,
/// c-9-fill-samples-offline-2a).
///
/// - `fetchByContainerId` — пробы тары (онлайн → API + кэш + cleanup negatives;
///   офлайн → кэш, включая пустой).
/// - `fillSamples` — заполнить тару (`POST .../fill-samples/`).
///   Офлайн: локальные пробы (negative ID) + `sync_queue` → `FillOutcome.queued`.
///   **2a:** `container_number` при `queued` пишется и в локальный Container.
/// - `deleteSample` — удалить (`DELETE /samples/{id}/`). Для negative ID —
///   локальное удаление, без сети.
/// - `fetchById` / `update` / `dispose` / `restore` — одна проба.
library;

import '../db/container_dao.dart';
import '../db/sample_dao.dart';
import '../db/sync_queue_dao.dart';
import '../models/sample.dart';
import '../utils/sample_range_parser.dart';
import 'api_client.dart';

/// Результат `fillSamples` (c-9-fill-samples-offline).
enum FillOutcome { online, queued }

typedef SaveSamples = Future<void> Function(List<Map<String, dynamic>> raw);
typedef GetSamplesByContainer = Future<List<Map<String, dynamic>>> Function(
  int containerId,
);
typedef SaveLocalOffline = Future<void> Function({
  required int containerId,
  required List<Map<String, dynamic>> samples,
});
typedef CleanupOffline = Future<void> Function(
  int containerId,
  Set<String> serverNumbers,
);
typedef Enqueue = Future<void> Function({
  required String action,
  required String endpoint,
  required Map<String, dynamic> payload,
});
typedef UpdateContainerNumber = Future<void> Function(int id, String number);

class SampleService {
  SampleService(
    this._client, {
    SaveSamples? saveSamples,
    GetSamplesByContainer? getCached,
    SaveLocalOffline? saveLocalOffline,
    CleanupOffline? cleanupOffline,
    Enqueue? enqueue,
    UpdateContainerNumber? updateContainerNumber,
  }) : _saveSamples = saveSamples ?? SampleDao.saveAll,
       _getCached = getCached ?? SampleDao.getByContainerId,
       _saveLocalOffline = saveLocalOffline ?? _defaultSaveLocal,
       _cleanupOffline = cleanupOffline ?? SampleDao.cleanupAfterPull,
       _enqueue = enqueue ?? _defaultEnqueue,
       _updateContainerNumber =
           updateContainerNumber ?? ContainerDao.updateNumberLocal;

  final ApiClient _client;
  final SaveSamples _saveSamples;
  final GetSamplesByContainer _getCached;
  final SaveLocalOffline _saveLocalOffline;
  final CleanupOffline _cleanupOffline;
  final Enqueue _enqueue;
  final UpdateContainerNumber _updateContainerNumber;

  static Future<void> _defaultSaveLocal({
    required int containerId,
    required List<Map<String, dynamic>> samples,
  }) {
    return SampleDao.saveLocalOffline(
      containerId: containerId,
      samples: samples,
    );
  }

  static Future<void> _defaultEnqueue({
    required String action,
    required String endpoint,
    required Map<String, dynamic> payload,
  }) {
    return SyncQueueDao.enqueue(
      action: action,
      endpoint: endpoint,
      payload: payload,
    );
  }

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

      try {
        final serverNumbers = rawList
            .map((r) => r['sample_number'] as String?)
            .whereType<String>()
            .toSet();
        await _cleanupOffline(containerId, serverNumbers);
      } catch (_) {
        // Cleanup не критичен.
      }

      return rawList.map(Sample.fromJson).toList();
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      final cached = await _getCached(containerId);
      return cached.map(Sample.fromJson).toList();
    }
  }

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
  ///
  /// Офлайн: локальные пробы (negative ID) + `sync_queue` → `queued`.
  /// **2a:** если `containerNumber` передан — `ContainerDao.updateNumberLocal`,
  /// чтобы карточка сразу показывала номер, а не «Заготовка».
  Future<FillOutcome> fillSamples(
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

    try {
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
      return FillOutcome.online;
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;

      final localSamples = _expandGroups(sampleGroups);
      await _saveLocalOffline(containerId: containerId, samples: localSamples);

      // c-9-fill-samples-offline-2a: сохранить номер локально.
      if (containerNumber != null && containerNumber.trim().isNotEmpty) {
        try {
          await _updateContainerNumber(containerId, containerNumber.trim());
        } catch (_) {
          // Кэш не критичен.
        }
      }

      await _enqueue(
        action: 'POST',
        endpoint: '/storage/containers/$containerId/fill-samples/',
        payload: payload,
      );
      return FillOutcome.queued;
    }
  }

  /// c-9-fill-samples-offline-2a: `sample_groups` → плоский список проб.
  ///
  /// `status` в группе — `'NORMAL'` / `'SELECTED'` (внутренние имена,
  /// не `Sample.status`). Маппим:
  /// - `'SELECTED'` → `SampleStatus.selected` (`'SELECTED'`);
  /// - иначе → `SampleStatus.pendingPlacement` (`'PENDING_PLACEMENT'`) —
  ///   как сервер для `PENDING_FILLING`-контейнера.
  List<Map<String, dynamic>> _expandGroups(List<Map<String, dynamic>> groups) {
    final result = <Map<String, dynamic>>[];
    for (final g in groups) {
      try {
        final parsed = ParsedSampleRange(
          prefix: g['prefix'] as String,
          middle: g['middle'] as String,
          sequenceFrom: g['sequence_from'] as int,
          sequenceTo: g['sequence_to'] as int,
          sequenceDigits: g['sequence_digits'] as int,
          wellName: g['well_name'] as String?,
        );
        final rawStatus = g['status'] as String? ?? 'NORMAL';
        final sampleStatus = rawStatus == 'SELECTED'
            ? 'SELECTED'
            : 'PENDING_PLACEMENT';
        final numbers = buildSampleNumbers(parsed);
        for (final num in numbers) {
          result.add({
            'sample_number': num,
            'status': sampleStatus,
            'well_name': g['well_name'],
          });
        }
      } catch (_) {
        // Пропускаем битую группу.
      }
    }
    return result;
  }

  /// DELETE /samples/{id}/
  ///
  /// c-9-fill-samples-offline: для negative ID — локальное удаление.
  /// Для серверных — DELETE.
  Future<void> deleteSample(int sampleId) async {
    if (sampleId < 0) {
      await SampleDao.deleteById(sampleId);
      return;
    }
    await _client.delete<dynamic>('/samples/$sampleId/');
  }

  /// PATCH /samples/{id}/
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
