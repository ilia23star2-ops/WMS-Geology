/// Сервис синхронизации (Pull) с сервера в локальную SQLite
/// (3.x-offline-sync c-2, c-7-offline-catalog, c-7e-3).
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
///   `storage/cells`;
/// - **историю каждой тары** (c-7e-3): `GET /storage/containers/{id}/history/`
///   по одной таре. N запросов, где N = число тар. Ошибка по одной таре
///   не валит Pull.
///
/// **Для больших складов (сотни/тысячи тар):** N запросов в Pull —
/// узкое место. Нужен backend batch-эндпоинт (ТД-59). Пока — так.
library;

import '../db/catalog_dao.dart';
import '../db/container_dao.dart';
import '../db/container_history_dao.dart';
import '../db/sample_dao.dart';
import 'api_client.dart';

class SyncService {
  SyncService(
    this._client, {
    Future<void> Function(List<Map<String, dynamic>>)? saveContainers,
    Future<void> Function(List<Map<String, dynamic>>)? saveSamples,
    Future<void> Function(String kind, List<Map<String, dynamic>> items)?
    saveCatalog,
    Future<void> Function(int containerId, List<Map<String, dynamic>> items)?
    saveHistory,
  }) : _saveContainers = saveContainers ?? ContainerDao.saveAll,
       _saveSamples = saveSamples ?? SampleDao.saveAll,
       _saveCatalog = saveCatalog ?? _defaultSaveCatalog,
       _saveHistory = saveHistory ?? ContainerHistoryDao.saveAll;

  final ApiClient _client;

  final Future<void> Function(List<Map<String, dynamic>>) _saveContainers;
  final Future<void> Function(List<Map<String, dynamic>>) _saveSamples;
  final Future<void> Function(String, List<Map<String, dynamic>>) _saveCatalog;
  final Future<void> Function(int, List<Map<String, dynamic>>) _saveHistory;

  static Future<void> _defaultSaveCatalog(
    String kind,
    List<Map<String, dynamic>> items,
  ) {
    return CatalogDao.saveAll(kind, items);
  }

  /// Скачать всё: контейнеры, пробы, справочники, историю каждой тары.
  Future<void> pullAll() async {
    final containerIds = await _pullContainers();
    await _pullSamples();
    await _pullCatalog('/sites/', 'site');
    await _pullCatalog('/research-types/', 'research_type');
    await _pullCatalog('/laboratories/', 'laboratory');
    await _pullCatalog('/storage/container-types/', 'container_type');
    await _pullCatalog('/storage/rooms/', 'room');
    await _pullCatalog('/storage/racks/', 'rack');
    await _pullCatalog('/storage/sections/', 'section');
    await _pullCatalog('/storage/tiers/', 'tier');
    await _pullCatalog('/storage/cells/', 'cell');
    // c-7e-3: pre-fetch истории для всех тар.
    // N запросов. Ошибка по одной таре не валит Pull.
    for (final id in containerIds) {
      await _pullHistoryFor(id);
    }
  }

  /// Возвращает ID всех тар (для pre-fetch истории).
  Future<List<int>> _pullContainers() async {
    final ids = <int>[];
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
      for (final r in results) {
        final id = r['id'];
        if (id is int) ids.add(id);
      }
      await _saveContainers(results);
      if (data['next'] == null) break;
      page++;
    }
    return ids;
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

  /// c-7e-3: pre-fetch истории одной тары.
  ///
  /// Ошибки глотаем: история не критична для синхронизации. Если по
  /// одной таре упало — остальные тары и остальные части Pull в порядке.
  /// При следующем Pull попробуем снова.
  Future<void> _pullHistoryFor(int containerId) async {
    try {
      final res = await _client.get<List<dynamic>>(
        '/storage/containers/$containerId/history/',
      );
      final data = res.data;
      if (data == null) return;
      final items = data.whereType<Map<String, dynamic>>().toList(
        growable: false,
      );
      await _saveHistory(containerId, items);
    } catch (_) {
      // см. doc-комментарий
    }
  }
}
