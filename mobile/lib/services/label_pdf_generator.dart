/// Офлайн-рендер PDF-этикетки тары на Dart (c-7f-2).
///
/// Порт `backend/apps/labels/services/label_service.py` 1:1 по раскладке
/// и содержимому. Цель — при офлайне PDF выглядел так же, как серверный.
///
/// **Реализация через виджеты `pdf`** (`pw.Text`, `pw.Positioned`,
/// `pw.Stack`, `pw.BarcodeWidget`), а не через низкоуровневый
/// `PdfGraphics` — стабильнее между версиями `pdf` 3.10+.
///
/// **Галочка SELECTED** — рисуется двумя линиями через `pw.CustomPaint`
/// (как на сервере: `pdf.line` × 2), а не текстом — шрифтовой `✓`
/// в DejaVuSans слишком тонкий и похож на крестик.
///
/// **Что упрощено относительно Python-оригинала:**
/// - нет пунктирного периметра резки (сплошная серая рамка);
/// - нет `render_batch_labels_pdf` / `render_batch_qr_pdf` (это `c-7h`,
///   только одиночная этикетка);
/// - измерение ширины текста — приближённое (средняя ширина символа
///   0.55 em), точное `PdfFont.stringMetrics` в `pdf 3.13` из `pw.Font`
///   недоступно без `document`-контекста.
///
/// **Синхронизация с сервером:** константы (`_widthsMm`, `_heightsMm`,
/// `_qrSizeMm`, `_headerHMm`, `_fontSizePt`, `_maxContinuations` и т.д.)
/// **обязаны совпадать** с `label_service.py`. При изменении серверного
/// рендера — обновить и здесь. Техдолг ТД-56.
library;

import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/label_data.dart';

// ----------------------------------------------------------
// Константы (мм) — 1:1 с label_service.py
// ----------------------------------------------------------
const _widthsMm = [110.0, 130.0, 150.0, 180.0, 210.0];
const _heightsMm = [37.0, 49.0, 74.0, 99.0, 148.0];

const _qrSizeMm = 25.0;
const _headerHMm = 28.0;
const _labelMarginMm = 1.0;
const _labelBottomPadMm = 1.0;
const _colHeaderHMm = 5.0;
const _rowHMm = 5.0;
const _pnpWMm = 12.0;
const _colPaddingMm = 3.0;
const _checkboxSizeMm = 2.2;

const _fontSizePt = 10.0;

const _maxContinuations = 3;

/// 1 мм в points (как `PdfPageFormat.mm`).
const _mmPt = PdfPageFormat.mm;

// ----------------------------------------------------------
// DTO страницы
// ----------------------------------------------------------
class LabelPage {
  const LabelPage({
    required this.containerNumber,
    required this.siteName,
    required this.workOrderLabel,
    required this.workOrderDisplay,
    required this.researchTypeLabel,
    required this.samples,
    required this.pageNum,
    required this.totalPages,
    required this.width,
    required this.height,
    required this.totalSamples,
    required this.truncated,
  });

  final String containerNumber;
  final String siteName;
  final String workOrderLabel;
  final String workOrderDisplay;
  final String researchTypeLabel;
  final List<LabelSample> samples;
  final int pageNum;
  final int totalPages;
  final double width;
  final double height;
  final int totalSamples;
  final bool truncated;

  bool get isContinuation => pageNum > 1;
}

// ----------------------------------------------------------
// Публичный API
// ----------------------------------------------------------
class LabelPdfGenerator {
  LabelPdfGenerator._();

  static Future<Uint8List> render(
    LabelData data, {
    Uint8List? fontBytes,
  }) async {
    final bytes = fontBytes ?? await _loadFontBytes();
    final font = pw.Font.ttf(ByteData.view(bytes.buffer));
    final pages = paginate(font, data);

    final doc = pw.Document();
    for (final page in pages) {
      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat(page.width * _mmPt, page.height * _mmPt),
          margin: pw.EdgeInsets.zero,
          build: (ctx) => _buildLabelPage(page, font),
        ),
      );
    }
    return doc.save();
  }

  static List<LabelPage> paginate(pw.Font font, LabelData data) {
    return _paginate(font, data);
  }

  static Future<Uint8List> _loadFontBytes() async {
    final data = await rootBundle.load('assets/fonts/DejaVuSans.ttf');
    return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
  }
}

// ----------------------------------------------------------
// Измерение ширины текста (приближение)
// ----------------------------------------------------------
double _textWidthMm(String text, pw.Font font) {
  if (text.isEmpty) return 0.0;
  const avgFactor = 0.55;
  final emMm = _fontSizePt * 25.4 / 72;
  return text.length * avgFactor * emMm;
}

