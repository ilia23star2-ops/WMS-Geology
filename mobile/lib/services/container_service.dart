/// Сервис тары.
///
/// - `fetchById` — карточка тары после сканирования QR (с офлайн-кэшем).
/// - `fetchHistory` — история изменений (`GET /storage/containers/{id}/history/`).
/// - `update` — редактирование (PATCH), только онлайн.
library;

import '../db/container_dao.dart';
import '../models/container.dart';
import '../models/container_history_entry.dart';
import 'api_client.dart';

class ContainerService {
  ContainerService(this._client);

  final ApiClient _client;

  /// GET /storage/containers/{id}/
  ///
  /// 1. Пытается загрузить с сервера.
  /// 2. При успехе кэширует ответ в SQLite.
  /// 3. При ошибке сети (или 404) пытается отдать данные из SQLite.
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
        // Кэш не критичен — продолжаем.
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

  /// GET /storage/containers/{id}/history/
  ///
  /// Возвращает записи аудита (от новых к старым).
  /// Без кэша: если сети нет — `ApiException.isNetworkError` пробросится.
  /// Кэш истории — отдельный заход `c-7e`.
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

  /// PATCH /storage/containers/{id}/
  ///
  /// Обновление полей тары. Только онлайн — офлайн-изменения
  /// через `sync_queue` появятся в `c-8`.
  ///
  /// Кэширует ответ в SQLite (`ContainerDao.saveAll`), чтобы при
  /// следующем офлайн-открытии карточка показывала актуальные данные.
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
}
