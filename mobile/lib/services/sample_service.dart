/// Сервис проб.
///
/// Основной метод — `fetchByContainerId`. Используется в карточке
/// тары для показа списка проб внутри.
///
/// Поддерживает офлайн-режим: если сеть недоступна,
/// пробы берутся из локального кэша (SQLite).
library;

import '../db/sample_dao.dart';
import '../models/sample.dart';
import 'api_client.dart';

class SampleService {
  SampleService(this._client);

  final ApiClient _client;

  /// GET /samples/?container_id={id}
  ///
  /// 1. Пытается загрузить с сервера.
  /// 2. При успехе кэширует ответ в SQLite.
  /// 3. При ошибке сети (или пустом ответе) отдаёт данные из SQLite.
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
      if (results is! List) {
        return const [];
      }
      final rawList = results.cast<Map<String, dynamic>>();

      // Кэшируем успешный ответ для офлайн-режима.
      try {
        await SampleDao.saveAll(rawList);
      } catch (_) {
        // Если не удалось сохранить в кэш — не критично.
      }

      return rawList.map(Sample.fromJson).toList();
    } catch (e) {
      // Любая ошибка (сеть, парсинг, 500) — пробуем SQLite.
      final cached = await SampleDao.getByContainerId(containerId);
      if (cached.isNotEmpty) {
        return cached.map(Sample.fromJson).toList();
      }
      rethrow;
    }
  }
}
