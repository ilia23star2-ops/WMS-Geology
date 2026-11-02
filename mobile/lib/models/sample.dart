/// Модель пробы.
///
/// Ответ backend `GET /samples/` — SampleSerializer.
/// Проба в системе = навеска. Номер не уникален.
library;

enum SampleStatus {
  inStorage,
  inTransit,
  consumed,
  disposed,
  pendingPlacement,
  selected,
  unknown,
}

const Map<SampleStatus, String> sampleStatusLabels = {
  SampleStatus.inStorage: 'На хранении',
  SampleStatus.inTransit: 'В пути',
  SampleStatus.consumed: 'Израсходована',
  SampleStatus.disposed: 'Утилизирована',
  SampleStatus.pendingPlacement: 'Ожидает размещения',
  SampleStatus.selected: 'Выбрана',
  SampleStatus.unknown: 'Неизвестно',
};

SampleStatus _parseStatus(String? raw) {
  switch (raw) {
    case 'IN_STORAGE':
      return SampleStatus.inStorage;
    case 'IN_TRANSIT':
      return SampleStatus.inTransit;
    case 'CONSUMED':
      return SampleStatus.consumed;
    case 'DISPOSED':
      return SampleStatus.disposed;
    case 'PENDING_PLACEMENT':
      return SampleStatus.pendingPlacement;
    case 'SELECTED':
      return SampleStatus.selected;
    default:
      return SampleStatus.unknown;
  }
}

class Sample {
  const Sample({
    required this.id,
    required this.sampleNumber,
    required this.researchTypeName,
    required this.currentWorkOrderNumber,
    required this.status,
  });

  final int id;
  final String sampleNumber;
  final String researchTypeName;
  final String? currentWorkOrderNumber;
  final SampleStatus status;

  String get statusLabel =>
      sampleStatusLabels[status] ?? sampleStatusLabels[SampleStatus.unknown]!;

  factory Sample.fromJson(Map<String, dynamic> json) {
    return Sample(
      id: json['id'] as int,
      sampleNumber: json['sample_number'] as String,
      researchTypeName: json['research_type_name'] as String? ?? '',
      currentWorkOrderNumber: json['current_work_order_number'] as String?,
      status: _parseStatus(json['status'] as String?),
    );
  }

  @override
  String toString() => 'Sample(id: $id, number: $sampleNumber)';
}
