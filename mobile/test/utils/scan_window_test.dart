/// Тесты `scan_window` (c-6d, c-6d-fix).
///
/// `calculateScanWindow` — центрирование окна.
/// `barcodeCenterFromCorners` — центр штрихкода по углам.
/// `isPointInsideScanWindow` — проверка попадания точки
/// (в системе изображения) в scanWindow (система виджета)
/// с учётом `BoxFit.cover`.
library;

import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/scan_window.dart';

void main() {
  group('calculateScanWindow', () {
    test('центрирует окно на квадратном экране', () {
      final r = calculateScanWindow(const Size(400, 400), 220);
      expect(r.left, 90);
      expect(r.top, 90);
      expect(r.width, 220);
      expect(r.height, 220);
    });

    test('центрирует окно на прямоугольном экране (ландшафт)', () {
      final r = calculateScanWindow(const Size(2000, 1200), 220);
      expect(r.left, (2000 - 220) / 2);
      expect(r.top, (1200 - 220) / 2);
      expect(r.width, 220);
      expect(r.height, 220);
    });

    test('окно 220×220 ровно по центру', () {
      final r = calculateScanWindow(const Size(500, 700), 220);
      expect(r.center, const Offset(250, 350));
    });

    test('окно выходит за границы, если экран меньше 220', () {
      final r = calculateScanWindow(const Size(100, 100), 220);
      expect(r.width, 220);
      expect(r.height, 220);
      expect(r.left, -60);
      expect(r.top, -60);
    });
  });

  group('barcodeCenterFromCorners', () {
    test('одна точка', () {
      expect(
        barcodeCenterFromCorners([const Offset(10, 20)]),
        const Offset(10, 20),
      );
    });

    test('среднее от 4 углов', () {
      final corners = [
        const Offset(0, 0),
        const Offset(10, 0),
        const Offset(10, 10),
        const Offset(0, 10),
      ];
      expect(barcodeCenterFromCorners(corners), const Offset(5, 5));
    });

    test('пустой список → Offset.zero', () {
      expect(barcodeCenterFromCorners([]), Offset.zero);
    });
  });

  group('isPointInsideScanWindow', () {
    const widget = Size(400, 400);
    final scanWindow = calculateScanWindow(widget, 220);

    test('центр изображения → центр виджета → inside', () {
      // Изображение 1000×800 → после BoxFit.cover центр совпадает
      // с центром виджета.
      expect(
        isPointInsideScanWindow(
          pointInImage: const Offset(500, 400),
          imageSize: const Size(1000, 800),
          widgetSize: widget,
          scanWindow: scanWindow,
        ),
        isTrue,
      );
    });

    test('угол изображения → снаружи виджета → outside', () {
      expect(
        isPointInsideScanWindow(
          pointInImage: const Offset(0, 0),
          imageSize: const Size(1000, 800),
          widgetSize: widget,
          scanWindow: scanWindow,
        ),
        isFalse,
      );
    });

    test('пустое изображение → safety → true', () {
      expect(
        isPointInsideScanWindow(
          pointInImage: Offset.zero,
          imageSize: Size.zero,
          widgetSize: widget,
          scanWindow: scanWindow,
        ),
        isTrue,
      );
    });
  });
}
