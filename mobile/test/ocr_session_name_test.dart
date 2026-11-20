/// Имя пакета в сессии оцифровки (6e-3-backend-4d).
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:wms_geology_mobile/models/ocr_session.dart';

void main() {
  test('имя пакета обрезается по пробелам', () {
    final session = OcrSession();
    session.setBatchName('  Тара ноябрь  ');
    expect(session.batchName, 'Тара ноябрь');
  });

  test('пустое имя становится null', () {
    final session = OcrSession();
    session.setBatchName('Имя');
    session.setBatchName('   ');
    expect(session.batchName, isNull);
  });

  test('clear сбрасывает имя и ячейки', () {
    final session = OcrSession();
    session.setBatchName('Тара');
    session.addCell(7, 'B4 / 1 / 1 / B / 3');
    session.clear();
    expect(session.batchName, isNull);
    expect(session.cells, isEmpty);
  });
}
