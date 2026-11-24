/// Слияние партии записей при Pull (пачка conflict-pull-4).
///
/// Правило: записи без офлайн-правок берём серверные как есть — вопросов
/// нет. Записи с правками объединяем по полям. Если одно поле изменили
/// с двух сторон, локальное значение сохраняем в кэше (своё не теряем),
/// а расхождение отдаём человеку.
library;

import 'record_merge.dart';

/// Расхождение по одной записи: какие поля спорные.
class RecordConflict {
  const RecordConflict({
    required this.entity,
    required this.id,
    required this.fields,
    this.title,
  });

  final String entity;
  final int id;

  /// Человекочитаемая метка записи (номер тары/пробы) для списка.
  final String? title;

  final List<FieldConflict> fields;

  @override
  String toString() => 'RecordConflict($entity #$id: ${fields.length} полей)';
}

/// Итог слияния партии.
class BatchMergeResult {
  const BatchMergeResult({
    required this.toSave,
    required this.conflicts,
    required this.autoMergedFields,
  });

  /// Что записать в локальный кэш.
  final List<Map<String, dynamic>> toSave;

  /// Что показать человеку.
  final List<RecordConflict> conflicts;

  /// Сколько полей объединено автоматически (для сообщения в UI).
  final int autoMergedFields;

  bool get needsDecision => conflicts.isNotEmpty;
}

/// Сливает серверную партию с локальным состоянием.
///
/// [pendingIds] — записи, по которым есть неотправленные правки.
/// [baseById] — снимки на момент прошлой синхронизации.
BatchMergeResult mergeBatch({
  required String entity,
  required List<Map<String, dynamic>> serverRecords,
  required Map<int, Map<String, dynamic>> localById,
  required Map<int, Map<String, dynamic>> baseById,
  required Set<int> pendingIds,
  String Function(Map<String, dynamic>)? titleOf,
}) {
  final toSave = <Map<String, dynamic>>[];
  final conflicts = <RecordConflict>[];
  var autoMerged = 0;

  for (final server in serverRecords) {
    final id = server['id'];
    if (id is! int) {
      toSave.add(server);
      continue;
    }

    final local = localById[id];
    // Нет офлайн-правок или нет локальной копии — берём серверное.
    if (!pendingIds.contains(id) || local == null) {
      toSave.add(server);
      continue;
    }

    final result = mergeRecords(
      base: baseById[id],
      local: local,
      server: server,
    );
    autoMerged += result.autoMerged.length;

    if (result.needsDecision) {
      // Пока человек не решил — показываем своё, серверное не теряем:
      // оно лежит в конфликте и будет применено по выбору.
      toSave.add(<String, dynamic>{...local, 'pending_sync': 1});
      conflicts.add(
        RecordConflict(
          entity: entity,
          id: id,
          fields: result.conflicts,
          title: titleOf == null ? null : titleOf(server),
        ),
      );
      continue;
    }

    // Правки ещё не отправлены — флаг оставляем, снимет reconcile.
    toSave.add(<String, dynamic>{...result.merged, 'pending_sync': 1});
  }

  return BatchMergeResult(
    toSave: toSave,
    conflicts: conflicts,
    autoMergedFields: autoMerged,
  );
}
