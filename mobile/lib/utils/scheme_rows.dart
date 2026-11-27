/// Раскладка строк схемы и ключ заполненности (topology-scheme-mobile).
///
/// Паритет с веб `utils/cellOrder.ts` / `utils/schemeRows.ts`:
/// строки = ярусы (D→A), ячейки в числовом порядке; ключ цвета
/// empty/filled/near/full по count и limit.
library;

import '../models/catalog.dart';

/// Ключ заполненности (паритет с веб occupancyColor).
String occupancyKey(int count, int? limit) {
  if (count <= 0) return 'empty';
  if (limit == null || limit <= 0) return 'filled';
  if (count >= limit) return 'full';
  if (count >= limit * 0.7) return 'near';
  return 'filled';
}

/// Строка схемы: ярус + его ячейки.
class SchemeRow {
  const SchemeRow({
    required this.tierId,
    required this.label,
    required this.cells,
  });

  final int tierId;
  final String label;
  final List<CellInfo> cells;
}

int _intCode(String s) {
  final m = RegExp(r'[0-9]+').firstMatch(s);
  return m == null ? 0 : int.parse(m.group(0)!);
}

/// Строки D→A, ячейки слева→направо (числовой порядок).
List<SchemeRow> buildSchemeRows(
  List<NamedCatalog> tiers,
  Map<int, List<CellInfo>> cellsByTier,
) {
  final sorted = List<NamedCatalog>.from(tiers)
    ..sort((a, b) => b.label.compareTo(a.label));
  return sorted
      .map(
        (t) => SchemeRow(
          tierId: t.id,
          label: t.label,
          cells: List<CellInfo>.from(cellsByTier[t.id] ?? const [])
            ..sort((a, b) => _intCode(a.label).compareTo(_intCode(b.label))),
        ),
      )
      .toList();
}
