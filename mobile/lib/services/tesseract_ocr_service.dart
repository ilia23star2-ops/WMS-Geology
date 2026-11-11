import 'package:flutter/foundation.dart';
import 'package:tesseract_ocr/tesseract_ocr.dart';
import 'package:tesseract_ocr/ocr_engine_config.dart';

import '../models/ocr_result.dart';
import '../utils/tesseract_parser.dart';

class TesseractOcrService {
  Future<OcrParsedResult> processImage(String imagePath) async {
    try {
      final text = await TesseractOcr.extractText(
        imagePath,
        config: const OCRConfig(language: 'rus+eng'),
      );

      debugPrint('=== RAW TEXT FROM TESSERACT ===');
      debugPrint(text);
      debugPrint('===============================');

      final result = TesseractParser.parse(text);
      result.rawTexts = text
          .split('\n')
          .where((l) => l.trim().isNotEmpty)
          .toList();
      result.processedImagePath = imagePath;

      return result;
    } catch (e) {
      debugPrint('Ошибка Tesseract: $e');
      return OcrParsedResult();
    }
  }
}
