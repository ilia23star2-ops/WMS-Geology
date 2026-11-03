/// Сервис Push-синхронизации (c-3, c-9-fill-offline-2c-3-fix-2).
///
/// c-9-fill-offline-2c-3-fix-2:
/// - `pushAll` возвращает `PushResult { sent, failed }`.
/// - После **каждой** успешной операции зовёт `onSuccess(endpoint, payload)`.
///   Дефолт парсит endpoint и сбрасывает `_pending_sync` (проба) /
///   `pending_sync` (тара) — иконка `cloud_off` исчезает сразу после Push.
///
/// **fix-3a:** регулярка `/samples/{id}/` теперь матчит и PATCH/DELETE
/// (`/samples/5/`), и dispose/restore (`/samples/5/dispose/`). Раньше
/// `cloud_off` не сбрасывался после PATCH/DELETE.
library;

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
      try {
        if (item.action == 'POST') {
          await _client.post(item.endpoint, data: item.payload);
        } else if (item.action == 'PATCH') {
          await _client.patch(item.endpoint, data: item.payload);
        } else if (item.action == 'DELETE') {
          await _client.delete(item.endpoint);
        }

        if (item.id != null) {
          await _markSynced(item.id!);
        }

        // c-9-fill-offline-2c-3-fix-2: сбросить pending-флаги.
        try {
          await _onSuccess(item.endpoint, item.payload);
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
  ///
  /// **fix-3a:** регулярка `/samples/{id}/` матчит и PATCH/DELETE
  /// (`/samples/5/`), и dispose/restore (`/samples/5/dispose/`).
  static Future<void> _defaultOnSuccess(
    String endpoint,
    Map<String, dynamic> payload,
  ) async {
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
}
