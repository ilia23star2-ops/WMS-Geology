/// Сервис тары.
///
/// Основной метод — `fetchById`. Используется для карточки тары
/// после сканирования QR.
///
/// Поддерживает офлайн-режим: если сеть недоступна,
/// данные берутся из локального кэша (SQLite).
library;

import '../db/container_dao.dart';
import '../models/container.dart';
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

      // Кэшируем успешный ответ для офлайн-режима
      try {
        await ContainerDao.saveAll([data]);
      } catch (_) {
        // Если не удалось сохранить в кэш — не критично, продолжаем
      }

      return Container.fromJson(data);
    } catch (e) {
      // Любая ошибка (сеть, 404, парсинг) — пробуем взять из кэша
      final cached = await ContainerDao.getById(id);
      if (cached != null) {
        return Container.fromJson(cached);
      }
      // Если кэша нет — пробрасываем исходную ошибку
      rethrow;
    }
  }
}