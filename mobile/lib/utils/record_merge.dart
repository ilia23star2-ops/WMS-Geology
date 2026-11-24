/// Трёхстороннее слияние записей (пачка conflict-merge-1).
///
/// Решение 1.127/1А: разные поля объединяются автоматически, одно и то же
/// поле, изменённое с двух сторон, отдаётся человеку. Обычная работа
/// (создал, отредактировал, отправил) подтверждений не требует.
///
/// Логика чистая: работает с Map, ничего не знает про БД, сеть и UI —
/// поэтому одинаково пригодна для тары, проб и справочников.
library;

/// Поле, изменённое и на планшете, и на сервере.
class FieldConflict {
  const FieldConflict({
    required this.field,
    required this.localValue,
    required this.serverValue,
  });

  final String field;
  final dynamic localValue;
  final dynamic serverValue;

  @override
  String toString() =>
      'FieldConflict($field: планшет=$localValue, сервер=$serverValue)';
}

/// Итог слияния одной записи.
class MergeResult {
  const MergeResult({
    required this.merged,
    required this.conflicts,
    required this.autoMerged,
  });

  /// Значения, которые можно применить без вопроса человеку.
  /// Разошедшиеся поля сюда не попадают — ждут решения.
  final Map<String, dynamic> merged;

  /// Что нужно показать человеку.
  final List<FieldConflict> conflicts;

  /// Поля, объединённые автоматически (для сообщения в UI).
  final List<String> autoMerged;

  bool get needsDecision => conflicts.isNotEmpty;
}

/// Служебные поля: их не сливаем, всегда берём серверные.
const Set<String> kMergeIgnoredFields = <String>{
  'id',
  'created_at',
  'updated_at',
  'pending_sync',
  '_pending_sync',
};

/// Сливает запись по трём версиям.
///
/// [base] — снимок на момент прошлой синхронизации. Если его нет,
/// отличить «кто менял» невозможно, поэтому расхождение считается
/// конфликтом (безопаснее спросить, чем молча потерять правку).
MergeResult mergeRecords({
  required Map<String, dynamic>? base,
  required Map<String, dynamic> local,
  required Map<String, dynamic> server,
  Set<String> ignoreFields = kMergeIgnoredFields,
}) {
  final merged = <String, dynamic>{};
  final conflicts = <FieldConflict>[];
  final autoMerged = <String>[];

  final fields = <String>{...server.keys, ...local.keys};

  for (final field in fields) {
    if (ignoreFields.contains(field)) {
      if (server.containsKey(field)) merged[field] = server[field];
      continue;
    }

    final localValue = local[field];
    final serverValue = server[field];
    final hasLocal = local.containsKey(field);
    final hasServer = server.containsKey(field);

    // Одинаковые значения (в т.ч. оба отсутствуют) — вопросов нет.
    if (hasLocal == hasServer && localValue == serverValue) {
      if (hasServer) merged[field] = serverValue;
      continue;
    }

    // Нет снимка — не знаем, кто менял. Спрашиваем.
    if (base == null) {
      conflicts.add(
        FieldConflict(
          field: field,
          localValue: localValue,
          serverValue: serverValue,
        ),
      );
      continue;
    }

    final baseValue = base[field];
    final hadBase = base.containsKey(field);
    // Отсутствие ключа — изменение только если ключ был в снимке.
    // Иначе сторона поле не удаляла, а просто его не имела.
    final localChanged =
        hasLocal != hadBase || (hasLocal && localValue != baseValue);
    final serverChanged =
        hasServer != hadBase || (hasServer && serverValue != baseValue);

    if (localChanged && !serverChanged) {
      // Меняли только на планшете.
      if (hasLocal) merged[field] = localValue;
      autoMerged.add(field);
    } else if (!localChanged && serverChanged) {
      // Меняли только на сервере.
      if (hasServer) merged[field] = serverValue;
      autoMerged.add(field);
    } else if (localChanged && serverChanged) {
      // Оба меняли одно поле по-разному — решает человек.
      conflicts.add(
        FieldConflict(
          field: field,
          localValue: localValue,
          serverValue: serverValue,
        ),
      );
    } else {
      if (hasServer) merged[field] = serverValue;
    }
  }

  return MergeResult(
    merged: merged,
    conflicts: conflicts,
    autoMerged: autoMerged,
  );
}
