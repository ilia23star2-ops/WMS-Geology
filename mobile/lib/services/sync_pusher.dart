/// Сервис Push-синхронизации (c-3, ..., c-8-catalog-create-offline).
///
/// c-2d-2: маппинг `local_ref` после `bulk-create`.
/// c-2d-2c: перечитывание очереди после `bulk-create` + `processedIds`.
/// c-8b: PATCH `/storage/containers/{id}/` → `clearPendingSync(id)`.
/// c-8-catalog-create-offline: маппинг справочников (`/sites/` и др.).
///
/// c-8-catalog-create-offline-c:
/// - **Приоритет очереди:** справочники (site/research_type/laboratory/
///   container_type) → bulk-create → fill-samples/bulk-place/PATCH containers
///   → samples ops → прочее. Иначе при одинаковом `created_at` (мс) SQLite
///   может вернуть `bulk-create` раньше `site` → bulk-create уйдёт с
///   negative `draft_site_id` → 400.
/// - **Ретрай ERROR после маппинга:** после успешного `bulk-create` /
///   catalog create перечитываем очередь **и** сбрасываем ERROR → PENDING
///   один раз. Иначе `bulk-create`, упавший раньше, не будет повторён.
/// - **`debugPrint` при ошибке:** `[push] endpoint failed: message` — в
///   `flutter run` видно точный URL и текст.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../db/catalog_dao.dart';
import '../db/container_dao.dart';
import '../db/sample_dao.dart';
import '../db/sync_queue_dao.dart';
import 'api_client.dart';

class PushResult {
  const PushResult({required this.sent, required this.failed});
  final int sent;
  final int failed;

  @override
  String toString() => 'PushResult(sent: $sent, failed: $failed)';
}

typedef OnSuccess = Future<void> Function(
  String endpoint,
  Map<String, dynamic> payload,
  String? localRef,
  Map<String, dynamic>? responseData,
);

class SyncPusher {
  SyncPusher(
    this._client, {
    Future<List<SyncQueueItem>> Function()? getPendingItems,
    Future<void> Function(int id)? markSynced,
    Future<void> Function(int id, String error)? markError,
    Future<void> Function()? resetErrors,
    OnSuccess? onSuccess,
  }) : _getPendingItems = getPendingItems ?? SyncQueueDao.getPending,
       _markSynced = markSynced ?? SyncQueueDao.markAsSynced,
       _markError = markError ?? SyncQueueDao.markAsError,
       _resetErrors = resetErrors ?? SyncQueueDao.resetErrors,
       _onSuccess = onSuccess ?? _defaultOnSuccess;

  final ApiClient _client;
  final Future<List<SyncQueueItem>> Function() _getPendingItems;
  final Future<void> Function(int id) _markSynced;
  final Future<void> Function(int id, String error) _markError;
  final Future<void> Function() _resetErrors;
  final OnSuccess _onSuccess;

  /// Приоритет обработки: чем меньше — тем раньше.
  ///
  /// 0 — справочники (создают ID, на которые ссылается тара).
  /// 1 — bulk-create (создаёт ID тары).
  /// 2 — операции над тарой (PATCH / fill-samples / bulk-place).
  /// 3 — samples ops (PATCH/DELETE / dispose / restore).
  /// 4 — прочее.
  static int _endpointPriority(String endpoint) {
    if (endpoint == '/sites/' ||
        endpoint == '/research-types/' ||
        endpoint == '/laboratories/' ||
        endpoint == '/storage/container-types/') {
      return 0;
    }
    if (endpoint == '/storage/containers/bulk-create/') {
      return 1;
    }
    if (RegExp(r'^/storage/containers/(\d+)/fill-samples/$')
        .hasMatch(endpoint)) {
      return 2;
    }
    if (endpoint == '/storage/containers/bulk-place/') {
      return 2;
    }
    if (RegExp(r'^/storage/containers/(\d+)/$').hasMatch(endpoint)) {
      return 2;
    }
    if (RegExp(r'^/samples/(\d+)/(?:dispose/|restore/)?$').hasMatch(endpoint)) {
      return 3;
    }
    return 4;
  }

