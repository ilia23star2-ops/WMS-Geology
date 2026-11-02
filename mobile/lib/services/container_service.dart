/// Сервис тары.
///
/// - `fetchById` — карточка тары (с офлайн-кэшем).
/// - `fetchHistory` — история изменений (`GET /storage/containers/{id}/history/`),
///   с офлайн-кэшем (c-7e-2).
/// - `update` — редактирование (PATCH), только онлайн.
/// - `fetchLabelPdf` — PDF этикетки (`GET /storage/containers/{id}/label.pdf/`), c-7d.
/// - `bulkPlace` — размещение тары (`POST /storage/containers/bulk-place/`), c-7c.
///   При сетевой ошибке — кладёт POST в `sync_queue` (`PlaceOutcome.queued`).
library;

import '../db/container_dao.dart';
import '../db/container_history_dao.dart';
import '../db/sync_queue_dao.dart';
import '../models/container.dart';
import '../models/container_history_entry.dart';
import 'api_client.dart';

/// Результат `bulkPlace` (c-7c).
enum PlaceOutcome { online, queued }

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

class ContainerService {
  ContainerService(
    this._client, {
    EnqueuePlace? enqueue,
    SaveHistory? saveHistory,
    GetCachedHistory? getCachedHistory,
  }) : _enqueue = enqueue ?? _defaultEnqueue,
       _saveHistory = saveHistory ?? ContainerHistoryDao.saveAll,
       _getCachedHistory =
           getCachedHistory ?? ContainerHistoryDao.getByContainerId;

  final ApiClient _client;
  final EnqueuePlace _enqueue;
  final SaveHistory _saveHistory;
  final GetCachedHistory _getCachedHistory;

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

  /// GET /storage/containers/{id}/history/ (c-7e-2: с офлайн-кэшем).
  ///
  /// - Онлайн: запрос → сохранить в кэш → вернуть.
  /// - Офлайн (`ApiException.isNetworkError`): вернуть из кэша (может быть
  ///   пусто, если история никогда не открывалась онлайн — это нормальный
  ///   ответ, не ошибка).
  /// - Валидационная ошибка (не network) — пробросить.
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

  /// POST /storage/containers/bulk-place/ (c-7c).
  ///
  /// Ровно один из `cellId` / `floorRoomId`. Оба null или оба заданы →
  /// `ArgumentError`.
  ///
  /// При `ApiException.isNetworkError == true` POST ставится в `sync_queue`
  /// и возвращается `PlaceOutcome.queued`.
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

  /// GET /storage/containers/{id}/label.pdf/
  ///
  /// Скачивает PDF как байты. JWT — через `ApiClient.dio` interceptor.
  Future<List<int>> fetchLabelPdf(int id) {
    return _client.download('/storage/containers/$id/label.pdf/');
  }
}
