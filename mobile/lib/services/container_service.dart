/// Сервис тары.
///
/// Пока один метод — `fetchById`. Используется для карточки тары
/// после сканирования QR.
///
/// `ApiClient` инжектируется извне — один и тот же клиент (с JWT
/// и авто-refresh) используется всеми сервисами приложения.
library;

import '../models/container.dart';
import 'api_client.dart';

class ContainerService {
  ContainerService(this._client);

  final ApiClient _client;

  /// GET /storage/containers/{id}/
  ///
  /// Бросает `ApiException` при 404/сетевой ошибке.
  Future<Container> fetchById(int id) async {
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
    return Container.fromJson(data);
  }
}