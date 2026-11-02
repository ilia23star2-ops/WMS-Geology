/// Модель тары.
///
/// Ответ backend `GET /storage/containers/{id}/` — ContainerSerializer.
/// С `c-6a` бэкенд отдаёт денормализованные поля (`container_type_name`,
/// `floor_room_name`, `cell_full_address`, `draft_*_name`) — UI показывает
/// строки, а не ID.
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
    required this.draftSiteName,
    required this.draftResearchTypeName,
    required this.draftWorkOrderCoded,
    required this.draftWorkOrderIncoming,
    required this.printBatchStatus,
    required this.labelPrintedAt,
    required this.createdAt,
    required this.updatedAt,
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
  final String? draftSiteName;
  final String? draftResearchTypeName;
  final String draftWorkOrderCoded;
  final String draftWorkOrderIncoming;
  final String? printBatchStatus;
  final DateTime? labelPrintedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Отображаемое имя тары: номер или «Черновик #ID».
  String get displayName =>
      (containerNumber != null && containerNumber!.isNotEmpty)
      ? containerNumber!
      : 'Черновик #$id';

  /// Отображаемая метка статуса.
  String get statusLabel =>
      containerStatusLabels[status] ??
      containerStatusLabels[ContainerStatus.unknown]!;

  /// Локация одной строкой: адрес ячейки, иначе пол, иначе «не указано».
  String get locationLabel {
    if (cellFullAddress != null && cellFullAddress!.isNotEmpty) {
      return cellFullAddress!;
    }
    if (floorRoomName != null && floorRoomName!.isNotEmpty) {
      return 'На полу: $floorRoomName';
    }
    return 'Место не указано';
  }

  /// Строка «ожидает печати» для иконки печати в web — здесь просто флаг.
  bool get isInPrintBatch => printBatchStatus != null;

  factory Container.fromJson(Map<String, dynamic> json) {
    return Container(
      id: json['id'] as int,
      containerNumber: json['container_number'] as String?,
      containerType: json['container_type'] as int,
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
      draftSiteName: json['draft_site_name'] as String?,
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
    );
  }

  @override
  String toString() =>
      'Container(id: $id, number: $containerNumber, status: $status)';
}
