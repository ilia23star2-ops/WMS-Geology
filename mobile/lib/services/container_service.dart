/// Сервис тары (c-7c, c-7d, c-7e-2, c-9, c-9-fill-offline-2b, c-2d-2a, c-2d-2c, c-2d-2c-fix-1, c-8b).
library;

import 'dart:convert';

import '../db/container_dao.dart';
import '../db/container_history_dao.dart';
import '../db/sync_queue_dao.dart';
import '../models/container.dart';
import '../models/container_history_entry.dart';
import 'api_client.dart';

enum PlaceOutcome { online, queued }

/// c-8b: результат `update`.
enum UpdateOutcome { online, queued }

/// c-2d-2: результат `bulkCreate`.
class BulkCreateResult {
  const BulkCreateResult({required this.count, required this.queued});
  final int count;
  final bool queued;
}

class ContainersPage {
  const ContainersPage({required this.count, required this.items});
  final int count;
  final List<Container> items;
}

typedef EnqueuePlace = Future<void> Function({
  required String action,
  required String endpoint,
  required Map<String, dynamic> payload,
  String? localRef,
});
typedef SaveHistory = Future<void> Function(
  int containerId,
  List<Map<String, dynamic>> items,
);
typedef GetCachedHistory = Future<List<Map<String, dynamic>>> Function(
  int containerId,
);
typedef GetAllCached = Future<List<Map<String, dynamic>>> Function();
typedef SetPendingSync = Future<void> Function(int id, bool pending);
typedef UpdateLocationLocal = Future<void> Function(
  int id, {
  required String status,
  int? cellId,
  String? cellFullAddress,
  int? floorRoomId,
  String? floorRoomName,
});
typedef UpdateFieldsLocal = Future<void> Function(
  int id,
  Map<String, dynamic> fields,
);

class ContainerService {
  ContainerService(
    this._client, {
    EnqueuePlace? enqueue,
    SaveHistory? saveHistory,
    GetCachedHistory? getCachedHistory,
    GetAllCached? getAllCached,
    SetPendingSync? setPendingSync,
    UpdateLocationLocal? updateLocationLocal,
    UpdateFieldsLocal? updateFieldsLocal,
  }) : _enqueue = enqueue ?? _defaultEnqueue,
       _saveHistory = saveHistory ?? ContainerHistoryDao.saveAll,
       _getCachedHistory =
           getCachedHistory ?? ContainerHistoryDao.getByContainerId,
       _getAllCached = getAllCached ?? ContainerDao.getAll,
       _setPendingSync = setPendingSync ?? ContainerDao.setPendingSync,
       _updateLocationLocal =
           updateLocationLocal ?? ContainerDao.updateLocationLocal,
       _updateFieldsLocal = updateFieldsLocal ?? ContainerDao.updateFieldsLocal;

  final ApiClient _client;
  final EnqueuePlace _enqueue;
  final SaveHistory _saveHistory;
  final GetCachedHistory _getCachedHistory;
  final GetAllCached _getAllCached;
  final SetPendingSync _setPendingSync;
  final UpdateLocationLocal _updateLocationLocal;
  final UpdateFieldsLocal _updateFieldsLocal;

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

