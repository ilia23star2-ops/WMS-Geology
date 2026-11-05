/// Сервис Push-синхронизации (c-3, c-9-fill-offline-2c-3-fix-2, c-2d-2a, c-2d-2c).
///
/// c-2d-2:
/// - Обрабатывает `local_ref` в очереди.
/// - При успешном `bulk-create` маппит local IDs на server IDs.
/// - Обновляет ID тар / проб в SQLite и `payload` очереди.
///
/// c-2d-2c:
/// - После `bulk-create` перечитывает очередь, чтобы `fill-samples` /
///   `bulk-place` ушли на обновлённый endpoint (`/containers/42/...`).
/// - Защита от бесконечного цикла: уже обработанные `id` пропускаются
///   после reload (иначе — если `markSynced` не удалил запись —
///   `getPendingItems` вернёт её снова).
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';

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

  Future<PushResult> pushAll() async {
    await _resetErrors();
    var items = await _getPendingItems();
    if (items.isEmpty) return const PushResult(sent: 0, failed: 0);

    var sent = 0;
    var failed = 0;
    var i = 0;
    // c-2d-2c: защита от бесконечного цикла. После `bulk-create`
    // перечитываем очередь; если `getPendingItems` вернёт уже
    // обработанные записи (в тестах, при сбое `markSynced`),
    // пропускаем их.
    final processedIds = <int>{};

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

        if (item.endpoint == '/storage/containers/bulk-create/') {
          needsReload = true;
        }
      } catch (e) {
        if (item.id != null) {
          await _markError(item.id!, e.toString());
        }
        failed++;
      }

      if (item.id != null) processedIds.add(item.id!);

      if (needsReload) {
        items = await _getPendingItems();
        i = 0;
      } else {
        i++;
      }
    }
    return PushResult(sent: sent, failed: failed);
  }

  /// Дефолтный `onSuccess`: парсит endpoint и сбрасывает pending-флаги.
  /// c-2d-2: маппинг local IDs -> server IDs для bulk-create.
  static Future<void> _defaultOnSuccess(
    String endpoint,
    Map<String, dynamic> payload,
    String? localRef,
    Map<String, dynamic>? responseData,
  ) async {
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
