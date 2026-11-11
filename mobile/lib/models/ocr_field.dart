import 'package:flutter/material.dart';

/// Типы полей, которые мы ищем на этикетке.
enum OcrFieldType {
  sampleNumber('Номер пробы', Colors.red),
  workOrder('Наряд/Заказ (Н/З)', Colors.blue),
  site('Участок', Colors.green),
  unknown('Другое', Colors.grey);

  final String label;
  final MaterialColor color;

  const OcrFieldType(this.label, this.color);
}

/// Класс для хранения распознанного текста и его координат на фото.
class OcrField {
  String text;
  final Rect boundingBox;
  final OcrFieldType type;

  /// Флаг: найдено ли это значение в локальном справочнике.
  /// Если true — рамка рисуется зеленым, если false — желтым.
  bool isVerified;

  OcrField({
    required this.text,
    required this.boundingBox,
    required this.type,
    this.isVerified = false,
  });
}
