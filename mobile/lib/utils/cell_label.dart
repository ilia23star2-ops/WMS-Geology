/// Подпись «Секция X · Ярус Y» для плитки ячейки (topology-labels-mobile).
///
/// Приоритет — коды из API (`section_code` / `tier_code`).
/// Запасной вариант — разбор полного адреса: поддерживает оба
/// формата разделителя (« / » и «/»).
library;

String sectionTierLabel({
  String? sectionCode,
  String? tierCode,
  String? fullAddress,
}) {
  var sec = sectionCode;
  var tier = tierCode;
  if (sec == null || tier == null) {
    final raw = fullAddress ?? '';
    final parts = raw.contains(' / ') ? raw.split(' / ') : raw.split('/');
    sec ??= parts.length > 2 ? parts[2] : null;
    tier ??= parts.length > 3 ? parts[3] : null;
  }
  return ['Секция ', sec ?? '—', ' · Ярус ', tier ?? '—'].join('');
}
