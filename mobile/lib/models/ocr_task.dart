/// Результат распознавания OCR.
class OcrRecognizeResult {
  final int taskId;
  final int? batchId; // ID батча, к которому привязана задача
  final ExtractedData? extracted;

  OcrRecognizeResult({required this.taskId, this.batchId, this.extracted});

  factory OcrRecognizeResult.fromJson(Map<String, dynamic> json) {
    return OcrRecognizeResult(
      taskId: json['task_id'] as int,
      batchId: json['batch_id'] as int?,
      extracted: json['extracted'] != null
          ? ExtractedData.fromJson(json['extracted'])
          : null,
    );
  }
}

/// Распознанные данные.
class ExtractedData {
  final String? workOrderCoded;
  final String? workOrderIncoming;
  final String? containerNumber;
  final String? researchType;
  final List<String> samples;
  final List<String> wells;

  ExtractedData({
    this.workOrderCoded,
    this.workOrderIncoming,
    this.containerNumber,
    this.researchType,
    this.samples = const [],
    this.wells = const [],
  });

  factory ExtractedData.fromJson(Map<String, dynamic> json) {
    return ExtractedData(
      workOrderCoded: json['work_order_coded'] as String?,
      workOrderIncoming: json['work_order_incoming'] as String?,
      containerNumber: json['container_number'] as String?,
      researchType: json['research_type'] as String?,
      samples:
          (json['samples'] as List?)?.map((e) => e.toString()).toList() ?? [],
      wells: (json['wells'] as List?)?.map((e) => e.toString()).toList() ?? [],
    );
  }

  bool get isEmpty =>
      workOrderCoded == null &&
      workOrderIncoming == null &&
      containerNumber == null &&
      researchType == null &&
      samples.isEmpty &&
      wells.isEmpty;
}
