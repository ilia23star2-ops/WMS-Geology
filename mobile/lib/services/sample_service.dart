/// Сервис проб (c-1, c-7f, c-7g, c-7e-1, c-9-fill-offline-2a, -2a-fix, -2b, -2c-1).
library;

import '../db/container_dao.dart';
import '../db/sample_dao.dart';
import '../db/sync_queue_dao.dart';
import '../models/sample.dart';
import '../utils/sample_range_parser.dart';
import 'api_client.dart';

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
typedef UpdateContainerStatus = Future<void> Function(int id, String status);
typedef SetPendingSync = Future<void> Function(int id, bool pending);
typedef GetLocalNegative = Future<List<Map<String, dynamic>>> Function(
  int containerId,
);
typedef UpdateLocalStatus = Future<void> Function(int sampleId, String status);
typedef DeleteLocal = Future<void> Function(int sampleId);
typedef GetQueuePayload = Future<Map<String, dynamic>?> Function(
  String endpoint,
);
typedef UpdateQueuePayload = Future<bool> Function(
  String endpoint,
  Map<String, dynamic> payload,
);

class SampleService {
  SampleService(
    this._client, {
    SaveSamples? saveSamples,
    GetSamplesByContainer? getCached,
    SaveLocalOffline? saveLocalOffline,
    CleanupOffline? cleanupOffline,
    Enqueue? enqueue,
    UpdateContainerNumber? updateContainerNumber,
    UpdateContainerStatus? updateContainerStatus,
    SetPendingSync? setPendingSync,
    GetLocalNegative? getLocalNegative,
    UpdateLocalStatus? updateLocalStatus,
    DeleteLocal? deleteLocal,
    GetQueuePayload? getQueuePayload,
    UpdateQueuePayload? updateQueuePayload,
  }) : _saveSamples = saveSamples ?? SampleDao.saveAll,
       _getCached = getCached ?? SampleDao.getByContainerId,
       _saveLocalOffline = saveLocalOffline ?? _defaultSaveLocal,
       _cleanupOffline = cleanupOffline ?? SampleDao.cleanupAfterPull,
       _enqueue = enqueue ?? _defaultEnqueue,
       _updateContainerNumber =
           updateContainerNumber ?? ContainerDao.updateNumberLocal,
       _updateContainerStatus =
           updateContainerStatus ?? ContainerDao.updateStatusLocal,
       _setPendingSync = setPendingSync ?? ContainerDao.setPendingSync,
       _getLocalNegative =
           getLocalNegative ?? SampleDao.getLocalNegativeByContainer,
       _updateLocalStatus = updateLocalStatus ?? SampleDao.updateLocalStatus,
       _deleteLocal = deleteLocal ?? SampleDao.deleteById,
       _getQueuePayload = getQueuePayload ?? SyncQueueDao.getPayloadByEndpoint,
       _updateQueuePayload =
           updateQueuePayload ?? SyncQueueDao.updatePayloadByEndpoint;

