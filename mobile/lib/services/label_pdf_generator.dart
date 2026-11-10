/// Офлайн-рендер PDF-этикетки тары на Dart (c-7f-2, ТД-56).
///
/// Порт `backend/apps/labels/services/label_service.py` 1:1 по раскладке
/// и содержимому.
library;

import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/label_config.dart';
import '../models/label_data.dart';

/// 1 мм в points (как `PdfPageFormat.mm`).
const _mmPt = PdfPageFormat.mm;

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

class LabelPdfGenerator {
  LabelPdfGenerator._();

  static Future<Uint8List> render(
    LabelData data,
    LabelConfig config, {
    Uint8List? fontBytes,
  }) async {
    final bytes = fontBytes ?? await _loadFontBytes();
    final font = pw.Font.ttf(ByteData.view(bytes.buffer));
    final pages = paginate(font, data, config);

    final doc = pw.Document();
    for (final page in pages) {
      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat(page.width * _mmPt, page.height * _mmPt),
          margin: pw.EdgeInsets.zero,
          build: (ctx) => _buildLabelPage(page, font, config),
        ),
      );
    }
    return doc.save();
  }

  static List<LabelPage> paginate(
    pw.Font font,
    LabelData data,
    LabelConfig config,
  ) {
    return _paginate(font, data, config);
  }

  static Future<Uint8List> _loadFontBytes() async {
    final data = await rootBundle.load('assets/fonts/DejaVuSans.ttf');
    return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
  }
}

double _textWidthMm(String text, pw.Font font, LabelConfig config) {
  if (text.isEmpty) return 0.0;
  const avgFactor = 0.55;
  final emMm = config.fontSizePt * 25.4 / 72;
  return text.length * avgFactor * emMm;
}

List<LabelPage> _paginate(pw.Font font, LabelData data, LabelConfig config) {
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
        width: config.widthsMm.first,
        height: config.heightsMm.first,
        totalSamples: 0,
        truncated: false,
      ),
    ];
  }

  final size = _chooseSize(data.samples, config);
  final w = size.w;
  final h = size.h;
  final cols = _columnsCount(data.samples, w, config);
  final rows = _rowsCount(h, config);
  final perPage = math.max(1, cols * rows);

  var totalPages = math.max(1, (total / perPage).ceil());
  if (totalPages > config.maxContinuations + 1) {
    totalPages = config.maxContinuations + 1;
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

({double w, double h}) _chooseSize(
  List<LabelSample> samples,
  LabelConfig config,
) {
  final n = samples.length;
  if (n == 0) return (w: config.widthsMm.first, h: config.heightsMm.first);
  for (final h in config.heightsMm) {
    for (final w in config.widthsMm) {
      if (_totalCapacity(samples, w, h, config) >= n) {
        return (w: w, h: h);
      }
    }
  }
  return (w: config.widthsMm.last, h: config.heightsMm.last);
}

int _totalCapacity(
  List<LabelSample> samples,
  double w,
  double h,
  LabelConfig config,
) {
  return _columnsCount(samples, w, config) * _rowsCount(h, config);
}

int _rowsCount(double labelH, LabelConfig config) {
  final workH =
      (labelH - config.headerHMm - config.labelBottomPadMm) -
      config.colHeaderHMm;
  if (workH < config.rowHMm) return 0;
  return (workH / config.rowHMm).floor();
}

int _columnsCount(
  List<LabelSample> samples,
  double labelW,
  LabelConfig config,
) {
  final workW = labelW - 2 * config.labelMarginMm;
  final colW = _columnWidth(samples, config);
  if (colW <= 0) return 1;
  return math.max(1, (workW / colW).floor());
}

double _columnWidth(List<LabelSample> samples, LabelConfig config) {
  var maxNumW = 0.0;
  for (final s in samples) {
    final w = _textWidthMm(s.sampleNumber, pw.Font.helvetica(), config);
    if (w > maxNumW) maxNumW = w;
  }
  return config.pnpWMm +
      config.checkboxSizeMm +
      1 +
      maxNumW +
      config.colPaddingMm;
}

pw.Widget _buildLabelPage(LabelPage page, pw.Font font, LabelConfig config) {
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
          _buildContinuationNote(page, font, config)
        else ...[
          _buildHeader(page, font, config),
          _buildHeaderDivider(page, font, config),
        ],
        _buildWorkingArea(page, font, config),
        if (page.truncated) _buildTruncatedNote(page, font, config),
      ],
    ),
  );
}

