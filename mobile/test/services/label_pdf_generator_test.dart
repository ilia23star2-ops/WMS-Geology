/// Тесты `LabelPdfGenerator.paginate` (c-7f-2).
///
/// Проверяют разбиение `LabelData` на страницы — без рендера PDF
/// (шрифт 1 MB и `rootBundle` в тестах не нужны).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:wms_geology_mobile/models/label_data.dart';
import 'package:wms_geology_mobile/services/label_pdf_generator.dart';

LabelData _data(int n) {
  final samples = List<LabelSample>.generate(
    n,
    (i) => LabelSample(
      sampleNumber: 'TST-${i.toString().padLeft(3, '0')}',
      selected: false,
    ),
  );
  return LabelData(
    containerId: 1,
    containerNumber: 'T-001',
    siteName: 'Тестовый',
    workOrderLabel: 'Н/З:',
    workOrderDisplay: 'TST0001',
    researchTypeLabel: 'Шлифы',
    samples: samples,
  );
}

void main() {
  final font = pw.Font.helvetica();

  test('пустая тара — 1 страница, 0 проб', () {
    final pages = LabelPdfGenerator.paginate(font, _data(0));
    expect(pages.length, 1);
    expect(pages.first.samples, isEmpty);
    expect(pages.first.isContinuation, isFalse);
    expect(pages.first.truncated, isFalse);
  });

  test('1 проба — 1 страница, все пробы на ней', () {
    final pages = LabelPdfGenerator.paginate(font, _data(1));
    expect(pages.length, 1);
    expect(pages.first.samples.length, 1);
  });

  test('150 проб — несколько страниц, лимит maxContinuations+1', () {
    final pages = LabelPdfGenerator.paginate(font, _data(150));
    expect(pages.length, lessThanOrEqualTo(4));
    expect(pages.length, greaterThan(1));
    final last = pages.last;
    final totalShown = pages.fold<int>(0, (s, p) => s + p.samples.length);
    expect(last.truncated, totalShown < 150);
  });

  test('containerNumber и siteName копируются в каждую страницу', () {
    final pages = LabelPdfGenerator.paginate(font, _data(80));
    for (final p in pages) {
      expect(p.containerNumber, 'T-001');
      expect(p.siteName, 'Тестовый');
      expect(p.workOrderDisplay, 'TST0001');
    }
  });
}
