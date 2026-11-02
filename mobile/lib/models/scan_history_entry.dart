/// Запись истории сканов (c-7h).
///
/// Снимок «что видно в чипе»: Н/З (черновик), ТИ, номер тары.
///
/// `label` собирает строку в порядке:
///   `<Н/З> · <ТИ> · <номер тары>`
///
/// Примеры:
///   `TST0001 · Шлифы · T-001`
///   `TST0001 · Шлифы` (номер не присвоен — заготовка)
///   `T-001` (Н/З и ТИ пусты)
///   `Тара #42` (fallback, если всё пусто — старый формат)
library;

import 'container.dart';

class ScanHistoryEntry {
  const ScanHistoryEntry({
    required this.id,
    required this.containerNumber,
    required this.workOrderCoded,
    required this.researchTypeName,
  });

  final int id;
  final String? containerNumber;
  final String workOrderCoded;
  final String? researchTypeName;

  /// Снимок из `Container` (после скана).
  factory ScanHistoryEntry.fromContainer(Container c) {
    return ScanHistoryEntry(
      id: c.id,
      containerNumber: c.containerNumber,
      workOrderCoded: c.draftWorkOrderCoded,
      researchTypeName: c.draftResearchTypeName,
    );
  }

  String get label {
    final parts = <String>[];
    if (workOrderCoded.isNotEmpty) parts.add(workOrderCoded);
    final rt = researchTypeName;
    if (rt != null && rt.isNotEmpty) parts.add(rt);
    final n = containerNumber;
    if (n != null && n.isNotEmpty) parts.add(n);
    if (parts.isEmpty) return 'Тара #$id';
    return parts.join(' · ');
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'container_number': containerNumber,
    'work_order_coded': workOrderCoded,
    'research_type_name': researchTypeName,
  };

  factory ScanHistoryEntry.fromJson(Map<String, dynamic> json) {
    return ScanHistoryEntry(
      id: json['id'] as int,
      containerNumber: json['container_number'] as String?,
      workOrderCoded: json['work_order_coded'] as String? ?? '',
      researchTypeName: json['research_type_name'] as String?,
    );
  }
}
