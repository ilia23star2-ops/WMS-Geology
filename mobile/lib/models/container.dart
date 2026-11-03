/// Модель тары.
///
/// Ответ backend `GET /storage/containers/{id}/` — ContainerSerializer.
///
/// c-9-fill-offline-2b: `pendingSync` — есть несинхронизированные локальные
/// изменения (офлайн-филл / офлайн-размещение). В реестре и шапке
/// показывается иконка `cloud_off`. Сбрасывается при `Pull` (`saveAll`).
///
/// c-2d-2a-fix-3: `fromJson` устойчив к локальному формату
/// (`container_type_id` / `draft_site_id` / `draft_research_type_id`).
library;

enum ContainerStatus {
  pendingFilling,
  pendingPlacement,
  active,
  inTransit,
  issued,
  unknown,
}

const Map<ContainerStatus, String> containerStatusLabels = {
  ContainerStatus.pendingFilling: 'Ожидает заполнения',
  ContainerStatus.pendingPlacement: 'Ожидает размещения',
  ContainerStatus.active: 'Размещена',
  ContainerStatus.inTransit: 'В пути',
  ContainerStatus.issued: 'Выдана',
  ContainerStatus.unknown: 'Неизвестно',
};

ContainerStatus _parseStatus(String? raw) {
  switch (raw) {
    case 'PENDING_FILLING':
      return ContainerStatus.pendingFilling;
    case 'PENDING_PLACEMENT':
      return ContainerStatus.pendingPlacement;
    case 'ACTIVE':
      return ContainerStatus.active;
    case 'IN_TRANSIT':
      return ContainerStatus.inTransit;
    case 'ISSUED':
      return ContainerStatus.issued;
    default:
      return ContainerStatus.unknown;
  }
}

class Container {
  const Container({
    required this.id,
    required this.containerNumber,
    required this.containerType,
    required this.containerTypeName,
    required this.qrCode,
    required this.pallet,
    required this.cellId,
    required this.cellFullAddress,
    required this.floorRoom,
    required this.floorRoomName,
    required this.positionOnPallet,
    required this.status,
    required this.comment,
    required this.commentTemplateText,
    required this.draftSiteId,
    required this.draftSiteName,
    required this.draftResearchTypeId,
    required this.draftResearchTypeName,
    required this.draftWorkOrderCoded,
    required this.draftWorkOrderIncoming,
    required this.printBatchStatus,
    required this.labelPrintedAt,
    required this.createdAt,
    required this.updatedAt,
    this.pendingSync = false,
  });

  final int id;
  final String? containerNumber;
  final int containerType;
  final String? containerTypeName;
  final String? qrCode;
  final int? pallet;
  final int? cellId;
  final String? cellFullAddress;
  final int? floorRoom;
  final String? floorRoomName;
  final int? positionOnPallet;
  final ContainerStatus status;
  final String comment;
  final String? commentTemplateText;
  final int? draftSiteId;
  final String? draftSiteName;
  final int? draftResearchTypeId;
  final String? draftResearchTypeName;
  final String draftWorkOrderCoded;
  final String draftWorkOrderIncoming;
  final String? printBatchStatus;
  final DateTime? labelPrintedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// c-9-fill-offline-2b: есть несинхронизированные локальные изменения.
  final bool pendingSync;

  String get displayName =>
      (containerNumber != null && containerNumber!.isNotEmpty)
      ? containerNumber!
      : 'Черновик #$id';

  String get statusLabel =>
      containerStatusLabels[status] ??
      containerStatusLabels[ContainerStatus.unknown]!;

  String get locationLabel {
    if (cellFullAddress != null && cellFullAddress!.isNotEmpty) {
      return cellFullAddress!;
    }
    if (floorRoomName != null && floorRoomName!.isNotEmpty) {
      return 'На полу: $floorRoomName';
    }
    return 'Место не указано';
  }

  bool get isInPrintBatch => printBatchStatus != null;

  factory Container.fromJson(Map<String, dynamic> json) {
    // c-2d-2a-fix-3: fallback на *_id для локальных записей.
    // cast через `as int?` + `?? 0` — не падаем, если поля нет.
    final typeId = (json['container_type'] ?? json['container_type_id']);
    final draftSite = (json['draft_site'] ?? json['draft_site_id']);
    final draftRt =
        (json['draft_research_type'] ?? json['draft_research_type_id']);

    return Container(
      id: json['id'] as int,
      containerNumber: json['container_number'] as String?,
      containerType: (typeId as int?) ?? 0,
      containerTypeName: json['container_type_name'] as String?,
      qrCode: json['qr_code'] as String?,
      pallet: json['pallet'] as int?,
      cellId: json['cell_id'] as int?,
      cellFullAddress: json['cell_full_address'] as String?,
      floorRoom: json['floor_room'] as int?,
      floorRoomName: json['floor_room_name'] as String?,
      positionOnPallet: json['position_on_pallet'] as int?,
      status: _parseStatus(json['status'] as String?),
      comment: json['comment'] as String? ?? '',
      commentTemplateText: json['comment_template_text'] as String?,
      draftSiteId: draftSite as int?,
      draftSiteName: json['draft_site_name'] as String?,
      draftResearchTypeId: draftRt as int?,
      draftResearchTypeName: json['draft_research_type_name'] as String?,
      draftWorkOrderCoded: json['draft_work_order_coded'] as String? ?? '',
      draftWorkOrderIncoming:
          json['draft_work_order_incoming'] as String? ?? '',
      printBatchStatus: json['print_batch_status'] as String?,
      labelPrintedAt: json['label_printed_at'] != null
          ? DateTime.tryParse(json['label_printed_at'] as String)
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'] as String)
          : null,
      pendingSync: json['_pending_sync'] as bool? ?? false,
    );
  }

  @override
  String toString() =>
      'Container(id: $id, number: $containerNumber, status: $status, '
      'pendingSync: $pendingSync)';
}
