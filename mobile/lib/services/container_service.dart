/// Сервис тары.
///
/// - `fetchById` — карточка тары (с офлайн-кэшем).
/// - `fetchList` — реестр тары (c-9), офлайн — из `getAllCached`.
/// - `bulkCreate` — создание N тар (`POST .../bulk-create/`), c-9.
///   Офлайн не поддерживается: сервер генерирует ID.
/// - `fetchHistory` — история (c-7e-2, с кэшем).
/// - `update` — редактирование (PATCH), только онлайн.
/// - `fetchLabelPdf` — PDF этикетки (c-7d).
/// - `bulkPlace` — размещение (c-7c), offline через `sync_queue`.
library;

import '../db/container_dao.dart';
import '../db/container_history_dao.dart';
import '../db/sync_queue_dao.dart';
import '../models/container.dart';
import '../models/container_history_entry.dart';
import 'api_client.dart';

/// Результат `bulkPlace` (c-7c).
enum PlaceOutcome { online, queued }

/// Страница реестра тар (c-9).
class ContainersPage {
  const ContainersPage({required this.count, required this.items});

  final int count;
  final List<Container> items;
}

/// DI-хук для тестов. По умолчанию — `SyncQueueDao.enqueue`.
typedef EnqueuePlace = Future<void> Function({
  required String action,
  required String endpoint,
  required Map<String, dynamic> payload,
});

/// DI-хук для тестов истории (c-7e-2).
typedef SaveHistory = Future<void> Function(
  int containerId,
  List<Map<String, dynamic>> items,
);
typedef GetCachedHistory = Future<List<Map<String, dynamic>>> Function(
  int containerId,
);

/// DI-хук для `fetchList` офлайн (c-9).
typedef GetAllCached = Future<List<Map<String, dynamic>>> Function();

class ContainerService {
  ContainerService(
    this._client, {
    EnqueuePlace? enqueue,
    SaveHistory? saveHistory,
    GetCachedHistory? getCachedHistory,
    GetAllCached? getAllCached,
  }) : _enqueue = enqueue ?? _defaultEnqueue,
       _saveHistory = saveHistory ?? ContainerHistoryDao.saveAll,
       _getCachedHistory =
           getCachedHistory ?? ContainerHistoryDao.getByContainerId,
       _getAllCached = getAllCached ?? ContainerDao.getAll;

  final ApiClient _client;
  final EnqueuePlace _enqueue;
  final SaveHistory _saveHistory;
  final GetCachedHistory _getCachedHistory;
  final GetAllCached _getAllCached;

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
      } catch (_) {
        // Кэш не критичен.
      }

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
      } catch (_) {
        // Кэш не критичен.
      }

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

  /// POST /storage/containers/bulk-create/ (c-9-container-create).
  ///
  /// Создаёт N тар-заготовок. Draft-поля (участок, ТИ, Н/З) сохраняются
  /// на каждой таре. `container_number` не задаётся — присваивается при
  /// заполнении пробами.
  ///
  /// Возвращает `total_containers`. Офлайн **не поддерживается**: сервер
  /// генерирует ID. При `ApiException.isNetworkError` — пробрасываем, UI
  /// показывает ошибку.
  Future<int> bulkCreate({
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
    return (data['total_containers'] as int?) ?? 0;
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
      } catch (_) {
        // Кэш не критичен.
      }

      return rawList
          .map(ContainerHistoryEntry.fromJson)
          .toList(growable: false);
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      final cached = await _getCachedHistory(id);
      return cached.map(ContainerHistoryEntry.fromJson).toList(growable: false);
    }
  }

  Future<Container> update(int id, Map<String, dynamic> payload) async {
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
    } catch (_) {
      // Кэш не критичен.
    }

    return Container.fromJson(data);
  }

  Future<PlaceOutcome> bulkPlace({
    required List<int> containerIds,
    int? cellId,
    int? floorRoomId,
  }) async {
    if ((cellId == null) == (floorRoomId == null)) {
      throw ArgumentError(
        'bulkPlace: ровно один из cellId / floorRoomId должен быть задан',
      );
    }
    final body = <String, dynamic>{'container_ids': containerIds};
    if (cellId != null) body['cell_id'] = cellId;
    if (floorRoomId != null) body['floor_room_id'] = floorRoomId;

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
      return PlaceOutcome.queued;
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
