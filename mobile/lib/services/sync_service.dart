/// Сервис синхронизации (Pull) с сервера в локальную SQLite
/// (3.x-offline-sync c-2, c-7-offline-catalog).
///
/// Данные могут быть большими (10к+ записей), поэтому скачиваем
/// страницами по 50 штук (`?page=N`). Каждая страница сразу
/// сохраняется в БД и очищается из памяти.
///
/// `pullAll` тянет:
/// - `containers`, `samples` (c-2);
/// - справочники (c-7-offline-catalog): `sites`, `research-types`,
///   `laboratories`, `storage/container-types`, `storage/rooms`,
///   `storage/racks`, `storage/sections`, `storage/tiers`,
///   `storage/cells`.
///
/// Без справочников офлайн-каскад размещения (`c-7c`) не открывается —
/// см. `DECISIONS 1.93`.
library;

import '../db/catalog_dao.dart';
import '../db/container_dao.dart';
import '../db/sample_dao.dart';
import 'api_client.dart';

class SyncService {
  SyncService(
    this._client, {
    Future<void> Function(List<Map<String, dynamic>>)? saveContainers,
    Future<void> Function(List<Map<String, dynamic>>)? saveSamples,
    Future<void> Function(String kind, List<Map<String, dynamic>> items)?
    saveCatalog,
  }) : _saveContainers = saveContainers ?? ContainerDao.saveAll,
       _saveSamples = saveSamples ?? SampleDao.saveAll,
       _saveCatalog = saveCatalog ?? _defaultSaveCatalog;

  final ApiClient _client;

  final Future<void> Function(List<Map<String, dynamic>>) _saveContainers;
  final Future<void> Function(List<Map<String, dynamic>>) _saveSamples;
  final Future<void> Function(String, List<Map<String, dynamic>>) _saveCatalog;

  static Future<void> _defaultSaveCatalog(
    String kind,
    List<Map<String, dynamic>> items,
  ) {
    return CatalogDao.saveAll(kind, items);
  }

  /// Скачать всё: контейнеры, пробы, справочники.
  Future<void> pullAll() async {
    await _pullContainers();
    await _pullSamples();
    // Справочники (c-7-offline-catalog).
    await _pullCatalog('/sites/', 'site');
    await _pullCatalog('/research-types/', 'research_type');
    await _pullCatalog('/laboratories/', 'laboratory');
    await _pullCatalog('/storage/container-types/', 'container_type');
    await _pullCatalog('/storage/rooms/', 'room');
    await _pullCatalog('/storage/racks/', 'rack');
    await _pullCatalog('/storage/sections/', 'section');
    await _pullCatalog('/storage/tiers/', 'tier');
    await _pullCatalog('/storage/cells/', 'cell');
  }

  Future<void> _pullContainers() async {
    int page = 1;
    while (true) {
      final res = await _client.get<Map<String, dynamic>>(
        '/storage/containers/',
        queryParameters: {'page': page},
      );
      final data = res.data;
      if (data == null) break;
      final results =
          (data['results'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
          const <Map<String, dynamic>>[];
      if (results.isEmpty) break;
      await _saveContainers(results);
      if (data['next'] == null) break;
      page++;
    }
  }

  Future<void> _pullSamples() async {
    int page = 1;
    while (true) {
      final res = await _client.get<Map<String, dynamic>>(
        '/samples/',
        queryParameters: {'page': page},
      );
      final data = res.data;
      if (data == null) break;
      final results =
          (data['results'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
          const <Map<String, dynamic>>[];
      if (results.isEmpty) break;
      await _saveSamples(results);
      if (data['next'] == null) break;
      page++;
    }
  }

  /// Универсальный постраничный Pull справочника.
  ///
  /// `parent_id` для topology (`rack`/`section`/`tier`/`cell`) извлекается
  /// из JSON в `CatalogDao.saveAll` (см. `catalogParentId`). Если сервер
  /// не отдал поле-родителя — запись сохранится с `parent_id = NULL`,
  /// и офлайн-фильтр по родителю не покажет её (онлайн при этом работает).
  Future<void> _pullCatalog(String endpoint, String kind) async {
    int page = 1;
    while (true) {
      final res = await _client.get<Map<String, dynamic>>(
        endpoint,
        queryParameters: {'page': page},
      );
      final data = res.data;
      if (data == null) break;
      final results =
          (data['results'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
          const <Map<String, dynamic>>[];
      if (results.isEmpty) break;
      await _saveCatalog(kind, results);
      if (data['next'] == null) break;
      page++;
    }
  }
}
