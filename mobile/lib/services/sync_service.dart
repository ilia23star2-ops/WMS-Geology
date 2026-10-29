/// Сервис синхронизации (Pull) с сервера в локальную SQLite (3.x-offline-sync c-2).
///
/// Данные могут быть большими (10к+ записей), поэтому скачиваем
/// страницами по 50 штук (используя пагинацию DRF `?page=N`).
/// Каждая страница сразу сохраняется в БД и очищается из памяти.
library;

import '../db/container_dao.dart';
import '../db/sample_dao.dart';
import 'api_client.dart';

class SyncService {
  SyncService(
    this._client, {
    Future<void> Function(List<Map<String, dynamic>>)? saveContainers,
    Future<void> Function(List<Map<String, dynamic>>)? saveSamples,
  }) : _saveContainers = saveContainers ?? ContainerDao.saveAll,
       _saveSamples = saveSamples ?? SampleDao.saveAll;

  final ApiClient _client;

  // Функции для сохранения (по умолчанию — реальные DAO).
  // Передаются в тестах, чтобы не требовать реальную БД.
  final Future<void> Function(List<Map<String, dynamic>>) _saveContainers;
  final Future<void> Function(List<Map<String, dynamic>>) _saveSamples;

  /// Скачать все тары и пробы с сервера в локальный кэш.
  Future<void> pullAll() async {
    await _pullContainers();
    await _pullSamples();
  }

  /// Скачивание тар постранично.
  Future<void> _pullContainers() async {
    int page = 1;
    bool hasMore = true;

    while (hasMore) {
      final res = await _client.get<Map<String, dynamic>>(
        '/storage/containers/',
        queryParameters: {'page': page},
      );

      final data = res.data;
      if (data == null) break;

      final results =
          (data['results'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
          [];
      if (results.isEmpty) break;

      // Сохраняем страницу в SQLite
      await _saveContainers(results);

      // Проверяем, есть ли следующая страница (DRF отдаёт `next: null` в конце)
      hasMore = data['next'] != null;
      page++;
    }
  }

  /// Скачивание проб постранично.
  Future<void> _pullSamples() async {
    int page = 1;
    bool hasMore = true;

    while (hasMore) {
      final res = await _client.get<Map<String, dynamic>>(
        '/samples/',
        queryParameters: {'page': page},
      );

      final data = res.data;
      if (data == null) break;

      final results =
          (data['results'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
          [];
      if (results.isEmpty) break;

      // Сохраняем страницу в SQLite
      await _saveSamples(results);

      hasMore = data['next'] != null;
      page++;
    }
  }
}
