/// Адрес записи в API — чтобы найти её операцию в очереди (conflict-wire-8).
///
/// Когда человек выбирает «Взять с сервера», нужно не только поправить
/// кэш, но и убрать поле из payload очереди — иначе следующий push
/// вернёт локальное значение и отменит выбор.
library;

/// Endpoint правки записи по сущности и id.
///
/// `null` — сущность не правится по такому адресу (справочники, например,
/// создаются через POST на коллекцию, у них нет `/id/`).
String? recordPatchEndpoint(String entity, int id) {
  switch (entity) {
    case 'container':
      return '/storage/containers/$id/';
    case 'sample':
      return '/samples/$id/';
    default:
      return null;
  }
}
