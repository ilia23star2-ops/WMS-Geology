/// Модель записи аудита тары.
///
/// Ответ backend `GET /storage/containers/{id}/history/` —
/// список `AuditLogSerializer` (решение 1.70). Поля:
/// id, username, action, action_display, old_value, new_value, created_at.
library;

class ContainerHistoryEntry {
  const ContainerHistoryEntry({
    required this.id,
    required this.username,
    required this.action,
    required this.actionDisplay,
    required this.oldValue,
    required this.newValue,
    required this.createdAt,
  });

  final int id;
  final String? username;
  final String action; // CREATE / UPDATE / DELETE / ...
  final String actionDisplay; // «Создана», «Заполнена пробами», ...
  final Map<String, dynamic>? oldValue;
  final Map<String, dynamic>? newValue;
  final DateTime? createdAt;

  factory ContainerHistoryEntry.fromJson(Map<String, dynamic> json) {
    return ContainerHistoryEntry(
      id: json['id'] as int,
      username: json['username'] as String?,
      action: json['action'] as String? ?? '',
      actionDisplay: json['action_display'] as String? ?? '',
      oldValue: json['old_value'] is Map<String, dynamic>
          ? json['old_value'] as Map<String, dynamic>
          : null,
      newValue: json['new_value'] is Map<String, dynamic>
          ? json['new_value'] as Map<String, dynamic>
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
    );
  }

  @override
  String toString() =>
      'ContainerHistoryEntry(id: $id, action: $action, at: $createdAt)';
}
