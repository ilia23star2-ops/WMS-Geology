/// Сервис проб.
///
/// Пока один метод — `fetchByContainerId`. Используется в карточке
/// тары для показа списка проб внутри.
library;

import '../models/sample.dart';
import 'api_client.dart';

class SampleService {
  SampleService(this._client);

  final ApiClient _client;

  /// GET /samples/?container_id={id}
  ///
  /// Возвращает список проб. Backend отдаёт `{count, next, previous,
  /// results}`. Берём `results`.
  Future<List<Sample>> fetchByContainerId(int containerId) async {
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
    return results
        .cast<Map<String, dynamic>>()
        .map(Sample.fromJson)
        .toList();
  }
}