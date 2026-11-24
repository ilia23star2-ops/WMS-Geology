/// Сервис Push-синхронизации (c-3, ..., c-8-catalog-create-offline).
///
/// c-2d-2: маппинг `local_ref` после `bulk-create`.
/// c-2d-2c: перечитывание очереди после `bulk-create` + `processedIds`.
/// c-8b: PATCH `/storage/containers/{id}/` → `clearPendingSync(id)`.
/// c-8-catalog-create-offline: маппинг справочников (`/sites/` и др.).
///
/// c-8-catalog-create-offline-c:
/// - **Приоритет очереди:** справочники → bulk-create → операции над тарой
///   → samples ops → прочее.
/// - **Ретрай ERROR после маппинга:** один раз за `pushAll`.
///
/// sync-fix-4: ошибки связывания локальных записей с серверными больше не
/// глотаются. Критичные случаи бросают исключение, `pushAll` собирает их
/// в `PushResult.mappingErrors` — операция ушла, но кэш рассогласован,
/// и об этом надо сказать человеку, а не молчать.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../db/catalog_dao.dart';
import '../db/container_dao.dart';
import '../db/sample_dao.dart';
import '../db/sync_queue_dao.dart';
import 'api_client.dart';

class PushResult {
  const PushResult({
    required this.sent,
    required this.failed,
    this.mappingErrors = const <String>[],
  });

  final int sent;
  final int failed;

  /// Проблемы связывания локальных ID с серверными (sync-fix-4).
  /// Операция при этом могла уйти успешно.
  final List<String> mappingErrors;

  @override
  String toString() =>
      'PushResult(sent: $sent, failed: $failed, '
      'mappingErrors: ${mappingErrors.length})';
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
    if (RegExp(r'^/storage/containers/(-?\d+)/fill-samples/$')
        .hasMatch(endpoint)) {
      return 2;
    }
    if (endpoint == '/storage/containers/bulk-place/') {
      return 2;
    }
    if (RegExp(r'^/storage/containers/(-?\d+)/$').hasMatch(endpoint)) {
      return 2;
    }
    if (RegExp(r'^/samples/(-?\d+)/(?:dispose/|restore/)?$')
        .hasMatch(endpoint)) {
      return 3;
    }
    return 4;
  }

  /// Стабильная сортировка по приоритету.
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
    final mappingErrors = <String>[];
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

        // sync-fix-4: операция ушла, но связывание могло не удаться.
        // Не глотаем — собираем проблему для человека.
        try {
          await _onSuccess(
            item.endpoint,
            item.payload,
            item.localRef,
            responseData,
          );
        } catch (e) {
          final message =
              'Не удалось связать локальные записи (${item.endpoint}): $e';
          mappingErrors.add(message);
          debugPrint('[push] $message');
        }

        sent++;

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
    return PushResult(sent: sent, failed: failed, mappingErrors: mappingErrors);
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
    // sync-fix-4: ошибки маппинга пробрасываем в pushAll, не глотаем.
    if (endpoint == '/storage/containers/bulk-create/' &&
        localRef != null &&
        responseData != null) {
      await _remapBulkCreate(localRef, responseData);
      return;
    }

    final catalogKind = _catalogKindForEndpoint(endpoint);
    if (catalogKind != null && localRef != null && responseData != null) {
      await _remapCatalogCreate(catalogKind, localRef, responseData);
      return;
    }

    final sampleRe = RegExp(r'^/samples/(-?\d+)/(?:dispose/|restore/)?$');
    final sm = sampleRe.firstMatch(endpoint);
    if (sm != null) {
      await SampleDao.clearPendingSyncBySampleId(int.parse(sm.group(1)!));
      return;
    }

    final fillRe = RegExp(r'^/storage/containers/(-?\d+)/fill-samples/$');
    final fm = fillRe.firstMatch(endpoint);
    if (fm != null) {
      await ContainerDao.clearPendingSync(int.parse(fm.group(1)!));
      return;
    }

    final patchContainerRe = RegExp(r'^/storage/containers/(-?\d+)/$');
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
      throw StateError(
        'справочник $kind: некорректная пара локальный=$localRef '
        'серверный=$serverId',
      );
    }
    await CatalogDao.remapId(kind, negativeId, serverId);
    await SyncQueueDao.remapAllLocalRefs({negativeId: serverId});
    try {
      await CatalogDao.setPendingSync(kind, serverId, false);
    } catch (_) {
      // Некритично: флаг снимется при следующем Pull.
    }
    debugPrint('[c-8-catalog-create-offline] $kind: $negativeId → $serverId');
  }

  static Future<void> _remapBulkCreate(
    String localRef,
    Map<String, dynamic> responseData,
  ) async {
    final localRaw = jsonDecode(localRef);
    if (localRaw is! List) {
      throw StateError('bulk-create: local_ref не список: $localRef');
    }

    final created = responseData['created_containers'];
    if (created is! List) {
      throw StateError('bulk-create: в ответе нет created_containers');
    }
    if (created.length != localRaw.length) {
      throw StateError(
        'bulk-create: сервер вернул ${created.length} тар, '
        'ожидалось ${localRaw.length} — локальные ID не связаны',
      );
    }

    final mapping = <int, int>{};
    for (var i = 0; i < localRaw.length; i++) {
      final localId = localRaw[i];
      final item = created[i];
      final serverId = item is Map ? item['id'] : null;
      if (localId is int && serverId is int) {
        mapping[localId] = serverId;
      } else {
        throw StateError(
          'bulk-create: некорректная пара #$i (локальный=$localId)',
        );
      }
    }
    if (mapping.isEmpty) return;

    for (final entry in mapping.entries) {
      await ContainerDao.remapId(entry.key, entry.value);
      await SampleDao.remapContainerId(entry.key, entry.value);
    }

    await SyncQueueDao.remapAllLocalRefs(mapping);

    for (final entry in mapping.entries) {
      try {
        await ContainerDao.clearPendingSync(entry.value);
      } catch (_) {
        // Некритично: флаг снимется при следующем Pull.
      }
    }

    debugPrint('[c-2d-2] bulk-create mapped: $mapping');
  }
}
