import '../db/sync_queue_dao.dart';
import 'api_client.dart';

/// Сервис Push-синхронизации (отправка локальных изменений на сервер).
class SyncPusher {
  SyncPusher(
    this._client, {
    Future<List<SyncQueueItem>> Function()? getPendingItems,
    Future<void> Function(int id)? markSynced,
    Future<void> Function(int id, String error)? markError,
    Future<void> Function()? resetErrors,
  }) : _getPendingItems = getPendingItems ?? SyncQueueDao.getPending,
       _markSynced = markSynced ?? SyncQueueDao.markAsSynced,
       _markError = markError ?? SyncQueueDao.markAsError,
       _resetErrors = resetErrors ?? SyncQueueDao.resetErrors;

  final ApiClient _client;
  final Future<List<SyncQueueItem>> Function() _getPendingItems;
  final Future<void> Function(int id) _markSynced;
  final Future<void> Function(int id, String error) _markError;
  final Future<void> Function() _resetErrors;

  /// Отправить все накопленные изменения из очереди.
  Future<void> pushAll() async {
    // 1. Сбрасываем ошибки в PENDING (пробуем отправить снова)
    await _resetErrors();
    final items = await _getPendingItems();

    if (items.isEmpty) return;

    // 2. Отправляем по одному
    for (final item in items) {
      try {
        if (item.action == 'POST') {
          await _client.post(item.endpoint, data: item.payload);
        } else if (item.action == 'PATCH') {
          await _client.patch(item.endpoint, data: item.payload);
        } else if (item.action == 'DELETE') {
          await _client.delete(item.endpoint);
        }

        // Успех — удаляем из очереди
        if (item.id != null) {
          await _markSynced(item.id!);
        }
      } catch (e) {
        // Ошибка — помечаем и идём к следующему
        if (item.id != null) {
          await _markError(item.id!, e.toString());
        }
      }
    }
  }
}