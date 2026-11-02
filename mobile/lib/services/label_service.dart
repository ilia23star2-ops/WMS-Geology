/// Фасад для офлайн-печати этикетки тары (c-7f-2).
///
/// - `LabelService.render(data)` — сгенерировать PDF как `Uint8List`.
/// - `LabelService.openInViewer(data)` — сгенерировать + открыть
///   системный PDF-вьювер (через `open_filex`).
///
/// Используется в `ContainerDetailScreen._onPreview` при офлайне
/// (когда `ContainerService.fetchLabelPdf` бросает
/// `ApiException(isNetworkError: true)`).
library;

import 'dart:io';

import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../models/label_data.dart';
import 'label_pdf_generator.dart';

class LabelService {
  LabelService._();

  /// Сгенерировать PDF этикетки. Возвращает байты.
  static Future<List<int>> render(LabelData data) async {
    final bytes = await LabelPdfGenerator.render(data);
    return bytes;
  }

  /// Сгенерировать PDF и открыть в системном вьювере.
  /// Возвращает `true`, если вьювер открылся.
  static Future<bool> openInViewer(LabelData data) async {
    final bytes = await LabelPdfGenerator.render(data);
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/label-${data.containerId}-offline.pdf');
    await file.writeAsBytes(bytes, flush: true);
    final result = await OpenFilex.open(file.path);
    return result.type == ResultType.done;
  }
}
