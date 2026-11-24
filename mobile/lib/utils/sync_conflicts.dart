/// Расхождения, ожидающие решения человека (пачка conflict-pull-6).
///
/// Храним в памяти: расхождение обнаруживается заново при каждом Pull,
/// пока локальная правка не отправлена или человек не выбрал вариант.
/// Поэтому переживать перезапуск приложения им не обязательно — данные
/// целы, а список восстановится на следующей синхронизации.
library;

import 'record_batch_merge.dart';

class SyncConflicts {
  SyncConflicts._();

  static final List<RecordConflict> _items = <RecordConflict>[];

  static List<RecordConflict> get items => List.unmodifiable(_items);
  static int get count => _items.length;
  static bool get isEmpty => _items.isEmpty;
  static bool get isNotEmpty => _items.isNotEmpty;

  /// Обновляет расхождения по обработанной странице записей.
  ///
  /// Сначала убираем старые по этим id, затем кладём свежие — иначе
  /// решённое расхождение висело бы в списке вечно, а страницы плодили
  /// бы дубли.
  static void syncPage(
    String entity,
    Set<int> processedIds,
    List<RecordConflict> fresh,
  ) {
    _items.removeWhere(
      (c) => c.entity == entity && processedIds.contains(c.id),
    );
    _items.addAll(fresh);
  }

  /// Убрать расхождение после выбора человека.
  static void remove(String entity, int id) {
    _items.removeWhere((c) => c.entity == entity && c.id == id);
  }

  static void clear() => _items.clear();
}
