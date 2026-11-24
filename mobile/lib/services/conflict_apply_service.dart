// ignore_for_file: prefer_initializing_formals
/// Применение выбора человека по расхождениям (conflict-apply-9).
///
/// «Оставить с планшета» — правка уже в очереди, push отправит её.
/// Здесь только убираем расхождение из списка.
///
/// «Взять с сервера» — пишем серверные значения в кэш и убираем эти поля
/// из payload очереди. Если править больше нечего — операция удаляется,
/// иначе следующий push вернул бы локальное значение.
library;

import '../utils/conflict_resolution.dart';
import '../utils/conflict_target.dart';
import '../utils/record_batch_merge.dart';
import '../utils/sync_conflicts.dart';

class ConflictApplyService {
  ConflictApplyService({
    required Future<Map<String, dynamic>?> Function(int id) getLocal,
    required Future<Map<String, dynamic>?> Function(String endpoint)
    getQueuePayload,
    required Future<void> Function(
      String endpoint,
      Map<String, dynamic> payload,
    )
    updateQueuePayload,
    required Future<void> Function(String endpoint) deleteQueueItem,
    required Future<void> Function(int id, Map<String, dynamic> fields)
    updateLocalFields,
  }) : _getLocal = getLocal,
       _getQueuePayload = getQueuePayload,
       _updateQueuePayload = updateQueuePayload,
       _deleteQueueItem = deleteQueueItem,
       _updateLocalFields = updateLocalFields;

  final Future<Map<String, dynamic>?> Function(int id) _getLocal;
  final Future<Map<String, dynamic>?> Function(String endpoint)
  _getQueuePayload;
  final Future<void> Function(String endpoint, Map<String, dynamic> payload)
  _updateQueuePayload;
  final Future<void> Function(String endpoint) _deleteQueueItem;
  final Future<void> Function(int id, Map<String, dynamic> fields)
  _updateLocalFields;

  /// Применяет выбор по всем спорным полям записи.
  Future<void> apply(RecordConflict conflict, {required bool keepLocal}) async {
    if (keepLocal) {
      SyncConflicts.remove(conflict.entity, conflict.id);
      return;
    }

    final endpoint = recordPatchEndpoint(conflict.entity, conflict.id);
    if (endpoint == null) return;

    var local = await _getLocal(conflict.id) ?? <String, dynamic>{};
    var payload = await _getQueuePayload(endpoint);
    var drop = false;
    final changed = <String, dynamic>{};

    for (final field in conflict.fields) {
      final result = resolveField(
        field: field.field,
        serverValue: field.serverValue,
        localRecord: local,
        queuePayload: payload,
        keepLocal: false,
      );
      local = result.localRecord;
      payload = result.queuePayload;
      drop = result.dropQueueItem;
      changed[field.field] = field.serverValue;
    }

    if (changed.isNotEmpty) {
      await _updateLocalFields(conflict.id, changed);
    }
    if (drop) {
      await _deleteQueueItem(endpoint);
    } else if (payload != null) {
      await _updateQueuePayload(endpoint, payload);
    }

    SyncConflicts.remove(conflict.entity, conflict.id);
  }
}
