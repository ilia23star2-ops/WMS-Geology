/// Модель пользователя.
///
/// Ответ backend `GET /api/v1/auth/me/`:
/// `{id, username, email, full_name, role}`.
library;

class User {
  const User({
    required this.id,
    required this.username,
    required this.email,
    required this.fullName,
    required this.role,
  });

  final int id;
  final String username;
  final String email;
  final String fullName;
  final String? role;

  /// Разбор JSON из ответа backend.
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      username: json['username'] as String,
      email: json['email'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      role: json['role'] as String?,
    );
  }

  /// Отображаемое имя: `full_name`, если не пусто, иначе `username`.
  String get displayName {
    if (fullName.trim().isNotEmpty) return fullName;
    return username;
  }

  @override
  String toString() =>
      'User(id: $id, username: $username, role: $role)';
}