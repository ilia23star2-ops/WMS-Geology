import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/qr_parser.dart';

void main() {
  group('bareCellId', () {
    test('голое число — id ячейки', () {
      expect(bareCellId('4'), 4);
      expect(bareCellId(' 12 '), 12);
    });

    test('не число — null', () {
      expect(bareCellId('WMSG:CELL:4'), isNull);
      expect(bareCellId('abc'), isNull);
      expect(bareCellId('0'), isNull);
    });
  });
}
