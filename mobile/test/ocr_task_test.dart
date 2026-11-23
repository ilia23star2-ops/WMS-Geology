import "package:flutter_test/flutter_test.dart";
import "package:wms_geology_mobile/models/ocr_task.dart";

void main() {
  test("fromJson читает zone_verdicts и needsAttention", () {
    final r = OcrRecognizeResult.fromJson({
      "task_id": 1,
      "zone_verdicts": [
        {"zone_type": "site", "resolved": true, "needs_input": false},
        {"zone_type": "research_type", "resolved": false, "needs_input": true, "reason": "x"},
      ],
    });
    expect(r.zoneVerdicts.length, 2);
    expect(r.needsAttention, isTrue);
    expect(r.zoneVerdicts[1].needsInput, isTrue);
    expect(r.zoneVerdicts[0].needsInput, isFalse);
  });

  test("без zone_verdicts список пуст и внимания нет", () {
    final r = OcrRecognizeResult.fromJson({"task_id": 2});
    expect(r.zoneVerdicts, isEmpty);
    expect(r.needsAttention, isFalse);
  });
}
