/// Модель тары.
///
/// Ответ backend `GET /storage/containers/{id}/` — ContainerSerializer.
library;

enum ContainerStatus {
  active,
  pendingPlacement,
  inTransit,
  issued,
  unknown,
}

const Map<ContainerStatus, String> containerStatusLabels = {
  ContainerStatus.active: 'Размещена',
  ContainerStatus.pendingPlacement: 'Ожидает размещения',
  ContainerStatus.inTransit: 'В пути',
  ContainerStatus.issued: 'Выдана',
  ContainerStatus.unknown: 'Неизвестно',
};

ContainerStatus _parseStatus(String? raw) {
  switch (raw) {
    case 'ACTIVE':
      return ContainerStatus.active;
    case 'PENDING_PLACEMENT':
      return ContainerStatus.pendingPlacement;
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
    required this.qrCode,
    required this.pallet,
    required this.floorRoom,
    required this.positionOnPallet,
    required this.status,
    required this.comment,
    required this.commentTemplateText,
    required this.createdAt,
  });

  final int id;
  final String containerNumber;
  final int containerType;
  final String? qrCode;
  final int? pallet;
  final int? floorRoom;
  final int? positionOnPallet;
  final ContainerStatus status;
  final String comment;
  final String? commentTemplateText;
  final DateTime? createdAt;

  /// Отображаемая метка статуса.
  String get statusLabel =>
      containerStatusLabels[status] ?? containerStatusLabels[ContainerStatus.unknown]!;

  factory Container.fromJson(Map<String, dynamic> json) {
    return Container(
      id: json['id'] as int,
      containerNumber: json['container_number'] as String,
      containerType: json['container_type'] as int,
      qrCode: json['qr_code'] as String?,
      pallet: json['pallet'] as int?,
      floorRoom: json['floor_room'] as int?,
      positionOnPallet: json['position_on_pallet'] as int?,
      status: _parseStatus(json['status'] as String?),
      comment: json['comment'] as String? ?? '',
      commentTemplateText: json['comment_template_text'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
    );
  }

  @override
  String toString() => 'Container(id: $id, number: $containerNumber, status: $status)';
}