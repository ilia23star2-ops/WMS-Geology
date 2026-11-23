/// Результат распознавания OCR.
class OcrRecognizeResult {
  final int taskId;
  final int? batchId; // ID батча, к которому привязана задача
  final ExtractedData? extracted;

  /// Вердикты резолвера по зонам (6e-4-resolve-4b).
  final List<ZoneVerdict> zoneVerdicts;

  OcrRecognizeResult({
    required this.taskId,
    this.batchId,
    this.extracted,
    this.zoneVerdicts = const [],
  });

  factory OcrRecognizeResult.fromJson(Map<String, dynamic> json) {
    return OcrRecognizeResult(
      taskId: json['task_id'] as int,
      batchId: json['batch_id'] as int?,
      extracted: json['extracted'] != null
          ? ExtractedData.fromJson(json['extracted'])
          : null,
      zoneVerdicts:
          (json['zone_verdicts'] as List?)
              ?.map((e) => ZoneVerdict.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  /// Есть ли хоть одна зона, требующая уточнения человеком.
  bool get needsAttention => zoneVerdicts.any((v) => v.needsInput);
}

/// Вердикт резолвера по одной зоне (6e-4-resolve).
class ZoneVerdict {
  final String zoneType;
  final bool resolved;
  final bool needsInput;
  final String? reason;

  ZoneVerdict({
    required this.zoneType,
    required this.resolved,
    required this.needsInput,
    this.reason,
  });

  factory ZoneVerdict.fromJson(Map<String, dynamic> json) {
    return ZoneVerdict(
      zoneType: json['zone_type'] as String? ?? '',
      resolved: json['resolved'] as bool? ?? false,
      needsInput: json['needs_input'] as bool? ?? false,
      reason: json['reason'] as String?,
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
