/// Сервис тары.
///
/// - `fetchById` — карточка тары (с офлайн-кэшем).
/// - `fetchHistory` — история изменений (`GET /storage/containers/{id}/history/`).
/// - `update` — редактирование (PATCH), только онлайн.
/// - `fetchLabelPdf` — PDF этикетки (`GET /storage/containers/{id}/label.pdf/`), c-7d.
library;

import '../db/container_dao.dart';
import '../models/container.dart';
import '../models/container_history_entry.dart';
import 'api_client.dart';

class ContainerService {
  ContainerService(this._client);

  final ApiClient _client;

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
