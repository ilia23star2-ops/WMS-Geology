/// Модель пробы (c-1, c-7a, c-7g, c-9-fill-offline-2a, -2c-1, -2c-2, -2c-3).
///
/// Проба = навеска. Номер не уникален.
///
/// c-9-fill-offline-2c-3:
/// - `isOfflinePending` — `id < 0`, создана офлайн.
/// - `pendingSync` — есть несинхронизированные изменения (серверная проба,
///   правленная офлайн). Сбрасывается при Pull, если сервер вернул версию
///   без изменений.
library;

enum SampleStatus {
  inStorage,
  inTransit,
  disposed,
  pendingPlacement,
  selected,
  unknown,
}

const Map<SampleStatus, String> sampleStatusLabels = {
  SampleStatus.inStorage: 'На хранении',
  SampleStatus.inTransit: 'В пути',
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
      // c-2.x-lifecycle-2c: старые данные (кэш/сервер) — мапим в disposed.
      return SampleStatus.disposed;
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

/// Обратное преобразование: enum → строка API.
String sampleStatusToApi(SampleStatus status) {
  switch (status) {
    case SampleStatus.inStorage:
      return 'IN_STORAGE';
    case SampleStatus.inTransit:
      return 'IN_TRANSIT';

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
    this.pendingSync = false,
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

  /// c-9-fill-offline-2c-3: серверная проба с офлайн-правками
  /// (status / dispose / restore), ещё не ушедшими на сервер.
  final bool pendingSync;

  String get statusLabel =>
      sampleStatusLabels[status] ?? sampleStatusLabels[SampleStatus.unknown]!;

  /// Офлайн-проба (создана локально, `id < 0`).
  bool get isOfflinePending => id < 0;

  /// В UI показывать `cloud_off`: либо локальная проба, либо серверная
  /// с несинхронизированными правками.
  bool get needsSync => isOfflinePending || pendingSync;

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
      pendingSync: json['_pending_sync'] as bool? ?? false,
    );
  }

  @override
  String toString() =>
      'Sample(id: $id, number: $sampleNumber, status: $status, '
      'pendingSync: $pendingSync)';
}
