import 'package:flutter/foundation.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

import '../models/ocr_result.dart';
import '../utils/label_parser.dart';

class MlKitOcrService {
  // Возвращаем latin, так как он лучше читает визуальный образ кириллицы, чем Paddle
  final TextRecognizer _textRecognizer = TextRecognizer(
    script: TextRecognitionScript.latin,
  );

  Future<OcrParsedResult> processImage(String imagePath) async {
    try {
      final inputImage = InputImage.fromFilePath(imagePath);
      final recognizedText = await _textRecognizer.processImage(inputImage);

      // ВАЖНО: Выводим в консоль то, что видит ML Kit
      debugPrint('=== RAW TEXT FROM ML KIT ===');
      debugPrint(recognizedText.text);
      debugPrint('============================');

      return LabelParser.parse(recognizedText);
    } catch (e) {
      debugPrint('Ошибка ML Kit: $e');
      return OcrParsedResult();
    }
  }

  void dispose() {
    _textRecognizer.close();
  }
}
