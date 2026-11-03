/// Сервис синхронизации (Pull) (c-2, c-7-offline-catalog, c-7e-3, c-9-fill-offline-2c-3-fix-3a).
///
/// c-9-fill-offline-2c-3-fix-3a: в конце `pullAll` — reconcile.
/// Для каждой пробы/тары с `pending_sync = 1`, которой **нет** в
/// `sync_queue`, сбрасываем флаг. Пробы/тары с записью в очереди
/// не трогаем (ждём Push).
///
/// **fix-3a (regex):** `/samples/{id}/` матчит и PATCH/DELETE
/// (`/samples/5/`), и dispose/restore (`/samples/5/dispose/`). Раньше
/// пробы с PATCH/DELETE в очереди **теряли** флаг при Pull — данные
/// «пропадали».
library;

import '../db/catalog_dao.dart';
import '../db/container_dao.dart';
import '../db/container_history_dao.dart';
import '../db/sample_dao.dart';
import '../db/sync_queue_dao.dart';
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
    Future<List<SyncQueueItem>> Function()? getQueueItems,
    Future<int> Function(Set<int> keepSampleIds)? reconcileSamples,
    Future<int> Function(Set<int> keepContainerIds)? reconcileContainers,
  }) : _saveContainers = saveContainers ?? ContainerDao.saveAll,
       _saveSamples = saveSamples ?? SampleDao.saveAll,
       _saveCatalog = saveCatalog ?? _defaultSaveCatalog,
       _saveHistory = saveHistory ?? ContainerHistoryDao.saveAll,
       _getQueueItems = getQueueItems ?? SyncQueueDao.getAll,
       _reconcileSamples =
           reconcileSamples ?? SampleDao.reconcilePendingSamples,
       _reconcileContainers =
           reconcileContainers ?? ContainerDao.reconcilePendingContainers;

  final ApiClient _client;
  final Future<void> Function(List<Map<String, dynamic>>) _saveContainers;
  final Future<void> Function(List<Map<String, dynamic>>) _saveSamples;
  final Future<void> Function(String, List<Map<String, dynamic>>) _saveCatalog;
  final Future<void> Function(int, List<Map<String, dynamic>>) _saveHistory;
  final Future<List<SyncQueueItem>> Function() _getQueueItems;
  final Future<int> Function(Set<int>) _reconcileSamples;
  final Future<int> Function(Set<int>) _reconcileContainers;

  static Future<void> _defaultSaveCatalog(
    String kind,
    List<Map<String, dynamic>> items,
  ) {
    return CatalogDao.saveAll(kind, items);
  }

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
    for (final id in containerIds) {
      await _pullHistoryFor(id);
    }
    await _reconcile();
  }

  /// c-9-fill-offline-2c-3-fix-3a: сбросить `pending_sync` у проб/тар,
  /// для которых в очереди нет записи.
  Future<void> _reconcile() async {
    final queue = await _getQueueItems();
    final keepSampleIds = <int>{};
    final keepContainerIds = <int>{};
    final sampleRe = RegExp(r'^/samples/(\d+)/(?:dispose/|restore/)?$');
    final fillRe = RegExp(r'^/storage/containers/(\d+)/fill-samples/$');
    for (final item in queue) {
      final sm = sampleRe.firstMatch(item.endpoint);
      if (sm != null) {
        keepSampleIds.add(int.parse(sm.group(1)!));
        continue;
      }
      final fm = fillRe.firstMatch(item.endpoint);
      if (fm != null) {
        keepContainerIds.add(int.parse(fm.group(1)!));
        continue;
      }
      if (item.endpoint == '/storage/containers/bulk-place/') {
        final ids = item.payload['container_ids'];
        if (ids is List) {
          for (final raw in ids) {
            if (raw is int) keepContainerIds.add(raw);
          }
        }
      }
    }
    await _reconcileSamples(keepSampleIds);
    await _reconcileContainers(keepContainerIds);
  }

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
