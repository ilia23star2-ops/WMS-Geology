/// Какие записи справочника устарели (пачка catalog-prune-15a).
///
/// Pull делает upsert по `(kind, id)` и не удаляет исчезнувшие записи.
/// Из-за этого в кэше живут типы тары, которых на сервере больше нет,
/// и создание тары падает с «Тип тары #N не найден».
library;

/// ID записей, которых больше нет на сервере.
///
/// Две защиты:
/// - отрицательные ID не трогаем — это созданные офлайн записи,
///   их ещё не отправил `SyncPusher`;
/// - пустой ответ сервера не означает «удалить всё»: при сбое выборки
///   снесли бы весь справочник.
Set<int> staleCatalogIds({
  required Iterable<int> localIds,
  required Iterable<int> serverIds,
}) {
  final server = serverIds.toSet();
  if (server.isEmpty) return <int>{};

  final stale = <int>{};
  for (final id in localIds) {
    if (id < 0) continue;
    if (!server.contains(id)) stale.add(id);
  }
  return stale;
}