  final ApiClient _client;
  final SaveSamples _saveSamples;
  final GetSamplesByContainer _getCached;
  final SaveLocalOffline _saveLocalOffline;
  final CleanupOffline _cleanupOffline;
  final Enqueue _enqueue;
  final UpdateContainerNumber _updateContainerNumber;
  final UpdateContainerStatus _updateContainerStatus;
  final SetPendingSync _setPendingSync;
  final GetLocalNegative _getLocalNegative;
  final UpdateLocalStatus _updateLocalStatus;
  final DeleteLocal _deleteLocal;
  final GetQueuePayload _getQueuePayload;
  final UpdateQueuePayload _updateQueuePayload;

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
      } catch (_) {}

      try {
        final serverNumbers = rawList
            .map((r) => r['sample_number'] as String?)
            .whereType<String>()
            .toSet();
        await _cleanupOffline(containerId, serverNumbers);
      } catch (_) {}

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

  Future<FillOutcome> fillSamples(
    int containerId, {
    String? containerNumber,
    required String workOrderCoded,
    String workOrderIncoming = '',
    required int researchTypeId,
    int? siteId,
    required List<Map<String, dynamic>> sampleGroups,
    String? researchTypeName,
    String? siteName,
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

      final localSamples = _expandGroups(
        sampleGroups,
        researchTypeName: researchTypeName,
        siteName: siteName,
      );
      await _saveLocalOffline(containerId: containerId, samples: localSamples);

      if (containerNumber != null && containerNumber.trim().isNotEmpty) {
        try {
          await _updateContainerNumber(containerId, containerNumber.trim());
        } catch (_) {}
      }

      try {
        await _updateContainerStatus(containerId, 'PENDING_PLACEMENT');
      } catch (_) {}

      try {
        await _setPendingSync(containerId, true);
      } catch (_) {}

      await _enqueue(
        action: 'POST',
        endpoint: '/storage/containers/$containerId/fill-samples/',
        payload: payload,
      );
      return FillOutcome.queued;
    }
  }

  /// c-9-fill-offline-2c-1: обновить `status` локальной пробы (negative ID)
  /// и пересобрать `sample_groups` в payload очереди.
  Future<void> updateLocalOffline(
    int sampleId, {
    required int containerId,
    required SampleStatus status,
  }) async {
    await _updateLocalStatus(sampleId, sampleStatusToApi(status));
    await _rebuildFillPayload(containerId);
  }

  /// c-9-fill-offline-2c-1: удалить локальную пробу (negative ID) и
  /// пересобрать `sample_groups` в payload очереди.
  Future<void> deleteLocalOffline(
    int sampleId, {
    required int containerId,
  }) async {
    await _deleteLocal(sampleId);
    await _rebuildFillPayload(containerId);
  }

  Future<void> _rebuildFillPayload(int containerId) async {
    final endpoint = '/storage/containers/$containerId/fill-samples/';
    final existing = await _getQueuePayload(endpoint);
    if (existing == null) return;

    final locals = await _getLocalNegative(containerId);
    final newGroups = _buildGroups(locals);
    existing['sample_groups'] = newGroups;
    await _updateQueuePayload(endpoint, existing);
  }

  List<Map<String, dynamic>> _buildGroups(List<Map<String, dynamic>> locals) {
    final groups = <String, List<int>>{};
    final meta = <String, Map<String, dynamic>>{};
    for (final raw in locals) {
      final prefix = raw['_prefix'] as String? ?? '';
      final middle = raw['_middle'] as String? ?? '';
      final digits = raw['_sequence_digits'] as int? ?? 3;
      final seq = raw['_sequence'] as int?;
      final well = raw['_well_name'] as String?;
      if (seq == null) continue;
      final sampleStatus = raw['status'] as String? ?? 'PENDING_PLACEMENT';
      final internal = sampleStatus == 'SELECTED' ? 'SELECTED' : 'NORMAL';
      final key = '$prefix|$middle|$digits|${well ?? ''}|$internal';
      groups.putIfAbsent(key, () => []).add(seq);
      meta[key] = {
        'prefix': prefix,
        'middle': middle,
        'sequence_digits': digits,
        'well_name': well,
        'status': internal,
      };
    }

    final result = <Map<String, dynamic>>[];
    for (final entry in groups.entries) {
      final m = meta[entry.key]!;
      final seqs = entry.value..sort();
      if (seqs.isEmpty) continue;
      var start = seqs.first;
      var prev = seqs.first;
      for (var i = 1; i < seqs.length; i++) {
        final v = seqs[i];
        if (v == prev + 1) {
          prev = v;
        } else {
          result.add({...m, 'sequence_from': start, 'sequence_to': prev});
          start = v;
          prev = v;
        }
      }
      result.add({...m, 'sequence_from': start, 'sequence_to': prev});
    }
    return result;
  }

  List<Map<String, dynamic>> _expandGroups(
    List<Map<String, dynamic>> groups, {
    String? researchTypeName,
    String? siteName,
  }) {
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
        for (var i = parsed.sequenceFrom; i <= parsed.sequenceTo; i++) {
          final seq = i.toString().padLeft(parsed.sequenceDigits, '0');
          result.add({
            'sample_number': '${parsed.prefix}${parsed.middle}$seq',
            'status': sampleStatus,
            'well_name': g['well_name'],
            'research_type_name': researchTypeName ?? '',
            'site_name': siteName ?? '',
            '_prefix': parsed.prefix,
            '_middle': parsed.middle,
            '_sequence': i,
            '_sequence_digits': parsed.sequenceDigits,
            '_well_name': parsed.wellName,
          });
        }
      } catch (_) {}
    }
    return result;
  }

  Future<void> deleteSample(int sampleId) async {
    if (sampleId < 0) {
      await _deleteLocal(sampleId);
      return;
    }
    await _client.delete<dynamic>('/samples/$sampleId/');
  }

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
