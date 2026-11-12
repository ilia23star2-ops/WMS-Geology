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

    // 1. Универсальные маркеры для поиска полей (работают для любых этикеток)
    final siteRegex = RegExp(
      r'^(Уч|yu|y4|уч|yy|Y4|Участок|Площадка|Site)',
      caseSensitive: false,
    );
    final woRegex = RegExp(
      r'^(Н/З|H/3|HI3|H13|n/3|НЗ|Наряд|Заказ|Work)',
      caseSensitive: false,
    );
    final rtRegex = RegExp(
      r'^(Исп|Mcn|Тип|Исл|cn|Ncn|Ucn|Vcn|ТИ|Исследование)',
      caseSensitive: false,
    );
    final containerRegex = RegExp(
      r'^(№|No|N0|Ne|Тара|Номер)',
      caseSensitive: false,
    );

    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];

      if (result.site.isEmpty && siteRegex.hasMatch(line)) {
        result.site =
            _extractValue(line) ?? (i + 1 < lines.length ? lines[i + 1] : '');
      } else if (result.workOrder.isEmpty && woRegex.hasMatch(line)) {
        var wo =
            _extractValue(line) ?? (i + 1 < lines.length ? lines[i + 1] : '');
        result.workOrder = cleanWorkOrder(wo);
      } else if (result.researchType.isEmpty && rtRegex.hasMatch(line)) {
        final rt =
            _extractValue(line) ?? (i + 1 < lines.length ? lines[i + 1] : '');
        if (rt.length <= 6) {
          result.researchType = rt;
        }
      } else if (result.containerNumber.isEmpty &&
          containerRegex.hasMatch(line)) {
        final num =
            _extractValue(line) ?? (i + 1 < lines.length ? lines[i + 1] : '');
        if (RegExp(r'^\d{1,3}$').hasMatch(num)) {
          result.containerNumber = num;
        }
      }
    }

    // 2. Если заголовков нет (например, при ручном выделении зоны)
    final sampleRegex = RegExp(
      r'\b([A-ZА-Я0-9]{2,5}\d{3,8})\b',
      caseSensitive: false,
    );
    final samples = <String>{};

    for (final line in lines) {
      final upper = line.toUpperCase();
      if (upper.contains('ОБРАЗЕЦ') ||
          upper.contains('П/П') ||
          upper.contains('ПРОБА')) {
        continue;
      }

      final match = sampleRegex.firstMatch(upper);
      if (match != null) {
        final raw = match.group(1)!;
        if (raw.length >= 6) {
          final cleaned = cleanSampleNumber(raw);
          samples.add(cleaned);
        }
      }
    }

    for (final line in lines) {
      final upper = line.toUpperCase();
      if (upper.contains('ОБРАЗЕЦ') ||
          upper.contains('П/П') ||
          upper.contains('ПРОБА')) {
        continue;
      }

      if (result.site.isEmpty &&
          RegExp(r'[А-Яа-я\-]').hasMatch(line) &&
          !upper.contains('ПА') &&
          !upper.contains('ШЛ') &&
          !upper.contains('ХА')) {
        result.site = line;
      } else if (result.researchType.isEmpty &&
          RegExp(r'^(ПА|ШЛ|ХА|ИЗ|ICP)$').hasMatch(upper)) {
        result.researchType = upper;
      } else if (result.workOrder.isEmpty) {
        final woMatch = RegExp(r'\b([A-ZА-Я]{2,4}\d{1,4})\b').firstMatch(upper);
        if (woMatch != null && !samples.contains(woMatch.group(1)!)) {
          result.workOrder = cleanWorkOrder(woMatch.group(1)!);
        }
      } else if (result.containerNumber.isEmpty &&
          RegExp(r'^\d{1,3}$').hasMatch(line)) {
        result.containerNumber = line;
      }
    }

    for (final s in samples) {
      result.samples.add(
        OcrSampleRow(
          sequenceNumber: result.samples.length + 1,
          sampleNumber: s,
          boundingBox: Rect.zero,
        ),
      );
    }

    result.samples.sort((a, b) => a.sampleNumber.compareTo(b.sampleNumber));
    return result;
  }

  static String cleanWorkOrder(String raw) {
    String res = raw.trim().toUpperCase().replaceAll(' ', '');
    res = res.replaceAll('1ST', 'TST');
    res = res.replaceAll('18T', 'TST');
    res = res.replaceAll('I8T', 'TST');
    res = res.replaceAll('T8T', 'TST');
    res = res.replaceAll('Т8Т', 'TST');
    return res;
  }

  static String cleanSampleNumber(String raw) {
    String res = raw.trim().toUpperCase().replaceAll(' ', '');
    res = res.replaceAll('1ST', 'TST');
    res = res.replaceAll('18T', 'TST');
    res = res.replaceAll('I8T', 'TST');
    res = res.replaceAll('Т8Т', 'TST');
    res = res.replaceAll('T8T', 'TST');
    res = res.replaceAll('TS7', 'TST');
    res = res.replaceAll('T5T', 'TST');
    res = res.replaceAll('O', '0');
    res = res.replaceAll('I', '1');
    res = res.replaceAll('Z', '2');
    return res;
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