  /// Стабильная сортировка по приоритету. Сохраняет `created_at ASC`
  /// внутри одного приоритета.
  static void _sortByPriority(List<SyncQueueItem> items) {
    items.sort((a, b) {
      final p = _endpointPriority(a.endpoint)
          .compareTo(_endpointPriority(b.endpoint));
      if (p != 0) return p;
      return a.createdAt.compareTo(b.createdAt);
    });
  }

  Future<PushResult> pushAll() async {
    await _resetErrors();
    var items = await _getPendingItems();
    if (items.isEmpty) return const PushResult(sent: 0, failed: 0);
    _sortByPriority(items);

    var sent = 0;
    var failed = 0;
    var i = 0;
    final processedIds = <int>{};
    // c-8-catalog-create-offline-c: один раз за `pushAll` сбрасываем ERROR
    // в PENDING после маппинга, чтобы записи, упавшие из-за negative ID,
    // ушли повторно с серверными.
    var didRetryErrors = false;

    while (i < items.length) {
      final item = items[i];
      if (item.id != null && processedIds.contains(item.id)) {
        i++;
        continue;
      }

      Map<String, dynamic>? responseData;
      var needsReload = false;
      try {
        if (item.action == 'POST') {
          final resp = await _client.post<Map<String, dynamic>>(
            item.endpoint,
            data: item.payload,
          );
          responseData = resp.data;
        } else if (item.action == 'PATCH') {
          final resp = await _client.patch<Map<String, dynamic>>(
            item.endpoint,
            data: item.payload,
          );
          responseData = resp.data;
        } else if (item.action == 'DELETE') {
          await _client.delete(item.endpoint);
        }

        if (item.id != null) {
          await _markSynced(item.id!);
        }

        try {
          await _onSuccess(
            item.endpoint,
            item.payload,
            item.localRef,
            responseData,
          );
        } catch (_) {}

        sent++;

        // Reload после bulk-create / catalog create — там маппинг IDs.
        if (item.endpoint == '/storage/containers/bulk-create/' ||
            _catalogKindForEndpoint(item.endpoint) != null) {
          needsReload = true;
        }
      } catch (e) {
        debugPrint('[push] ${item.endpoint} failed: $e');
        if (item.id != null) {
          await _markError(item.id!, e.toString());
        }
        failed++;
      }

      if (item.id != null) processedIds.add(item.id!);

      if (needsReload) {
        // c-8-catalog-create-offline-c: первый reload — с resetErrors
        // (ERROR → PENDING), чтобы записи, упавшие из-за negative ID,
        // ушли повторно с серверными ID после маппинга.
        if (!didRetryErrors) {
          await _resetErrors();
          didRetryErrors = true;
        }
        items = await _getPendingItems();
        _sortByPriority(items);
        i = 0;
      } else {
        i++;
      }
    }
    return PushResult(sent: sent, failed: failed);
  }

  /// Endpoint → kind для `CatalogDao.remapId`. `null` — не справочник.
  static String? _catalogKindForEndpoint(String endpoint) {
    switch (endpoint) {
      case '/sites/':
        return 'site';
      case '/research-types/':
        return 'research_type';
      case '/laboratories/':
        return 'laboratory';
      case '/storage/container-types/':
        return 'container_type';
      default:
        return null;
    }
  }