pw.Widget _buildHeader(LabelPage page, pw.Font font, LabelConfig config) {
  final marginPt = config.labelMarginMm * _mmPt;
  final qrPt = config.qrSizeMm * _mmPt;
  final headerHPt = config.headerHMm * _mmPt;

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
                                _textWidthMm('Н/З (вх.):', font, config) *
                                    _mmPt +
                                2 * _mmPt,
                            child: pw.Text(
                              r.label,
                              style: pw.TextStyle(
                                font: font,
                                fontSize: config.fontSizePt,
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
                                fontSize: config.fontSizePt,
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

pw.Widget _buildHeaderDivider(
  LabelPage page,
  pw.Font font,
  LabelConfig config,
) {
  final y = config.headerHMm * _mmPt - _mmPt;
  return pw.Positioned(
    left: config.labelMarginMm * _mmPt,
    top: y,
    child: pw.Container(
      width: page.width * _mmPt - 2 * config.labelMarginMm * _mmPt,
      height: 0.5,
      color: const PdfColor.fromInt(0x000000),
    ),
  );
}

pw.Widget _buildContinuationNote(
  LabelPage page,
  pw.Font font,
  LabelConfig config,
) {
  return pw.Positioned(
    left: config.labelMarginMm * _mmPt,
    top: config.labelMarginMm * _mmPt,
    child: pw.Text(
      'Тара ${page.containerNumber} — продолжение '
      '${page.pageNum - 1}/${page.totalPages - 1}',
      style: pw.TextStyle(font: font, fontSize: config.fontSizePt),
    ),
  );
}

pw.Widget _buildTruncatedNote(
  LabelPage page,
  pw.Font font,
  LabelConfig config,
) {
  final hPt = page.height * _mmPt;
  final shown = math.min(page.totalSamples, page.samples.length * page.pageNum);
  return pw.Positioned(
    left: config.labelMarginMm * _mmPt,
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

pw.Widget _buildWorkingArea(LabelPage page, pw.Font font, LabelConfig config) {
  final samples = page.samples;
  final wPt = page.width * _mmPt;
  final hPt = page.height * _mmPt;
  final topPt = page.isContinuation ? 8 * _mmPt : config.headerHMm * _mmPt;
  final workHPt = page.isContinuation
      ? hPt - 8 * _mmPt - config.labelBottomPadMm * _mmPt
      : hPt - config.headerHMm * _mmPt - config.labelBottomPadMm * _mmPt;
  final workWPt = wPt - 2 * config.labelMarginMm * _mmPt;

  if (samples.isEmpty) {
    return pw.Positioned(
      left: config.labelMarginMm * _mmPt,
      top: topPt,
      child: pw.SizedBox(width: workWPt, height: workHPt),
    );
  }

  var maxNumW = 0.0;
  for (final s in samples) {
    final sw = _textWidthMm(s.sampleNumber, font, config);
    if (sw > maxNumW) maxNumW = sw;
  }
  final colWMinMm =
      config.pnpWMm + config.checkboxSizeMm + 1 + maxNumW + config.colPaddingMm;
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
    left: config.labelMarginMm * _mmPt,
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
                    height: config.colHeaderHMm * _mmPt,
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
                          width: config.pnpWMm * _mmPt,
                          child: pw.Padding(
                            padding: pw.EdgeInsets.only(
                              left: 1 * _mmPt,
                              top: 1 * _mmPt,
                            ),
                            child: pw.Text(
                              'п/п',
                              style: pw.TextStyle(
                                font: font,
                                fontSize: config.fontSizePt,
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
                                fontSize: config.fontSizePt,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  for (var i = 0; i < columns[ci].length; i++)
                    _buildSampleRow(
                      columns[ci][i],
                      ci * perCol + i + 1,
                      font,
                      config,
                    ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}

pw.Widget _buildSampleRow(
  LabelSample s,
  int num,
  pw.Font font,
  LabelConfig config,
) {
  return pw.Container(
    height: config.rowHMm * _mmPt,
    child: pw.Row(
      children: [
        pw.SizedBox(
          width: config.pnpWMm * _mmPt,
          child: pw.Padding(
            padding: pw.EdgeInsets.only(left: 1 * _mmPt),
            child: pw.Text(
              '$num.',
              style: pw.TextStyle(font: font, fontSize: config.fontSizePt),
            ),
          ),
        ),
        pw.SizedBox(
          width: config.checkboxSizeMm * _mmPt,
          height: config.checkboxSizeMm * _mmPt,
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
                      config.checkboxSizeMm * _mmPt,
                      config.checkboxSizeMm * _mmPt,
                    ),
                    painter: (canvas, size) {
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
            style: pw.TextStyle(font: font, fontSize: config.fontSizePt),
          ),
        ),
      ],
    ),
  );
}
