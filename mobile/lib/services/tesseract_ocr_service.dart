import 'package:flutter/foundation.dart';
import 'package:flutter_tesseract_ocr/flutter_tesseract_ocr.dart';
import '../models/ocr_result.dart';
import '../utils/tesseract_parser.dart';

class TesseractOcrService {
  Future<OcrParsedResult> processImage(String imagePath) async {
    try {
      final text = await FlutterTesseractOcr.extractText(
        imagePath,
        language: 'rus+eng',
      );

      debugPrint('=== RAW TEXT FROM TESSERACT ===');
      debugPrint(text);
      debugPrint('===============================');

      final result = TesseractParser.parse(text);
      result.rawTexts = text.split('\n').where((l) => l.trim().isNotEmpty).toList();
      result.processedImagePath = imagePath;

      return result;
    } catch (e) {
      debugPrint('Ошибка Tesseract: $e');
      return OcrParsedResult();
    }
  }
}