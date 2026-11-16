/// Модели OCR-задач (6a).
///
/// Парсинг ответа `POST /api/v1/ocr/recognize/` и `GET /api/v1/ocr/tasks/{id}/`.
library;

class OcrWord {
  final String text;
  final double confidence;
  final List<List<double>> bbox;

  OcrWord({required this.text, required this.confidence, required this.bbox});

  factory OcrWord.fromJson(Map<String, dynamic> json) {
    final rawBbox = (json['bbox'] as List?) ?? const [];
    final bbox = <List<double>>[];
    for (final pt in rawBbox) {
      if (pt is List && pt.length >= 2) {
        bbox.add([(pt[0] as num).toDouble(), (pt[1] as num).toDouble()]);
      }
    }
    return OcrWord(
      text: (json['text'] as String?) ?? '',
      confidence: ((json['confidence'] as num?) ?? 0).toDouble(),
      bbox: bbox,
    );
  }
}

class OcrRawData {
  final String text;
  final List<OcrWord> words;
  final ExtractedFields? extracted;

  OcrRawData({required this.text, required this.words, this.extracted});

  factory OcrRawData.fromJson(Map<String, dynamic> json) {
    final wordsRaw = (json['words'] as List?) ?? const [];
    final words = wordsRaw
        .whereType<Map<String, dynamic>>()
        .map(OcrWord.fromJson)
        .toList();
    final exRaw = json['extracted'];
    return OcrRawData(
      text: (json['text'] as String?) ?? '',
      words: words,
      extracted: exRaw is Map<String, dynamic>
          ? ExtractedFields.fromJson(exRaw)
          : null,
    );
  }
}

class ExtractedFields {
  final String? workOrderCoded;
  final String? workOrderIncoming;
  final String? containerNumber;
  final String? researchType;
  final List<String> samples;
  final List<String> wells;
  final String source;

  ExtractedFields({
    this.workOrderCoded,
    this.workOrderIncoming,
    this.containerNumber,
    this.researchType,
    required this.samples,
    required this.wells,
    required this.source,
  });

  factory ExtractedFields.fromJson(Map<String, dynamic> json) {
    List<String> asStringList(dynamic v) {
      if (v is List) {
        return v.map((e) => e.toString()).toList();
      }
      return const [];
    }

    return ExtractedFields(
      workOrderCoded: json['work_order_coded'] as String?,
      workOrderIncoming: json['work_order_incoming'] as String?,
      containerNumber: json['container_number'] as String?,
      researchType: json['research_type'] as String?,
      samples: asStringList(json['samples']),
      wells: asStringList(json['wells']),
      source: (json['source'] as String?) ?? 'none',
    );
  }

  bool get isEmpty =>
      samples.isEmpty &&
      wells.isEmpty &&
      workOrderCoded == null &&
      workOrderIncoming == null &&
      containerNumber == null &&
      researchType == null;
}

class OcrRecognizeResult {
  final int taskId;
  final int batchId;
  final OcrRawData? data;
  final ExtractedFields? extracted;

  OcrRecognizeResult({
    required this.taskId,
    required this.batchId,
    this.data,
    this.extracted,
  });

  factory OcrRecognizeResult.fromJson(Map<String, dynamic> json) {
    final dataRaw = json['data'];
    final exRaw = json['extracted'];
    return OcrRecognizeResult(
      taskId: (json['task_id'] as num?)?.toInt() ?? 0,
      batchId: (json['batch_id'] as num?)?.toInt() ?? 0,
      data: dataRaw is Map<String, dynamic>
          ? OcrRawData.fromJson(dataRaw)
          : null,
      extracted: exRaw is Map<String, dynamic>
          ? ExtractedFields.fromJson(exRaw)
          : null,
    );
  }
}
