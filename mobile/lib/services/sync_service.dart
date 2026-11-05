/// Сервис синхронизации (Pull) (c-2, ..., c-8-catalog-create-offline).
library;

import 'dart:convert';

import '../db/catalog_dao.dart';
import '../db/container_dao.dart';
import '../db/container_history_dao.dart';
import '../db/sample_dao.dart';
import '../db/sync_queue_dao.dart';
import 'api_client.dart';

class PullStats {
  const PullStats({this.containers = 0, this.samples = 0});
  final int containers;
  final int samples;
  int get total => containers + samples;
  @override
  String toString() => 'PullStats(containers: $containers, samples: $samples)';
}

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

  Future<PullStats> pullAll({DateTime? updatedSince}) async {
    final isoSince = updatedSince?.toUtc().toIso8601String();
    final pulled = await _pullContainers(updatedSince: isoSince);
    final samples = await _pullSamples(updatedSince: isoSince);
    await _pullCatalog('/sites/', 'site');
    await _pullCatalog('/research-types/', 'research_type');
    await _pullCatalog('/laboratories/', 'laboratory');
    await _pullCatalog('/storage/container-types/', 'container_type');
    await _pullCatalog('/storage/rooms/', 'room');
    await _pullCatalog('/storage/racks/', 'rack');
    await _pullCatalog('/storage/sections/', 'section');
    await _pullCatalog('/storage/tiers/', 'tier');
    await _pullCatalog('/storage/cells/', 'cell');
    for (final id in pulled.ids) {
      await _pullHistoryFor(id);
    }
    await _reconcile();
    return PullStats(containers: pulled.ids.length, samples: samples);
  }

  /// c-9-fill-offline-2c-3-fix-3a + c-8-catalog-create-offline.
  ///
  /// Собираем «живые» ID из очереди (PENDING + ERROR):
  /// - `/samples/{id}/...` → keepSampleIds
  /// - `/storage/containers/{id}/fill-samples/` → keepContainerIds
  /// - `/storage/containers/bulk-place/` → keepContainerIds (из payload)
  /// - `/storage/containers/bulk-create/` → keepContainerIds (negative
  ///   из `localRef`, чтобы не сбросить `pending_sync` у офлайн-тар,
  ///   ещё не ушедших на сервер)
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
        continue;
      }
      // c-8-catalog-create-offline: keep negatives from bulk-create.
      if (item.endpoint == '/storage/containers/bulk-create/') {
        final localRef = item.localRef;
        if (localRef != null) {
          try {
            final ids = jsonDecode(localRef);
            if (ids is List) {
              for (final raw in ids) {
                if (raw is int && raw < 0) keepContainerIds.add(raw);
              }
            }
          } catch (_) {}
        }
        continue;
      }
    }
    await _reconcileSamples(keepSampleIds);
    await _reconcileContainers(keepContainerIds);
  }

  Future<({List<int> ids, int total})> _pullContainers({
    String? updatedSince,
  }) async {
    final ids = <int>[];
    var total = 0;
    int page = 1;
    while (true) {
      final query = <String, dynamic>{'page': page};
      if (updatedSince != null) query['updated_since'] = updatedSince;
      final res = await _client.get<Map<String, dynamic>>(
        '/storage/containers/',
        queryParameters: query,
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
      total += results.length;
      await _saveContainers(results);
      if (data['next'] == null) break;
      page++;
    }
    return (ids: ids, total: total);
  }

  Future<int> _pullSamples({String? updatedSince}) async {
    var total = 0;
    int page = 1;
    while (true) {
      final query = <String, dynamic>{'page': page};
      if (updatedSince != null) query['updated_since'] = updatedSince;
      final res = await _client.get<Map<String, dynamic>>(
        '/samples/',
        queryParameters: query,
      );
      final data = res.data;
      if (data == null) break;
      final results =
          (data['results'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
          const <Map<String, dynamic>>[];
      if (results.isEmpty) break;
      total += results.length;
      await _saveSamples(results);
      if (data['next'] == null) break;
      page++;
    }
    return total;
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
    } catch (_) {}
  }
}
