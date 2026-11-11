import 'dart:ui';
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
    
    // Заглушка: ML Kit парсер оставлен для совместимости
    return result; 
  }
}