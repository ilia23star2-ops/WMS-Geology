// Смок-тесты UI.
//
// Полноценные UI-тесты в этом заходе не делаем (RULES.md §12.3 —
// UI юнит-тестами не покрывается). Здесь только проверка, что
// экран логина рендерится с ключевыми элементами.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:wms_geology_mobile/providers/auth_provider.dart';
import 'package:wms_geology_mobile/screens/login_screen.dart';

void main() {
  testWidgets('LoginScreen отображает заголовок, поля и кнопку', (
    tester,
  ) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AuthProvider(),
        child: const MaterialApp(home: LoginScreen()),
      ),
    );

    expect(find.text('WMS Geology'), findsOneWidget);
    expect(find.text('Вход в систему'), findsOneWidget);
    expect(find.text('Логин'), findsOneWidget);
    expect(find.text('Пароль'), findsOneWidget);
    expect(find.text('Войти'), findsOneWidget);
  });
}