// ----------------------------------------------------------
// Пагинация
// ----------------------------------------------------------
List<LabelPage> _paginate(pw.Font font, LabelData data) {
  final total = data.samples.length;
  if (total == 0) {
    return [
      LabelPage(
        containerNumber: data.containerNumber,
        siteName: data.siteName,
        workOrderLabel: data.workOrderLabel,
        workOrderDisplay: data.workOrderDisplay,
        researchTypeLabel: data.researchTypeLabel,
        samples: const [],
        pageNum: 1,
        totalPages: 1,
        width: _widthsMm.first,
        height: _heightsMm.first,
        totalSamples: 0,
        truncated: false,
      ),
    ];
  }

  final size = _chooseSize(data.samples);
  final w = size.w;
  final h = size.h;
  final cols = _columnsCount(data.samples, w);
  final rows = _rowsCount(h);
  final perPage = math.max(1, cols * rows);

  var totalPages = math.max(1, (total / perPage).ceil());
  if (totalPages > _maxContinuations + 1) {
    totalPages = _maxContinuations + 1;
  }

  final pages = <LabelPage>[];
  var shown = 0;
  for (var i = 0; i < totalPages; i++) {
    final end = math.min(shown + perPage, total);
    final chunk = data.samples.sublist(shown, end);
    shown = end;
    pages.add(
      LabelPage(
        containerNumber: data.containerNumber,
        siteName: data.siteName,
        workOrderLabel: data.workOrderLabel,
        workOrderDisplay: data.workOrderDisplay,
        researchTypeLabel: data.researchTypeLabel,
        samples: chunk,
        pageNum: i + 1,
        totalPages: totalPages,
        width: w,
        height: h,
        totalSamples: total,
        truncated: (i == totalPages - 1) && (shown < total),
      ),
    );
  }
  return pages;
}

// ----------------------------------------------------------
// Размер / ёмкость
// ----------------------------------------------------------
({double w, double h}) _chooseSize(List<LabelSample> samples) {
  final n = samples.length;
  if (n == 0) return (w: _widthsMm.first, h: _heightsMm.first);
  for (final h in _heightsMm) {
    for (final w in _widthsMm) {
      if (_totalCapacity(samples, w, h) >= n) {
        return (w: w, h: h);
      }
    }
  }
  return (w: _widthsMm.last, h: _heightsMm.last);
}

int _totalCapacity(List<LabelSample> samples, double w, double h) {
  return _columnsCount(samples, w) * _rowsCount(h);
}

int _rowsCount(double labelH) {
  final workH = (labelH - _headerHMm - _labelBottomPadMm) - _colHeaderHMm;
  if (workH < _rowHMm) return 0;
  return (workH / _rowHMm).floor();
}

int _columnsCount(List<LabelSample> samples, double labelW) {
  final workW = labelW - 2 * _labelMarginMm;
  final colW = _columnWidth(samples);
  if (colW <= 0) return 1;
  return math.max(1, (workW / colW).floor());
}

double _columnWidth(List<LabelSample> samples) {
  var maxNumW = 0.0;
  for (final s in samples) {
    final w = _textWidthMm(s.sampleNumber, pw.Font.helvetica());
    if (w > maxNumW) maxNumW = w;
  }
  return _pnpWMm + _checkboxSizeMm + 1 + maxNumW + _colPaddingMm;
}

// ----------------------------------------------------------
// Рендер
// ----------------------------------------------------------
pw.Widget _buildLabelPage(LabelPage page, pw.Font font) {
  final pageWidthPt = page.width * _mmPt;
  final pageHeightPt = page.height * _mmPt;

  return pw.SizedBox(
    width: pageWidthPt,
    height: pageHeightPt,
    child: pw.Stack(
      children: [
        pw.Positioned(
          left: 0,
          top: 0,
          child: pw.Container(
            width: pageWidthPt,
            height: pageHeightPt,
            decoration: pw.BoxDecoration(
              border: pw.Border.all(
                color: const PdfColor.fromInt(0x969696),
                width: 0.5,
              ),
            ),
          ),
        ),
        if (page.isContinuation)
          _buildContinuationNote(page, font)
        else ...[
          _buildHeader(page, font),
          _buildHeaderDivider(page, font),
        ],
        _buildWorkingArea(page, font),
        if (page.truncated) _buildTruncatedNote(page, font),
      ],
    ),
  );
}

