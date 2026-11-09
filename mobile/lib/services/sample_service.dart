/// Сервис проб (c-1, c-7f, c-7g, c-7e-1, c-9-fill-offline-2a..2c-4, c-9-natural-sort, c-2d-2c).
library;

import '../db/container_dao.dart';
import '../db/sample_dao.dart';
import '../db/sync_queue_dao.dart';
import '../models/sample.dart';
import '../utils/natural_sort.dart';
import '../utils/sample_range_parser.dart';
import 'api_client.dart';

enum FillOutcome { online, queued }

enum OnlineOutcome { online, queued }

typedef SaveSamples = Future<void> Function(List<Map<String, dynamic>> raw);
typedef GetSamplesByContainer = Future<List<Map<String, dynamic>>> Function(
  int containerId,
);
typedef HasPendingForContainer = Future<bool> Function(int containerId);
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
  String? localRef,
});
typedef UpdateContainerNumber = Future<void> Function(int id, String number);
typedef UpdateContainerStatus = Future<void> Function(int id, String status);
typedef SetPendingSync = Future<void> Function(int id, bool pending);
typedef SetPendingSyncLocal = Future<void> Function(int sampleId, bool pending);
typedef GetLocalNegative = Future<List<Map<String, dynamic>>> Function(
  int containerId,
);
typedef UpdateLocalStatus = Future<void> Function(int sampleId, String status);
typedef UpdateLocalFields = Future<void> Function(
  int sampleId,
  Map<String, dynamic> fields,
);
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
    HasPendingForContainer? hasPendingForContainer,
    SaveLocalOffline? saveLocalOffline,
    CleanupOffline? cleanupOffline,
    Enqueue? enqueue,
    UpdateContainerNumber? updateContainerNumber,
    UpdateContainerStatus? updateContainerStatus,
    SetPendingSync? setPendingSync,
    SetPendingSyncLocal? setPendingSyncLocal,
    GetLocalNegative? getLocalNegative,
    UpdateLocalStatus? updateLocalStatus,
    UpdateLocalFields? updateLocalFields,
    DeleteLocal? deleteLocal,
    GetQueuePayload? getQueuePayload,
    UpdateQueuePayload? updateQueuePayload,
  }) : _saveSamples = saveSamples ?? SampleDao.saveAll,
       _getCached = getCached ?? SampleDao.getByContainerId,
       _hasPendingForContainer =
           hasPendingForContainer ?? SampleDao.hasPendingForContainer,
       _saveLocalOffline = saveLocalOffline ?? _defaultSaveLocal,
       _cleanupOffline = cleanupOffline ?? SampleDao.cleanupAfterPull,
       _enqueue = enqueue ?? _defaultEnqueue,
       _updateContainerNumber =
           updateContainerNumber ?? ContainerDao.updateNumberLocal,
       _updateContainerStatus =
           updateContainerStatus ?? ContainerDao.updateStatusLocal,
       _setPendingSync = setPendingSync ?? ContainerDao.setPendingSync,
       _setPendingSyncLocal =
           setPendingSyncLocal ?? SampleDao.setPendingSyncLocal,
       _getLocalNegative =
           getLocalNegative ?? SampleDao.getLocalNegativeByContainer,
       _updateLocalStatus = updateLocalStatus ?? SampleDao.updateLocalStatus,
       _updateLocalFields = updateLocalFields ?? SampleDao.updateLocalFields,
       _deleteLocal = deleteLocal ?? SampleDao.deleteById,
       _getQueuePayload = getQueuePayload ?? SyncQueueDao.getPayloadByEndpoint,
       _updateQueuePayload =
           updateQueuePayload ?? SyncQueueDao.updatePayloadByEndpoint;

  final ApiClient _client;
  final SaveSamples _saveSamples;
  final GetSamplesByContainer _getCached;
  final HasPendingForContainer _hasPendingForContainer;
  final SaveLocalOffline _saveLocalOffline;
  final CleanupOffline _cleanupOffline;
  final Enqueue _enqueue;
  final UpdateContainerNumber _updateContainerNumber;
  final UpdateContainerStatus _updateContainerStatus;
  final SetPendingSync _setPendingSync;
  final SetPendingSyncLocal _setPendingSyncLocal;
  final GetLocalNegative _getLocalNegative;
  final UpdateLocalStatus _updateLocalStatus;
  final UpdateLocalFields _updateLocalFields;
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
    String? localRef,
  }) {
    return SyncQueueDao.enqueue(
      action: action,
      endpoint: endpoint,
      payload: payload,
      localRef: localRef,
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

      final hasPending = await _hasPendingForContainer(containerId);
      if (hasPending) {
        final cached = await _getCached(containerId);
        final sorted = [...cached]..sort(naturalCompareSampleNumber);
        return sorted.map(Sample.fromJson).toList();
      }

      final sorted = [...rawList]..sort(naturalCompareSampleNumber);
      return sorted.map(Sample.fromJson).toList();
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      final cached = await _getCached(containerId);
      final sorted = [...cached]..sort(naturalCompareSampleNumber);
      return sorted.map(Sample.fromJson).toList();
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

  /// c-2d-2c: офлайн-тара (`containerId < 0`) — сразу в очередь,
  /// сервер её не знает (negative ID → 404). `localRef = containerId`
  /// для маппинга после `bulk-create`.
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

    if (containerId < 0) {
      return _queueFillSamples(
        containerId: containerId,
        containerNumber: containerNumber,
        payload: payload,
        sampleGroups: sampleGroups,
        researchTypeName: researchTypeName,
        siteName: siteName,
      );
    }

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
      return _queueFillSamples(
        containerId: containerId,
        containerNumber: containerNumber,
        payload: payload,
        sampleGroups: sampleGroups,
        researchTypeName: researchTypeName,
        siteName: siteName,
      );
    }
  }

  Future<FillOutcome> _queueFillSamples({
    required int containerId,
    required String? containerNumber,
    required Map<String, dynamic> payload,
    required List<Map<String, dynamic>> sampleGroups,
    required String? researchTypeName,
    required String? siteName,
  }) async {
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
      // c-2d-2c: localRef — только для negative-ID (локальная тара,
      // которую надо маппить на bulk-create). Positive ID уже серверный,
      // маппить нечего.
      localRef: containerId < 0 ? '$containerId' : null,
    );
    return FillOutcome.queued;
  }

  Future<OnlineOutcome> update(
    int id,
    Map<String, dynamic> payload, {
    int? containerId,
  }) async {
    final endpoint = '/samples/$id/';
    try {
      await _client.patch<Map<String, dynamic>>(endpoint, data: payload);
      return OnlineOutcome.online;
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      if (id < 0) {
        if (containerId == null) {
          throw ArgumentError('update: containerId обязателен для id < 0');
        }
        final status = payload['status'] as String?;
        if (status != null) {
          await updateLocalOffline(
            id,
            containerId: containerId,
            status: _parseSampleStatus(status),
          );
        }
        return OnlineOutcome.queued;
      }
      await _enqueue(action: 'PATCH', endpoint: endpoint, payload: payload);
      await _updateLocalStatus(
        id,
        payload['status'] as String? ?? 'PENDING_PLACEMENT',
      );
      await _setPendingSyncLocal(id, true);
      if (containerId != null) {
        try {
          await _setPendingSync(containerId, true);
        } catch (_) {}
      }
      return OnlineOutcome.queued;
    }
  }

  Future<OnlineOutcome> dispose(
    int id, {
    String reason = '',
    int? containerId,
  }) async {
    final endpoint = '/samples/$id/dispose/';
    try {
      await _client.post<Map<String, dynamic>>(
        endpoint,
        data: {'disposal_reason': reason},
      );
      return OnlineOutcome.online;
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      if (id < 0) {
        if (containerId == null) {
          throw ArgumentError('dispose: containerId обязателен для id < 0');
        }
        await updateLocalOffline(
          id,
          containerId: containerId,
          status: SampleStatus.disposed,
        );
        return OnlineOutcome.queued;
      }
      await _enqueue(
        action: 'POST',
        endpoint: endpoint,
        payload: {'disposal_reason': reason},
      );
      await _updateLocalStatus(id, 'DISPOSED');
      await _setPendingSyncLocal(id, true);
      if (containerId != null) {
        try {
          await _setPendingSync(containerId, true);
        } catch (_) {}
      }
      return OnlineOutcome.queued;
    }
  }

  Future<OnlineOutcome> restore(int id, {int? containerId}) async {
    final endpoint = '/samples/$id/restore/';
    try {
      await _client.post<Map<String, dynamic>>(endpoint, data: const {});
      return OnlineOutcome.online;
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      if (id < 0) {
        if (containerId == null) {
          throw ArgumentError('restore: containerId обязателен для id < 0');
        }
        await updateLocalOffline(
          id,
          containerId: containerId,
          status: SampleStatus.pendingPlacement,
        );
        return OnlineOutcome.queued;
      }
      await _enqueue(action: 'POST', endpoint: endpoint, payload: const {});
      await _updateLocalStatus(id, 'IN_STORAGE');
      await _setPendingSyncLocal(id, true);
      if (containerId != null) {
        try {
          await _setPendingSync(containerId, true);
        } catch (_) {}
      }
      return OnlineOutcome.queued;
    }
  }

  Future<OnlineOutcome> deleteSample(int id, {int? containerId}) async {
    if (id < 0) {
      await _deleteLocal(id);
      if (containerId != null) {
        await _rebuildFillPayload(containerId);
      }
      return OnlineOutcome.online;
    }
    final endpoint = '/samples/$id/';
    try {
      await _client.delete<dynamic>(endpoint);
      return OnlineOutcome.online;
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      await _enqueue(action: 'DELETE', endpoint: endpoint, payload: const {});
      await _deleteLocal(id);
      if (containerId != null) {
        try {
          await _setPendingSync(containerId, true);
        } catch (_) {}
      }
      return OnlineOutcome.queued;
    }
  }

  Future<void> updateLocalOffline(
    int sampleId, {
    required int containerId,
    required SampleStatus status,
    String? newSampleNumber,
    String? newPrefix,
    String? newMiddle,
    int? newSequence,
    int? newSequenceDigits,
    String? newWellName,
  }) async {
    final fields = <String, dynamic>{'status': sampleStatusToApi(status)};
    if (newSampleNumber != null) fields['sample_number'] = newSampleNumber;
    if (newPrefix != null) fields['_prefix'] = newPrefix;
    if (newMiddle != null) fields['_middle'] = newMiddle;
    if (newSequence != null) fields['_sequence'] = newSequence;
    if (newSequenceDigits != null) {
      fields['_sequence_digits'] = newSequenceDigits;
    }
    if (newWellName != null) fields['_well_name'] = newWellName;

    await _updateLocalFields(sampleId, fields);
    await _rebuildFillPayload(containerId);
  }

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

  SampleStatus _parseSampleStatus(String raw) {
    switch (raw) {
      case 'IN_STORAGE':
        return SampleStatus.inStorage;
      case 'IN_TRANSIT':
        return SampleStatus.inTransit;
      case 'CONSUMED':
        // c-2.x-lifecycle-2c: старые данные — мапим в disposed.
        return SampleStatus.disposed;
      case 'DISPOSED':
        return SampleStatus.disposed;
      case 'PENDING_PLACEMENT':
        return SampleStatus.pendingPlacement;
      case 'SELECTED':
        return SampleStatus.selected;
      default:
        return SampleStatus.unknown;
    }
  }
}
