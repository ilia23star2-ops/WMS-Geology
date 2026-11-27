import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/cell_label.dart';

void main() {
  group('sectionTierLabel', () {
    test('коды из API — приоритет', () {
      expect(
        sectionTierLabel(sectionCode: 'S1', tierCode: 'A'),
        'Секция S1 · Ярус A',
      );
    });

    test('запасной разбор адреса без пробелов', () {
      expect(
        sectionTierLabel(fullAddress: 'OCR-6f1/R1/S1/A/1'),
        'Секция S1 · Ярус A',
      );
    });

    test('нет данных — прочерки', () {
      expect(sectionTierLabel(), 'Секция — · Ярус —');
    });
  });
}
