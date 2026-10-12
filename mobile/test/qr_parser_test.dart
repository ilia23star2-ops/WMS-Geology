// Тесты парсера QR-payload'ов.
//
// Чистая логика (string → QrParseResult). ContainerService — I/O,
// юнит-тестами не покрываем (RULES.md §12.3).

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/qr_parser.dart';

void main() {
  group('parseQrPayload — валидные', () {
    test('CONTAINER', () {
      final r = parseQrPayload('WMSG:CONTAINER:94');
      expect(r.isValid, isTrue);
      expect(r.type, QrEntityType.container);
      expect(r.id, 94);
    });

    test('CELL', () {
      final r = parseQrPayload('WMSG:CELL:5');
      expect(r.type, QrEntityType.cell);
      expect(r.id, 5);
    });

    test('SECTION', () {
      final r = parseQrPayload('WMSG:SECTION:2');
      expect(r.type, QrEntityType.section);
      expect(r.id, 2);
    });

    test('SAMPLE', () {
      final r = parseQrPayload('WMSG:SAMPLE:12345');
      expect(r.type, QrEntityType.sample);
      expect(r.id, 12345);
    });

    test('обрезка пробелов', () {
      final r = parseQrPayload('  WMSG:CONTAINER:1  ');
      expect(r.isValid, isTrue);
      expect(r.id, 1);
    });

    test('нижний регистр типа', () {
      final r = parseQrPayload('WMSG:container:7');
      expect(r.type, QrEntityType.container);
      expect(r.id, 7);
    });
  });

  group('parseQrPayload — ошибки', () {
    test('пустая строка', () {
      final r = parseQrPayload('');
      expect(r.isValid, isFalse);
      expect(r.error, contains('Пустой'));
    });

    test('неверный префикс', () {
      final r = parseQrPayload('OTHER:CONTAINER:1');
      expect(r.isValid, isFalse);
      expect(r.error, contains('WMSG'));
    });

    test('мало частей', () {
      final r = parseQrPayload('WMSG:CONTAINER');
      expect(r.isValid, isFalse);
      expect(r.error, contains('формат'));
    });

    test('много частей', () {
      final r = parseQrPayload('WMSG:CONTAINER:1:extra');
      expect(r.isValid, isFalse);
    });

    test('неизвестный тип', () {
      final r = parseQrPayload('WMSG:UNKNOWN:1');
      expect(r.isValid, isFalse);
      expect(r.error, contains('тип'));
    });

    test('ID не число', () {
      final r = parseQrPayload('WMSG:CONTAINER:abc');
      expect(r.isValid, isFalse);
      expect(r.error, contains('ID'));
    });

    test('ID ноль', () {
      final r = parseQrPayload('WMSG:CONTAINER:0');
      expect(r.isValid, isFalse);
    });

    test('ID отрицательный', () {
      final r = parseQrPayload('WMSG:CONTAINER:-5');
      expect(r.isValid, isFalse);
    });
  });
}