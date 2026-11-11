import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

import '../models/ocr_result.dart';

class _ParsedLine {
  final String text;
  final Rect box;
  _ParsedLine(this.text, this.box);
}

class LabelParser {
  static OcrParsedResult parse(RecognizedText recognizedText) {
    final result = OcrParsedResult();

    debugPrint('=== RAW TEXT FROM ML KIT ===');
    debugPrint(recognizedText.text);
    debugPrint('============================');

    final lines = <_ParsedLine>[];

    for (final block in recognizedText.blocks) {
      for (final line in block.lines) {
        var text = line.text.replaceAll(RegExp(r'[☐□☑■]'), '').trim();
        if (text.isNotEmpty) {
          lines.add(_ParsedLine(text, line.boundingBox));
        }
      }
    }

    lines.sort((a, b) => a.box.top.compareTo(b.box.top));

    String? findValueSpatial(RegExp headerRegex, RegExp? valRegex) {
      for (int i = 0; i < lines.length; i++) {
        final line = lines[i];
        if (headerRegex.hasMatch(line.text)) {
          final parts = line.text.split(RegExp(r'[:;]'));
          if (parts.length > 1 && parts[1].trim().isNotEmpty) {
            final val = parts[1].trim();
            if (valRegex == null || valRegex.hasMatch(val)) {
              return val;
            }
          }

          for (var j = 0; j < lines.length; j++) {
            if (i == j) {
              continue;
            }
            final nextLine = lines[j];
            final yDiff = (nextLine.box.top - line.box.top).abs();
            if (yDiff < 20 && nextLine.box.left > line.box.right - 10) {
              if (valRegex == null || valRegex.hasMatch(nextLine.text)) {
                return nextLine.text;
              }
            }
          }

          for (int j = i + 1; j < lines.length && j <= i + 4; j++) {
            final val = lines[j].text.trim();
            if (val.isEmpty ||
                RegExp(r'^\d+\.$').hasMatch(val) ||
                val.contains('n/n') ||
                val.contains('Образец')) {
              continue;
            }
            if (valRegex == null || valRegex.hasMatch(val)) {
              return val;
            }
          }
        }
      }
      return null;
    }

    // 1. Участок (добавили yy и Tec)
    result.site =
        findValueSpatial(
          RegExp(r'^(Уч|yu|y4|уч|yy|Tec)', caseSensitive: false),
          null,
        ) ??
        '';
    // 2. Н/З
    result.workOrder =
        findValueSpatial(
          RegExp(r'^(Н/З|H/3|HI3|H13|n/3)', caseSensitive: false),
          RegExp(r'[A-ZА-Я0-9]{3,}'),
        ) ??
        '';
    // 3. Тип (добавили NA, так как OCR часто читает ПА как NA)
    var rt =
        findValueSpatial(
          RegExp(r'^(Исп|Mcn|Тип|Исл)', caseSensitive: false),
          RegExp(r'^[А-Яа-яA-Za-z]{2,4}$'),
        ) ??
        '';
    if (rt.toUpperCase() == 'NA') rt = 'ПА'; // Исправление ошибки OCR
    result.researchType = rt;
    // 4. № тары
    result.containerNumber =
        findValueSpatial(
          RegExp(r'^(№|No|N0|Ne)', caseSensitive: false),
          RegExp(r'^\d{1,2}$'),
        ) ??
        '';

    String prefix = '';
    final woMatch = RegExp(
      r'^([A-ZА-Я]{2,4})',
      caseSensitive: false,
    ).firstMatch(result.workOrder);
    if (woMatch != null) {
      prefix = woMatch.group(1)!.toUpperCase();
    }

    // Функция для замены похожих букв на цифры (Z->7, O->0, I->1, S->5)
    String fixDigits(String input) {
      return input
          .replaceAll('Z', '7')
          .replaceAll('z', '7')
          .replaceAll('O', '0')
          .replaceAll('o', '0')
          .replaceAll('I', '1')
          .replaceAll('l', '1')
          .replaceAll('S', '5')
          .replaceAll('s', '5');
    }

    for (final line in lines) {
      var text = line.text;

      // Пытаемся найти пробу (буквы + цифры)
      final sampleMatch = RegExp(
        r'([A-Z]{2,4}[A-Z0-9]{4,8})',
        caseSensitive: false,
      ).firstMatch(text);

      if (sampleMatch != null) {
        var rawNum = sampleMatch.group(1)!.toUpperCase();

        // Берем первые 3 буквы (TST) и остальное (7801 или Z804)
        if (rawNum.length > 3) {
          final letters = rawNum.substring(0, 3);
          final digits = fixDigits(rawNum.substring(3)); // Меняем Z на 7
          final sampleNum = '$letters$digits';

          if (sampleNum != result.workOrder &&
              !result.samples.any((s) => s.sampleNumber == sampleNum)) {
            result.samples.add(
              OcrSampleRow(
                sequenceNumber: result.samples.length + 1,
                sampleNumber: sampleNum,
                boundingBox: line.box,
              ),
            );
          }
        }
      } else if (prefix.isNotEmpty) {
        // Если вообще нет букв, но есть 4-6 цифр подряд
        final digitsOnly = fixDigits(text.replaceAll(RegExp(r'[^0-9]'), ''));
        if (digitsOnly.length >= 4 && digitsOnly.length <= 6) {
          final restored = '$prefix$digitsOnly';
          if (!result.samples.any((s) => s.sampleNumber == restored)) {
            result.samples.add(
              OcrSampleRow(
                sequenceNumber: result.samples.length + 1,
                sampleNumber: restored,
                boundingBox: line.box,
              ),
            );
          }
        }
      }
      result.unknownBoxes.add(line.box);
    }

    result.samples.sort((a, b) => a.sampleNumber.compareTo(b.sampleNumber));
    return result;
  }
}
