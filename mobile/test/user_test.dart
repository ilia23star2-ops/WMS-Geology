// Тесты модели User — парсинг JSON.
//
// AuthService и TokenStorage — I/O (Dio, secure storage), юнит-
// тестами не покрываем (RULES.md §12.3). User.fromJson — чистый
// парсер, тестируется.

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/user.dart';

void main() {
  group('User.fromJson', () {
    test('парсит полный ответ backend', () {
      final user = User.fromJson({
        'id': 42,
        'username': 'ivan',
        'email': 'ivan@example.com',
        'full_name': 'Иван Иванов',
        'role': 'manager',
      });

      expect(user.id, 42);
      expect(user.username, 'ivan');
      expect(user.email, 'ivan@example.com');
      expect(user.fullName, 'Иван Иванов');
      expect(user.role, 'manager');
    });

    test('при отсутствии email и full_name — пустые строки', () {
      final user = User.fromJson({
        'id': 1,
        'username': 'user',
      });

      expect(user.email, '');
      expect(user.fullName, '');
      expect(user.role, isNull);
    });

    test('displayName = full_name, если не пусто', () {
      final user = User.fromJson({
        'id': 1,
        'username': 'user',
        'full_name': 'Иван',
        'role': 'manager',
      });

      expect(user.displayName, 'Иван');
    });

    test('displayName = username, если full_name пусто', () {
      final user = User.fromJson({
        'id': 1,
        'username': 'user',
        'full_name': '',
      });

      expect(user.displayName, 'user');
    });
  });
}