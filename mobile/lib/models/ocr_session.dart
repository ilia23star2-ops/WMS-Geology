/// Модель сессии оцифровки (6e-1b).
///
/// Хранит список ячеек с фотографиями в памяти.
library;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

class CellPhotos {
  final int cellId;
  final String fullAddress;
  final List<XFile> photos;

  /// 6e-a1: уведомляет сессию, чтобы счётчик фото обновился в UI.
  final VoidCallback? onChanged;

  CellPhotos({
    required this.cellId,
    required this.fullAddress,
    List<XFile>? photos,
    this.onChanged,
  }) : photos = photos ?? [];

  void addPhoto(XFile photo) {
    photos.add(photo);
    onChanged?.call();
  }

  void removePhoto(int index) {
    if (index >= 0 && index < photos.length) {
      photos.removeAt(index);
      onChanged?.call();
    }
  }
}

class OcrSession extends ChangeNotifier {
  final List<CellPhotos> _cells = [];

  List<CellPhotos> get cells => List.unmodifiable(_cells);

  void addCell(int cellId, String fullAddress) {
    // Проверяем, есть ли уже такая ячейка
    if (getCell(cellId) != null) {
      return; // Уже есть
    }

    _cells.add(
      CellPhotos(
        cellId: cellId,
        fullAddress: fullAddress,
        onChanged: notifyListeners,
      ),
    );
    notifyListeners();
  }

  void removeCell(int cellId) {
    _cells.removeWhere((c) => c.cellId == cellId);
    notifyListeners();
  }

  CellPhotos? getCell(int cellId) {
    // 6e-a1: без firstOrNull — он из dart:collection, не из material.
    for (final cell in _cells) {
      if (cell.cellId == cellId) return cell;
    }
    return null;
  }

  void clear() {
    _cells.clear();
    notifyListeners();
  }

  int get totalPhotos =>
      _cells.fold<int>(0, (sum, cell) => sum + cell.photos.length);
}
