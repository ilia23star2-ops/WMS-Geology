/// Модель конфигурации этикетки (ТД-56).
class LabelConfig {
  final List<double> widthsMm;
  final List<double> heightsMm;
  final double qrSizeMm;
  final double headerHMm;
  final double labelMarginMm;
  final double labelBottomPadMm;
  final double colHeaderHMm;
  final double rowHMm;
  final double pnpWMm;
  final double colPaddingMm;
  final double checkboxSizeMm;
  final double fontSizePt;
  final int maxContinuations;

  const LabelConfig({
    required this.widthsMm,
    required this.heightsMm,
    required this.qrSizeMm,
    required this.headerHMm,
    required this.labelMarginMm,
    required this.labelBottomPadMm,
    required this.colHeaderHMm,
    required this.rowHMm,
    required this.pnpWMm,
    required this.colPaddingMm,
    required this.checkboxSizeMm,
    required this.fontSizePt,
    required this.maxContinuations,
  });

  factory LabelConfig.fromJson(Map<String, dynamic> json) {
    return LabelConfig(
      widthsMm: (json['widths_mm'] as List<dynamic>)
          .map((e) => (e as num).toDouble())
          .toList(),
      heightsMm: (json['heights_mm'] as List<dynamic>)
          .map((e) => (e as num).toDouble())
          .toList(),
      qrSizeMm: (json['qr_size_mm'] as num).toDouble(),
      headerHMm: (json['header_h_mm'] as num).toDouble(),
      labelMarginMm: (json['label_margin_mm'] as num).toDouble(),
      labelBottomPadMm: (json['label_bottom_pad_mm'] as num).toDouble(),
      colHeaderHMm: (json['col_header_h_mm'] as num).toDouble(),
      rowHMm: (json['row_h_mm'] as num).toDouble(),
      pnpWMm: (json['pnp_w_mm'] as num).toDouble(),
      colPaddingMm: (json['col_padding_mm'] as num).toDouble(),
      checkboxSizeMm: (json['checkbox_size_mm'] as num).toDouble(),
      fontSizePt: (json['font_size_pt'] as num).toDouble(),
      maxContinuations: json['max_continuations'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'widths_mm': widthsMm,
      'heights_mm': heightsMm,
      'qr_size_mm': qrSizeMm,
      'header_h_mm': headerHMm,
      'label_margin_mm': labelMarginMm,
      'label_bottom_pad_mm': labelBottomPadMm,
      'col_header_h_mm': colHeaderHMm,
      'row_h_mm': rowHMm,
      'pnp_w_mm': pnpWMm,
      'col_padding_mm': colPaddingMm,
      'checkbox_size_mm': checkboxSizeMm,
      'font_size_pt': fontSizePt,
      'max_continuations': maxContinuations,
    };
  }

  /// Дефолтные значения (если офлайн и кэша нет).
  static const LabelConfig defaultConfig = LabelConfig(
    widthsMm: [110.0, 130.0, 150.0, 180.0, 210.0],
    heightsMm: [37.0, 49.0, 74.0, 99.0, 148.0],
    qrSizeMm: 25.0,
    headerHMm: 28.0,
    labelMarginMm: 1.0,
    labelBottomPadMm: 1.0,
    colHeaderHMm: 5.0,
    rowHMm: 5.0,
    pnpWMm: 12.0,
    colPaddingMm: 3.0,
    checkboxSizeMm: 2.2,
    fontSizePt: 10.0,
    maxContinuations: 3,
  );
}
