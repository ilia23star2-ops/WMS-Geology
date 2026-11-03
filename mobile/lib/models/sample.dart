/// Модель пробы (c-1, c-7a, c-7g, c-9-fill-samples-offline).
///
/// Проба = навеска. Номер не уникален.
/// c-7g: расширено — ID FK для справочников (`researchTypeId`, `siteId`),
/// `wellName`, `disposedAt`, `disposalReason`, `containerNumber`.
///
/// c-9-fill-samples-offline: `isOfflinePending` — проба создана офлайн
/// (`id < 0`), на сервер ещё не ушла. В UI помечается «офлайн», edit/delete
/// запрещены до синхронизации.
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

/// Обратное преобразование: enum → строка API. Для PATCH /samples/{id}/.
String sampleStatusToApi(SampleStatus status) {
  switch (status) {
    case SampleStatus.inStorage:
      return 'IN_STORAGE';
    case SampleStatus.inTransit:
      return 'IN_TRANSIT';
    case SampleStatus.consumed:
      return 'CONSUMED';
    case SampleStatus.disposed:
      return 'DISPOSED';
    case SampleStatus.pendingPlacement:
      return 'PENDING_PLACEMENT';
    case SampleStatus.selected:
      return 'SELECTED';
    case SampleStatus.unknown:
      return 'IN_STORAGE';
  }
}

class Sample {
  const Sample({
    required this.id,
    required this.sampleNumber,
    required this.researchTypeName,
    required this.currentWorkOrderNumber,
    required this.status,
    this.researchTypeId,
    this.siteId,
    this.wellName,
    this.containerNumber,
    this.disposedAt,
    this.disposalReason,
  });

  final int id;
  final String sampleNumber;
  final String researchTypeName;
  final String? currentWorkOrderNumber;
  final SampleStatus status;

  final int? researchTypeId;
  final int? siteId;
  final String? wellName;
  final String? containerNumber;
  final DateTime? disposedAt;
  final String? disposalReason;

  String get statusLabel =>
      sampleStatusLabels[status] ?? sampleStatusLabels[SampleStatus.unknown]!;

  /// c-9-fill-samples-offline: проба создана офлайн (`id < 0`),
  /// на сервер ещё не ушла. В UI помечается «офлайн», edit/delete
  /// запрещены до синхронизации.
  bool get isOfflinePending => id < 0;

  factory Sample.fromJson(Map<String, dynamic> json) {
    return Sample(
      id: json['id'] as int,
      sampleNumber: json['sample_number'] as String? ?? '',
      researchTypeName: json['research_type_name'] as String? ?? '',
      currentWorkOrderNumber: json['current_work_order_number'] as String?,
      status: _parseStatus(json['status'] as String?),
      researchTypeId: json['research_type'] as int?,
      siteId: json['site'] as int?,
      wellName: json['well_name'] as String?,
      containerNumber: json['container_number'] as String?,
      disposedAt: json['disposed_at'] != null
          ? DateTime.tryParse(json['disposed_at'] as String)
          : null,
      disposalReason: json['disposal_reason'] as String?,
    );
  }

  @override
  String toString() => 'Sample(id: $id, number: $sampleNumber)';
}