pw.Widget _buildHeader(LabelPage page, pw.Font font) {
  final marginPt = _labelMarginMm * _mmPt;
  final qrPt = _qrSizeMm * _mmPt;
  final headerHPt = _headerHMm * _mmPt;

  final rows = <({String label, String value})>[
    (label: 'Уч:', value: page.siteName.isEmpty ? '—' : page.siteName),
    (label: page.workOrderLabel, value: page.workOrderDisplay),
    (
      label: 'Исл:',
      value: page.researchTypeLabel.isEmpty ? '—' : page.researchTypeLabel,
    ),
    (
      label: '№:',
      value: page.containerNumber.isEmpty ? '—' : page.containerNumber,
    ),
  ];

  return pw.Positioned(
    left: 0,
    top: 0,
    child: pw.Container(
      width: page.width * _mmPt,
      height: headerHPt,
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Expanded(
            child: pw.Padding(
              padding: pw.EdgeInsets.fromLTRB(
                marginPt,
                marginPt,
                2 * _mmPt,
                marginPt,
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                mainAxisAlignment: pw.MainAxisAlignment.start,
                children: [
                  for (final r in rows)
                    pw.Container(
                      height: 5 * _mmPt,
                      child: pw.Row(
                        children: [
                          pw.SizedBox(
                            width:
                                _textWidthMm('Н/З (вх.):', font) * _mmPt +
                                2 * _mmPt,
                            child: pw.Text(
                              r.label,
                              style: pw.TextStyle(
                                font: font,
                                fontSize: _fontSizePt,
                                color: const PdfColor.fromInt(0x787878),
                              ),
                            ),
                          ),
                          pw.Expanded(
                            child: pw.Text(
                              r.value,
                              maxLines: 1,
                              overflow: pw.TextOverflow.clip,
                              style: pw.TextStyle(
                                font: font,
                                fontSize: _fontSizePt,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          pw.Padding(
            padding: pw.EdgeInsets.only(right: marginPt, top: marginPt),
            child: pw.SizedBox(
              width: qrPt,
              height: qrPt,
              child: pw.BarcodeWidget(
                barcode: pw.Barcode.qrCode(),
                data: 'WMSG:CONTAINER:${page.containerNumber}',
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

pw.Widget _buildHeaderDivider(LabelPage page, pw.Font font) {
  final y = _headerHMm * _mmPt - _mmPt;
  return pw.Positioned(
    left: _labelMarginMm * _mmPt,
    top: y,
    child: pw.Container(
      width: page.width * _mmPt - 2 * _labelMarginMm * _mmPt,
      height: 0.5,
      color: const PdfColor.fromInt(0x000000),
    ),
  );
}

pw.Widget _buildContinuationNote(LabelPage page, pw.Font font) {
  return pw.Positioned(
    left: _labelMarginMm * _mmPt,
    top: _labelMarginMm * _mmPt,
    child: pw.Text(
      'Тара ${page.containerNumber} — продолжение '
      '${page.pageNum - 1}/${page.totalPages - 1}',
      style: pw.TextStyle(font: font, fontSize: _fontSizePt),
    ),
  );
}

pw.Widget _buildTruncatedNote(LabelPage page, pw.Font font) {
  final hPt = page.height * _mmPt;
  final shown = math.min(page.totalSamples, page.samples.length * page.pageNum);
  return pw.Positioned(
    left: _labelMarginMm * _mmPt,
    top: hPt - 3 * _mmPt,
    child: pw.Text(
      'Показано $shown из ${page.totalSamples}. Полный список — в системе.',
      style: pw.TextStyle(
        font: font,
        fontSize: 7,
        color: const PdfColor.fromInt(0x787878),
      ),
    ),
  );
}

pw.Widget _buildWorkingArea(LabelPage page, pw.Font font) {
  final samples = page.samples;
  final wPt = page.width * _mmPt;
  final hPt = page.height * _mmPt;
  final topPt = page.isContinuation ? 8 * _mmPt : _headerHMm * _mmPt;
  final workHPt = page.isContinuation
      ? hPt - 8 * _mmPt - _labelBottomPadMm * _mmPt
      : hPt - _headerHMm * _mmPt - _labelBottomPadMm * _mmPt;
  final workWPt = wPt - 2 * _labelMarginMm * _mmPt;

  if (samples.isEmpty) {
    return pw.Positioned(
      left: _labelMarginMm * _mmPt,
      top: topPt,
      child: pw.SizedBox(width: workWPt, height: workHPt),
    );
  }

  var maxNumW = 0.0;
  for (final s in samples) {
    final sw = _textWidthMm(s.sampleNumber, font);
    if (sw > maxNumW) maxNumW = sw;
  }
  final colWMinMm = _pnpWMm + _checkboxSizeMm + 1 + maxNumW + _colPaddingMm;
  final cols = math.max(1, ((workWPt / _mmPt) / colWMinMm).floor());
  final perCol = (samples.length / cols).ceil();

  final columns = <List<LabelSample>>[];
  for (var i = 0; i < cols; i++) {
    final start = i * perCol;
    final end = math.min(start + perCol, samples.length);
    if (start >= end) break;
    columns.add(samples.sublist(start, end));
  }

  final colWPt = workWPt / columns.length;

  return pw.Positioned(
    left: _labelMarginMm * _mmPt,
    top: topPt,
    child: pw.Container(
      width: workWPt,
      height: workHPt,
      decoration: pw.BoxDecoration(
        border: pw.Border.all(
          color: const PdfColor.fromInt(0x000000),
          width: 0.2,
        ),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          for (var ci = 0; ci < columns.length; ci++)
            pw.Container(
              width: colWPt,
              decoration: ci > 0
                  ? pw.BoxDecoration(
                      border: pw.Border(
                        left: pw.BorderSide(
                          color: const PdfColor.fromInt(0x000000),
                          width: 0.2,
                        ),
                      ),
                    )
                  : null,
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Container(
                    height: _colHeaderHMm * _mmPt,
                    decoration: pw.BoxDecoration(
                      border: pw.Border(
                        bottom: pw.BorderSide(
                          color: const PdfColor.fromInt(0x000000),
                          width: 0.2,
                        ),
                      ),
                    ),
                    child: pw.Row(
                      children: [
                        pw.SizedBox(
                          width: _pnpWMm * _mmPt,
                          child: pw.Padding(
                            padding: pw.EdgeInsets.only(
                              left: 1 * _mmPt,
                              top: 1 * _mmPt,
                            ),
                            child: pw.Text(
                              'п/п',
                              style: pw.TextStyle(
                                font: font,
                                fontSize: _fontSizePt,
                              ),
                            ),
                          ),
                        ),
                        pw.Expanded(
                          child: pw.Padding(
                            padding: pw.EdgeInsets.only(
                              left: 1 * _mmPt,
                              top: 1 * _mmPt,
                            ),
                            child: pw.Text(
                              'Образец',
                              style: pw.TextStyle(
                                font: font,
                                fontSize: _fontSizePt,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  for (var i = 0; i < columns[ci].length; i++)
                    _buildSampleRow(columns[ci][i], ci * perCol + i + 1, font),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}

/// Строка пробы: `п/п | [чекбокс] | номер`.
///
/// c-7f-2-fix: галочка `SELECTED` рисуется **двумя линиями** через
/// `pw.CustomPaint` — как на сервере (`pdf.line` × 2). Шрифтовой
/// `✓` в DejaVuSans слишком тонкий и похож на крестик.
pw.Widget _buildSampleRow(LabelSample s, int num, pw.Font font) {
  return pw.Container(
    height: _rowHMm * _mmPt,
    child: pw.Row(
      children: [
        pw.SizedBox(
          width: _pnpWMm * _mmPt,
          child: pw.Padding(
            padding: pw.EdgeInsets.only(left: 1 * _mmPt),
            child: pw.Text(
              '$num.',
              style: pw.TextStyle(font: font, fontSize: _fontSizePt),
            ),
          ),
        ),
        pw.SizedBox(
          width: _checkboxSizeMm * _mmPt,
          height: _checkboxSizeMm * _mmPt,
          child: pw.Container(
            decoration: pw.BoxDecoration(
              border: pw.Border.all(
                color: const PdfColor.fromInt(0x000000),
                width: 0.2,
              ),
            ),
            child: s.selected
                ? pw.CustomPaint(
                    size: PdfPoint(
                      _checkboxSizeMm * _mmPt,
                      _checkboxSizeMm * _mmPt,
                    ),
                    painter: (canvas, size) {
                      // Галочка — две линии, как в `label_service.py`.
                      // Толщина 0.4 (в оригинале `set_line_width(0.4)`).
                      //
                      // ВАЖНО: в PDF ось Y направлена ВВЕРХ (в отличие
                      // от Flutter, где вниз). Поэтому короткий сегмент
                      // галочки идёт вниз-влево от вершины, длинный —
                      // вверх-вправо.
                      final w = size.x;
                      final h = size.y;
                      final vertexX = w * 0.4;
                      final vertexY = h * 0.2;
                      canvas
                        ..setStrokeColor(const PdfColor.fromInt(0x000000))
                        ..setLineWidth(0.4)
                        ..moveTo(w * 0.1, h * 0.5)
                        ..lineTo(vertexX, vertexY)
                        ..lineTo(w - w * 0.1, h * 0.9)
                        ..strokePath();
                    },
                  )
                : null,
          ),
        ),
        pw.SizedBox(width: 1 * _mmPt),
        pw.Expanded(
          child: pw.Text(
            s.sampleNumber,
            maxLines: 1,
            overflow: pw.TextOverflow.clip,
            style: pw.TextStyle(font: font, fontSize: _fontSizePt),
          ),
        ),
      ],
    ),
  );
}
