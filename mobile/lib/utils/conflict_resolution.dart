/// Применение выбора человека по разошедшемуся полю (conflict-apply-7).
///
/// «Оставить с планшета» — ничего не меняем: правка уже в очереди,
/// push отправит её, сервер получит наше значение.
///
/// «Взять с сервера» — пишем серверное значение в кэш И убираем поле
/// из payload очереди. Иначе следующий push вернёт локальное значение
/// и молча отменит выбор человека.
library;

/// Итог применения выбора по одному полю.
class FieldResolution {
  const FieldResolution({
    required this.localRecord,
    required this.queuePayload,
    required this.dropQueueItem,
  });

  /// Что записать в локальный кэш.
  final Map<String, dynamic> localRecord;

  /// Новый payload очереди; null — операция не нужна.
  final Map<String, dynamic>? queuePayload;

  /// Убрать операцию из очереди (править больше нечего).
  final bool dropQueueItem;
}

/// Применяет выбор по полю, не мутируя исходные Map.
FieldResolution resolveField({
  required String field,
  required dynamic serverValue,
  required Map<String, dynamic> localRecord,
  required Map<String, dynamic>? queuePayload,
  required bool keepLocal,
}) {
  if (keepLocal) {
    return FieldResolution(
      localRecord: Map<String, dynamic>.from(localRecord),
      queuePayload: queuePayload == null
          ? null
          : Map<String, dynamic>.from(queuePayload),
      dropQueueItem: false,
    );
  }

  final newLocal = Map<String, dynamic>.from(localRecord);
  newLocal[field] = serverValue;

  if (queuePayload == null) {
    return FieldResolution(
      localRecord: newLocal,
      queuePayload: null,
      dropQueueItem: false,
    );
  }

  final newPayload = Map<String, dynamic>.from(queuePayload)..remove(field);
  return FieldResolution(
    localRecord: newLocal,
    queuePayload: newPayload.isEmpty ? null : newPayload,
    dropQueueItem: newPayload.isEmpty,
  );
}
