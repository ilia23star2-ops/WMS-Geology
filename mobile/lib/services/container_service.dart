/// Сервис тары.
///
/// - `fetchById` — карточка тары (с офлайн-кэшем).
/// - `fetchHistory` — история изменений (`GET /storage/containers/{id}/history/`).
/// - `update` — редактирование (PATCH), только онлайн.
/// - `fetchLabelPdf` — PDF этикетки (`GET /storage/containers/{id}/label.pdf/`), c-7d.
/// - `bulkPlace` — размещение тары (`POST /storage/containers/bulk-place/`), c-7c.
///   При сетевой ошибке — кладёт POST в `sync_queue` (`PlaceOutcome.queued`).
library;

import '../db/container_dao.dart';
import '../db/sync_queue_dao.dart';
import '../models/container.dart';
import '../models/container_history_entry.dart';
import 'api_client.dart';

/// Результат `bulkPlace` (c-7c).
///
/// - `online` — POST ушёл на сервер, статус тары на сервере изменился.
/// - `queued` — POST отложен в `sync_queue`, уйдёт при `SyncPusher.pushAll()`.
enum PlaceOutcome { online, queued }

/// DI-хук для тестов. По умолчанию — `SyncQueueDao.enqueue`.
typedef EnqueuePlace = Future<void> Function({
  required String action,
  required String endpoint,
  required Map<String, dynamic> payload,
});

class ContainerService {
  ContainerService(this._client, {EnqueuePlace? enqueue})
    : _enqueue = enqueue ?? _defaultEnqueue;

  final ApiClient _client;
  final EnqueuePlace _enqueue;

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

  Future<List<ContainerHistoryEntry>> fetchHistory(int id) async {
    final response = await _client.get<List<dynamic>>(
      '/storage/containers/$id/history/',
    );
    final data = response.data;
    if (data == null) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(ContainerHistoryEntry.fromJson)
        .toList(growable: false);
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
  /// Размещение тары:
  /// - `cellId` — в ячейку (поддон создаётся автоматически, если нет);
  /// - `floorRoomId` — на пол в комнате.
  ///
  /// Ровно один из двух аргументов. Оба `null` или оба заданы → `ArgumentError`.
  ///
  /// **Офлайн-fallback (`c-7c`):** при `ApiException.isNetworkError == true`
  /// POST ставится в `sync_queue` как `POST /storage/containers/bulk-place/`,
  /// возвращается `PlaceOutcome.queued`. При следующем `SyncPusher.pushAll()`
  /// операция уйдёт на сервер. Валидационные ошибки (не network) — пробрасываются.
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
  /// Ошибка — `ApiException` (в т.ч. `isNetworkError` при офлайне).
  ///
  /// Использовать только онлайн — при офлайне бросает
  /// `ApiException(isNetworkError: true)`, экран показывает SnackBar.
  Future<List<int>> fetchLabelPdf(int id) {
    return _client.download('/storage/containers/$id/label.pdf/');
  }
}
