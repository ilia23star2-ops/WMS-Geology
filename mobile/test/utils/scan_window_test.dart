/// Тесты `scan_window` (c-6d, c-6d-fix, c-6d-fix-3).
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

  group('mapImageToWidgetFrame', () {
    test('portrait: image и widget portrait — без swap', () {
      // Портрет из лога: center (647.3, 896.5) → mapped ≈ (302.6, 496.3).
      final mapped = mapImageToWidgetFrame(
        pointInImage: const Offset(647.3, 896.5),
        imageSize: const Size(1440, 1920),
        widgetSize: const Size(685.7, 1062.9),
      );
      expect(mapped.dx, closeTo(302.6, 1.0));
      expect(mapped.dy, closeTo(496.3, 1.0));
    });

    test('landscape: image portrait, widget landscape — swap', () {
      // Ландшафт из лога: center (938.5, 681.0) → mapped ≈ (558.7, 279.8).
      final mapped = mapImageToWidgetFrame(
        pointInImage: const Offset(938.5, 681.0),
        imageSize: const Size(1440, 1920),
        widgetSize: const Size(1142.9, 605.7),
      );
      expect(mapped.dx, closeTo(558.7, 1.0));
      expect(mapped.dy, closeTo(279.8, 1.0));
    });

    test('landscape: image landscape, widget landscape — без swap', () {
      final mapped = mapImageToWidgetFrame(
        pointInImage: const Offset(960, 720),
        imageSize: const Size(1920, 1440),
        widgetSize: const Size(1142.9, 605.7),
      );
      // 960 × (1142.9/1920) = 571.5, 720 × (605.7/1440) = 302.9 — по центру
      expect(mapped.dx, closeTo(571.5, 1.0));
      expect(mapped.dy, closeTo(302.9, 1.0));
    });
  });

  group('isPointInsideScanWindow', () {
    test('portrait: центр → inside', () {
      final scanWindow = calculateScanWindow(const Size(685.7, 1062.9), 220);
      expect(
        isPointInsideScanWindow(
          pointInImage: const Offset(647.3, 896.5),
          imageSize: const Size(1440, 1920),
          widgetSize: const Size(685.7, 1062.9),
          scanWindow: scanWindow,
        ),
        isTrue,
      );
    });

    test('landscape: центр QR в рамке → inside (главный фикс)', () {
      // Реальные координаты из лога landscape.
      final scanWindow = calculateScanWindow(const Size(1142.9, 605.7), 220);
      expect(
        isPointInsideScanWindow(
          pointInImage: const Offset(938.5, 681.0),
          imageSize: const Size(1440, 1920),
          widgetSize: const Size(1142.9, 605.7),
          scanWindow: scanWindow,
        ),
        isTrue,
      );
    });

    test('landscape: QR вне рамки → outside', () {
      final scanWindow = calculateScanWindow(const Size(1142.9, 605.7), 220);
      // Точка в верхнем-левом углу изображения → в ландшафте mapped далеко от центра.
      expect(
        isPointInsideScanWindow(
          pointInImage: const Offset(100, 100),
          imageSize: const Size(1440, 1920),
          widgetSize: const Size(1142.9, 605.7),
          scanWindow: scanWindow,
        ),
        isFalse,
      );
    });

    test('пустые размеры → safety → true', () {
      expect(
        isPointInsideScanWindow(
          pointInImage: Offset.zero,
          imageSize: Size.zero,
          widgetSize: const Size(400, 400),
          scanWindow: calculateScanWindow(const Size(400, 400), 220),
        ),
        isTrue,
      );
    });
  });
}
