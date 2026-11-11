import 'package:flutter/material.dart';

class OcrSampleRow {
  final int? sequenceNumber;
  String sampleNumber;
  Rect boundingBox;
  bool isDuplicate;

  OcrSampleRow({
    this.sequenceNumber,
    required this.sampleNumber,
    required this.boundingBox,
    this.isDuplicate = false,
  });
}

class OcrParsedResult {
  String site;
  String workOrder;
  String incomingWorkOrder;
  String researchType;
  String containerNumber;
  List<OcrSampleRow> samples;
  List<Rect> unknownBoxes;

  List<String> rawTexts = [];
  String? processedImagePath;

  OcrParsedResult({
    this.site = '',
    this.workOrder = '',
    this.incomingWorkOrder = '',
    this.researchType = '',
    this.containerNumber = '',
    List<OcrSampleRow>? samples,
    List<Rect>? unknownBoxes,
  }) : samples = samples ?? [],
       unknownBoxes = unknownBoxes ?? [];

  void shiftBoxes(Offset offset) {
    for (var s in samples) {
      s.boundingBox = s.boundingBox.shift(offset);
    }
    for (var i = 0; i < unknownBoxes.length; i++) {
      unknownBoxes[i] = unknownBoxes[i].shift(offset);
    }
  }

  void scaleBoxes(double factor) {
    for (var s in samples) {
      s.boundingBox = Rect.fromLTRB(
        s.boundingBox.left * factor,
        s.boundingBox.top * factor,
        s.boundingBox.right * factor,
        s.boundingBox.bottom * factor,
      );
    }
    for (var i = 0; i < unknownBoxes.length; i++) {
      unknownBoxes[i] = Rect.fromLTRB(
        unknownBoxes[i].left * factor,
        unknownBoxes[i].top * factor,
        unknownBoxes[i].right * factor,
        unknownBoxes[i].bottom * factor,
      );
    }
  }
}