  static Future<void> _defaultOnSuccess(
    String endpoint,
    Map<String, dynamic> payload,
    String? localRef,
    Map<String, dynamic>? responseData,
  ) async {
    // c-2d-2: bulk-create
    if (endpoint == '/storage/containers/bulk-create/' &&
        localRef != null &&
        responseData != null) {
      try {
        await _remapBulkCreate(localRef, responseData);
      } catch (e) {
        debugPrint('[c-2d-2] bulk-create onSuccess: $e');
      }
      return;
    }

    // c-8-catalog-create-offline: catalog create
    final catalogKind = _catalogKindForEndpoint(endpoint);
    if (catalogKind != null && localRef != null && responseData != null) {
      try {
        await _remapCatalogCreate(catalogKind, localRef, responseData);
      } catch (e) {
        debugPrint('[c-8-catalog-create-offline] $endpoint onSuccess: $e');
      }
      return;
    }

    final sampleRe = RegExp(r'^/samples/(\d+)/(?:dispose/|restore/)?$');
    final sm = sampleRe.firstMatch(endpoint);
    if (sm != null) {
      await SampleDao.clearPendingSyncBySampleId(int.parse(sm.group(1)!));
      return;
    }

    final fillRe = RegExp(r'^/storage/containers/(\d+)/fill-samples/$');
    final fm = fillRe.firstMatch(endpoint);
    if (fm != null) {
      await ContainerDao.clearPendingSync(int.parse(fm.group(1)!));
      return;
    }

    final patchContainerRe = RegExp(r'^/storage/containers/(\d+)/$');
    final pm = patchContainerRe.firstMatch(endpoint);
    if (pm != null) {
      await ContainerDao.clearPendingSync(int.parse(pm.group(1)!));
      return;
    }

    if (endpoint == '/storage/containers/bulk-place/') {
      final ids = payload['container_ids'];
      if (ids is List) {
        for (final raw in ids) {
          if (raw is int) {
            await ContainerDao.clearPendingSync(raw);
          }
        }
      }
    }
  }

  /// c-8-catalog-create-offline: negative ID справочника → server ID.
  static Future<void> _remapCatalogCreate(
    String kind,
    String localRef,
    Map<String, dynamic> responseData,
  ) async {
    final negativeId = int.tryParse(localRef);
    final serverId = responseData['id'];
    if (negativeId == null || serverId is! int || negativeId >= 0) {
      debugPrint(
        '[c-8-catalog-create-offline] bad pair: $localRef → $serverId',
      );
      return;
    }
    try {
      await CatalogDao.remapId(kind, negativeId, serverId);
    } catch (e) {
      debugPrint(
        '[c-8-catalog-create-offline] CatalogDao.remapId($kind, '
        '$negativeId→$serverId): $e',
      );
    }
    await SyncQueueDao.remapAllLocalRefs({negativeId: serverId});
    try {
      await CatalogDao.setPendingSync(kind, serverId, false);
    } catch (_) {}
    debugPrint('[c-8-catalog-create-offline] $kind: $negativeId → $serverId');
  }

  static Future<void> _remapBulkCreate(
    String localRef,
    Map<String, dynamic> responseData,
  ) async {
    final localRaw = jsonDecode(localRef);
    if (localRaw is! List) {
      debugPrint('[c-2d-2] bulk-create: local_ref не список: $localRef');
      return;
    }

    final created = responseData['created_containers'];
    if (created is! List) {
      debugPrint('[c-2d-2] bulk-create: в ответе нет created_containers');
      return;
    }
    if (created.length != localRaw.length) {
      debugPrint(
        '[c-2d-2] bulk-create: сервер вернул ${created.length}, '
        'ожидалось ${localRaw.length}. Маппинг пропущен.',
      );
      return;
    }

    final mapping = <int, int>{};
    for (var i = 0; i < localRaw.length; i++) {
      final localId = localRaw[i];
      final item = created[i];
      final serverId = item is Map ? item['id'] : null;
      if (localId is int && serverId is int) {
        mapping[localId] = serverId;
      } else {
        debugPrint(
          '[c-2d-2] bulk-create: некорректная пара #$i: '
          'local=$localId server=${item is Map ? item['id'] : '?'}',
        );
      }
    }
    if (mapping.isEmpty) return;

    for (final entry in mapping.entries) {
      try {
        await ContainerDao.remapId(entry.key, entry.value);
      } catch (e) {
        debugPrint(
          '[c-2d-2] ContainerDao.remapId(${entry.key}→${entry.value}): $e',
        );
      }
      try {
        await SampleDao.remapContainerId(entry.key, entry.value);
      } catch (e) {
        debugPrint(
          '[c-2d-2] SampleDao.remapContainerId(${entry.key}→${entry.value}): $e',
        );
      }
    }

    await SyncQueueDao.remapAllLocalRefs(mapping);

    for (final entry in mapping.entries) {
      try {
        await ContainerDao.clearPendingSync(entry.value);
      } catch (_) {}
    }

    debugPrint('[c-2d-2] bulk-create mapped: $mapping');
  }
}
