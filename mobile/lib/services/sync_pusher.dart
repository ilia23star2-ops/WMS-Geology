/// Сервис Push-синхронизации (c-3, c-9-fill-offline-2c-3-fix-2, c-2d-2).
///
/// c-2d-2:
/// - Обрабатывает `local_ref` в очереди.
/// - При успешном `bulk-create` маппит local IDs на server IDs.
/// - Обновляет ID тар / проб в SQLite и `payload` очереди.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../db/container_dao.dart';
import '../db/sample_dao.dart';
import '../db/sync_queue_dao.dart';
import 'api_client.dart';

class PushResult {
  const PushResult({required this.sent, required this.failed});

  /// Сколько операций успешно ушло на сервер.
  final int sent;

  /// Сколько упало (помечены ERROR).
  final int failed;

  @override
  String toString() => 'PushResult(sent: $sent, failed: $failed)';
}

typedef OnSuccess = Future<void> Function(
  String endpoint,
  Map<String, dynamic> payload,
  String? localRef,
  Map<String, dynamic>? responseData, // c-2d-2: ответ сервера
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

  /// Отправить все накопленные изменения из очереди.
  Future<PushResult> pushAll() async {
    await _resetErrors();
    final items = await _getPendingItems();
    if (items.isEmpty) return const PushResult(sent: 0, failed: 0);

    var sent = 0;
    var failed = 0;
    for (final item in items) {
      Map<String, dynamic>? responseData;
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

        // c-9-fill-offline-2c-3-fix-2 + c-2d-2: сбросить pending-флаги и маппинг.
        try {
          await _onSuccess(
            item.endpoint,
            item.payload,
            item.localRef,
            responseData,
          );
        } catch (_) {
          // Сброс флага не критичен — Pull потом перезапишет.
        }

        sent++;
      } catch (e) {
        if (item.id != null) {
          await _markError(item.id!, e.toString());
        }
        failed++;
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
    // c-2d-2: bulk-create — маппинг negative ID → server ID.
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

  /// c-2d-2: разобрать ответ `bulk-create` и перемапить negative ID.
  ///
  /// См. `views.py::bulk_create` — возвращает
  /// `created_containers: [{id, ...}]`, `total_containers: N`.
  /// Порядок `created_containers` совпадает с порядком `containers` в
  /// payload (см. `services.bulk_create_containers` — цикл `.create()`
  /// в том же порядке).
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

    // 1) Локальный кэш: containers.id, samples.container_id.
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

    // 2) Очередь: payload + local_ref.
    await SyncQueueDao.remapAllLocalRefs(mapping);

    // 3) Снять pending_sync: в 2a офлайн-тары создаются без проб и без
    //    fill-samples/place в очереди. Если в 2c появятся такие операции —
    //    здесь понадобится проверка «есть ли ещё queued-операции для тары».
    for (final entry in mapping.entries) {
      try {
        await ContainerDao.clearPendingSync(entry.value);
      } catch (_) {
        // Кэш не критичен.
      }
    }

    debugPrint('[c-2d-2] bulk-create mapped: $mapping');
  }
}
