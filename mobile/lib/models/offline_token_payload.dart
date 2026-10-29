/// Модель данных, зашитых в QR-код для офлайн-входа.
library;

class OfflineUserInfo {
  const OfflineUserInfo({
    required this.id,
    required this.username,
    required this.fullName,
    required this.role,
  });

  final int id;
  final String username;
  final String fullName;
  final String? role;

  factory OfflineUserInfo.fromJson(Map<String, dynamic> json) {
    return OfflineUserInfo(
      id: json['id'] as int,
      username: json['username'] as String,
      fullName: json['full_name'] as String? ?? '',
      role: json['role'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'full_name': fullName,
        'role': role,
      };
}

class OfflineTokenPayload {
  const OfflineTokenPayload({
    required this.token,
    required this.purpose,
    required this.expiresAt,
    this.user,
  });

  final String token;
  final String purpose;
  final DateTime expiresAt;

  /// Данные пользователя из QR (могут отсутствовать для старых токенов,
  /// созданных до 3.x-offline-auth-fix-role).
  final OfflineUserInfo? user;

  factory OfflineTokenPayload.fromJson(Map<String, dynamic> json) {
    OfflineUserInfo? userInfo;
    if (json['user'] is Map<String, dynamic>) {
      userInfo = OfflineUserInfo.fromJson(
        json['user'] as Map<String, dynamic>,
      );
    }
    return OfflineTokenPayload(
      token: json['token'] as String,
      purpose: json['purpose'] as String? ?? 'offline',
      expiresAt: DateTime.parse(json['expires_at'] as String),
      user: userInfo,
    );
  }

  Map<String, dynamic> toJson() => {
        'token': token,
        'purpose': purpose,
        'expires_at': expiresAt.toIso8601String(),
        if (user != null) 'user': user!.toJson(),
      };
}