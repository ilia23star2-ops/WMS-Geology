import 'dart:ui';

import '../models/ocr_result.dart';

class TesseractParser {
  static OcrParsedResult parse(String rawText) {
    final result = OcrParsedResult();
    final lines = rawText
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];

      if (result.site.isEmpty && _isHeader(line, ['уч', 'yu', 'y4', 'unu'])) {
        result.site =
            _extractValue(line) ?? (i + 1 < lines.length ? lines[i + 1] : '');
      } else if (result.workOrder.isEmpty &&
          _isHeader(line, ['н/з', 'h/3', 'hi3', 'n/3'])) {
        result.workOrder =
            _extractValue(line) ?? (i + 1 < lines.length ? lines[i + 1] : '');
      } else if (result.researchType.isEmpty &&
          _isHeader(line, ['исп', 'исл', 'тип', 'mcn', 'cn', 'vcn', 'ncn'])) {
        final rt =
            _extractValue(line) ?? (i + 1 < lines.length ? lines[i + 1] : '');
        if (rt.length <= 5) result.researchType = rt;
      } else if (result.containerNumber.isEmpty &&
          _isHeader(line, ['№', 'no', 'n0', 'ne'])) {
        final num =
            _extractValue(line) ?? (i + 1 < lines.length ? lines[i + 1] : '');
        if (RegExp(r'^\d{1,3}$').hasMatch(num)) result.containerNumber = num;
      }
    }

    final sampleRegex = RegExp(
      r'\b([A-Z]{2,4}\d{3,6})\b',
      caseSensitive: false,
    );
    for (final line in lines) {
      final lower = line.toLowerCase();
      if (lower.contains('образ') ||
          lower.contains('o6pa') ||
          lower.contains('6pa')) {
        continue;
      }
      final matches = sampleRegex.allMatches(line.toUpperCase());
      for (final m in matches) {
        final raw = m.group(1)!;
        if (raw == result.workOrder) continue;
        if (!result.samples.any((s) => s.sampleNumber == raw)) {
          result.samples.add(
            OcrSampleRow(
              sequenceNumber: result.samples.length + 1,
              sampleNumber: raw,
              boundingBox: Rect.zero,
            ),
          );
        }
      }
    }

    result.samples.sort((a, b) => a.sampleNumber.compareTo(b.sampleNumber));
    return result;
  }

  static bool _isHeader(String line, List<String> keys) {
    final lower = line.toLowerCase();
    for (final key in keys) {
      if (lower.contains(key)) return true;
    }
    return false;
  }

  static String? _extractValue(String line) {
    final parts = line.split(RegExp(r'[:;]'));
    if (parts.length > 1) {
      final val = parts[1].trim();
      return val.isEmpty ? null : val;
    }
    final partsBySpace = line.split(RegExp(r'\s{2,}'));
    if (partsBySpace.length > 1) {
      final val = partsBySpace[1].trim();
      return val.isEmpty ? null : val;
    }
    return null;
  }
}
