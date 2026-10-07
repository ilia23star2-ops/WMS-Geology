// Тесты виджетов WMS Geology Mobile.
//
// Базовые smoke-тесты: приложение запускается, показывает название,
// иконку, приветственный текст.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:wms_geology_mobile/main.dart';

void main() {
  group('WmsGeologyApp', () {
    testWidgets('запускается и показывает начальный экран', (tester) async {
      await tester.pumpWidget(const WmsGeologyApp());

      expect(find.byType(MaterialApp), findsOneWidget);
      expect(find.byType(InitialScreen), findsOneWidget);
    });

    testWidgets('показывает заголовок «WMS Geology»', (tester) async {
      await tester.pumpWidget(const WmsGeologyApp());
      await tester.pumpAndSettle();

      // В AppBar и в центре — два вхождения.
      expect(find.text('WMS Geology'), findsNWidgets(2));
    });

    testWidgets('показывает иконку inventory_2_outlined', (tester) async {
      await tester.pumpWidget(const WmsGeologyApp());
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.inventory_2_outlined), findsOneWidget);
    });

    testWidgets('показывает подпись «Мобильный клиент»', (tester) async {
      await tester.pumpWidget(const WmsGeologyApp());
      await tester.pumpAndSettle();

      expect(
        find.text('Мобильный клиент — начальная версия'),
        findsOneWidget,
      );
    });
  });
}