  Future<Container> fetchById(int id) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/storage/containers/$id/',
      );
      final data = response.data;
      if (data == null) {
        throw ApiException(
          message: 'Пустой ответ от сервера для тары #$id.',
          statusCode: response.statusCode,
        );
      }

      try {
        await ContainerDao.saveAll([data]);
      } catch (_) {}

      return Container.fromJson(data);
    } catch (e) {
      final cached = await ContainerDao.getById(id);
      if (cached != null) {
        return Container.fromJson(cached);
      }
      rethrow;
    }
  }

  Future<ContainersPage> fetchList({
    int page = 1,
    int pageSize = 50,
    ContainerStatus? status,
    int? containerTypeId,
    String? draftWorkOrderCoded,
    int? draftResearchTypeId,
  }) async {
    final query = <String, dynamic>{'page': page};
    if (status != null) {
      final api = _statusToApi(status);
      if (api != null) query['status'] = api;
    }
    if (containerTypeId != null) {
      query['container_type_id'] = containerTypeId;
    }
    final wo = draftWorkOrderCoded?.trim();
    if (wo != null && wo.isNotEmpty) {
      query['draft_work_order_coded'] = wo;
    }
    if (draftResearchTypeId != null) {
      query['draft_research_type_id'] = draftResearchTypeId;
    }

    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/storage/containers/',
        queryParameters: query,
      );
      final data = response.data;
      if (data == null) {
        return const ContainersPage(count: 0, items: []);
      }
      final results =
          (data['results'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
          const <Map<String, dynamic>>[];

      try {
        await ContainerDao.saveAll(results);
      } catch (_) {}

      final items = results.map(Container.fromJson).toList(growable: false);
      final count = (data['count'] as int?) ?? items.length;
      return ContainersPage(count: count, items: items);
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;

      final raw = await _getAllCached();
      var items = raw.map(Container.fromJson).toList();

      if (status != null) {
        items = items.where((c) => c.status == status).toList();
      }
      if (containerTypeId != null) {
        items = items.where((c) => c.containerType == containerTypeId).toList();
      }
      if (wo != null && wo.isNotEmpty) {
        final q = wo.toLowerCase();
        items = items
            .where((c) => c.draftWorkOrderCoded.toLowerCase().contains(q))
            .toList();
      }
      if (draftResearchTypeId != null) {
        items = items
            .where((c) => c.draftResearchTypeId == draftResearchTypeId)
            .toList();
      }

      final total = items.length;
      final start = (page - 1) * pageSize;
      if (start >= total) {
        return ContainersPage(count: total, items: const []);
      }
      final end = (start + pageSize).clamp(start, total);
      return ContainersPage(count: total, items: items.sublist(start, end));
    }
  }

  Future<BulkCreateResult> bulkCreate({
    required List<Map<String, dynamic>> containers,
    int? draftSiteId,
    int? draftResearchTypeId,
    required String draftWorkOrderCoded,
    String draftWorkOrderIncoming = '',
  }) async {
    final body = <String, dynamic>{
      'containers': containers,
      if (draftSiteId != null) 'draft_site_id': draftSiteId,
      if (draftResearchTypeId != null)
        'draft_research_type_id': draftResearchTypeId,
      'draft_work_order_coded': draftWorkOrderCoded,
      'draft_work_order_incoming': draftWorkOrderIncoming,
    };

    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/storage/containers/bulk-create/',
        data: body,
      );
      final data = response.data;
      if (data == null) {
        throw ApiException(
          message: 'Пустой ответ от сервера при создании тары.',
          statusCode: response.statusCode,
        );
      }
      final count = (data['total_containers'] as int?) ?? 0;
      return BulkCreateResult(count: count, queued: false);
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;

      final now = DateTime.now().toUtc().millisecondsSinceEpoch;
      final localIds = <int>[];
      final localContainers = <Map<String, dynamic>>[];
      final createdAt = DateTime.now().toUtc().toIso8601String();

      for (var i = 0; i < containers.length; i++) {
        final id = -(now + i);
        localIds.add(id);

        final typeId = containers[i]['container_type_id'];
        final number = containers[i]['container_number'] as String?;

        final containerData = <String, dynamic>{
          'id': id,
          'container_type': typeId,
          'container_number': number,
          'status': 'PENDING_FILLING',
          'draft_site': draftSiteId,
          'draft_research_type': draftResearchTypeId,
          'draft_work_order_coded': draftWorkOrderCoded,
          'draft_work_order_incoming': draftWorkOrderIncoming,
          'comment': '',
          'created_at': createdAt,
          'updated_at': createdAt,
        };
        localContainers.add(containerData);
      }

      await ContainerDao.saveAll(localContainers);

      for (final id in localIds) {
        try {
          await _setPendingSync(id, true);
        } catch (_) {}
      }

      await _enqueue(
        action: 'POST',
        endpoint: '/storage/containers/bulk-create/',
        payload: body,
        localRef: jsonEncode(localIds),
      );

      return BulkCreateResult(count: localIds.length, queued: true);
    }
  }

  Future<List<ContainerHistoryEntry>> fetchHistory(int id) async {
    try {
      final response = await _client.get<List<dynamic>>(
        '/storage/containers/$id/history/',
      );
      final data = response.data;
      if (data == null) return const [];
      final rawList = data.whereType<Map<String, dynamic>>().toList(
        growable: false,
      );

      try {
        await _saveHistory(id, rawList);
      } catch (_) {}

      return rawList
          .map(ContainerHistoryEntry.fromJson)
          .toList(growable: false);
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      final cached = await _getCachedHistory(id);
      return cached.map(ContainerHistoryEntry.fromJson).toList(growable: false);
    }
  }

  /// c-8b: офлайн-редактирование шапки тары.
  ///
  /// Онлайн — `PATCH /storage/containers/{id}/`, `UpdateOutcome.online`.
  /// Офлайн — `sync_queue` (PATCH) + `ContainerDao.updateFieldsLocal` +
  /// `pending_sync = 1`, `UpdateOutcome.queued`.
  ///
  /// `payload` — серверные поля (`container_number`, `container_type`,
  /// `comment`, `position_on_pallet`, `draft_site`, `draft_research_type`,
  /// `draft_work_order_coded`, `draft_work_order_incoming`).
  Future<UpdateOutcome> update(int id, Map<String, dynamic> payload) async {
    try {
      final response = await _client.patch<Map<String, dynamic>>(
        '/storage/containers/$id/',
        data: payload,
      );
      final data = response.data;
      if (data == null) {
        throw ApiException(
          message: 'Пустой ответ от сервера при обновлении тары #$id.',
          statusCode: response.statusCode,
        );
      }

      try {
        await ContainerDao.saveAll([data]);
      } catch (_) {}

      return UpdateOutcome.online;
    } on ApiException catch (e) {
      // c-8b-fix-2: 4xx — реальная серверная валидация, в очередь
      // не кладём (сервер её всё равно отвергнет). Всё остальное
      // (сеть, таймауты, 5xx, unknown) — сохраняем локально + очередь.
      // Это страховка от того, что `api_client.dart` может
      // классифицировать `isNetworkError` как `false` для
      // `DioExceptionType.connectionTimeout` / `receiveTimeout` /
      // `unknown`.
      final code = e.statusCode ?? 0;
      if (code >= 400 && code < 500) rethrow;
      await _queueUpdateLocal(id, payload);
      return UpdateOutcome.queued;
    } catch (_) {
      // DioException / SocketException / TimeoutException / любое
      // другое исключение клиента — не 4xx, значит офлайн/сервер
      // недоступен. Сохраняем локально + очередь.
      await _queueUpdateLocal(id, payload);
      return UpdateOutcome.queued;
    }
  }

  Future<void> _queueUpdateLocal(int id, Map<String, dynamic> payload) async {
    try {
      await _updateFieldsLocal(id, payload);
    } catch (_) {}
    try {
      await _setPendingSync(id, true);
    } catch (_) {}
    await _enqueue(
      action: 'PATCH',
      endpoint: '/storage/containers/$id/',
      payload: payload,
    );
  }

  /// c-2d-2c: если среди `containerIds` есть negative (офлайн-тара),
  /// операция целиком уходит в `sync_queue` — атомарно.
  ///
  /// c-2d-2c-fix-1: при offline — локально обновить `containers`
  /// (`status = ACTIVE`, место).
  Future<PlaceOutcome> bulkPlace({
    required List<int> containerIds,
    int? cellId,
    int? floorRoomId,
    String? cellFullAddress,
    String? floorRoomName,
  }) async {
    if ((cellId == null) == (floorRoomId == null)) {
      throw ArgumentError(
        'bulkPlace: ровно один из cellId / floorRoomId должен быть задан',
      );
    }
    final body = <String, dynamic>{'container_ids': containerIds};
    if (cellId != null) body['cell_id'] = cellId;
    if (floorRoomId != null) body['floor_room_id'] = floorRoomId;

    final negatives = containerIds.where((id) => id < 0).toList();
    if (negatives.isNotEmpty) {
      await _enqueue(
        action: 'POST',
        endpoint: '/storage/containers/bulk-place/',
        payload: body,
        localRef: jsonEncode(negatives),
      );
      await _applyLocalPlace(
        containerIds: containerIds,
        cellId: cellId,
        cellFullAddress: cellFullAddress,
        floorRoomId: floorRoomId,
        floorRoomName: floorRoomName,
      );
      return PlaceOutcome.queued;
    }

    try {
      await _client.post<Map<String, dynamic>>(
        '/storage/containers/bulk-place/',
        data: body,
      );
      return PlaceOutcome.online;
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      await _enqueue(
        action: 'POST',
        endpoint: '/storage/containers/bulk-place/',
        payload: body,
      );
      await _applyLocalPlace(
        containerIds: containerIds,
        cellId: cellId,
        cellFullAddress: cellFullAddress,
        floorRoomId: floorRoomId,
        floorRoomName: floorRoomName,
      );
      return PlaceOutcome.queued;
    }
  }

  Future<void> _applyLocalPlace({
    required List<int> containerIds,
    required int? cellId,
    required String? cellFullAddress,
    required int? floorRoomId,
    required String? floorRoomName,
  }) async {
    for (final id in containerIds) {
      try {
        await _updateLocationLocal(
          id,
          status: 'ACTIVE',
          cellId: cellId,
          cellFullAddress: cellFullAddress,
          floorRoomId: floorRoomId,
          floorRoomName: floorRoomName,
        );
      } catch (_) {}
      try {
        await _setPendingSync(id, true);
      } catch (_) {}
    }
  }

  Future<List<int>> fetchLabelPdf(int id) {
    return _client.download('/storage/containers/$id/label.pdf/');
  }

  static String? _statusToApi(ContainerStatus s) {
    switch (s) {
      case ContainerStatus.pendingFilling:
        return 'PENDING_FILLING';
      case ContainerStatus.pendingPlacement:
        return 'PENDING_PLACEMENT';
      case ContainerStatus.active:
        return 'ACTIVE';
      case ContainerStatus.inTransit:
        return 'IN_TRANSIT';
      case ContainerStatus.issued:
        return 'ISSUED';
      case ContainerStatus.unknown:
        return null;
    }
  }
}
