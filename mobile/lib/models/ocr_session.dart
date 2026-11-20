/// Модель сессии оцифровки (6e-1b, 6e-2b).
///
/// Хранит список ячеек с фотографиями в памяти.
/// 6e-2b: зоны разметки per-photo (пиксели оригинала).
library;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'ocr_zone.dart';

class CellPhotos {
  final int cellId;
  final String fullAddress;
  final List<XFile> photos;

  /// 6e-2b: зоны разметки по пути фото.
  final Map<String, List<OcrZoneMark>> _zonesByPhoto = {};

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
      final path = photos[index].path;
      photos.removeAt(index);
      _zonesByPhoto.remove(path);
      onChanged?.call();
    }
  }

  /// 6e-2b: зоны фото (пустой список, если не размечено).
  List<OcrZoneMark> zonesFor(String photoPath) =>
      List.unmodifiable(_zonesByPhoto[photoPath] ?? const []);

  /// 6e-2b: сохранить разметку фото (заменяет предыдущую).
  void setZones(String photoPath, List<OcrZoneMark> zones) {
    _zonesByPhoto[photoPath] = List.of(zones);
    onChanged?.call();
  }

  /// 6e-2b: снять разметку фото.
  void clearZones(String photoPath) {
    _zonesByPhoto.remove(photoPath);
    onChanged?.call();
  }
}

class OcrSession extends ChangeNotifier {
  final List<CellPhotos> _cells = [];

  /// 6e-3-backend-4d: имя пакета; null = автоимя сервера.
  String? _batchName;

  String? get batchName => _batchName;

  void setBatchName(String? value) {
    final trimmed = value?.trim();
    _batchName = (trimmed == null || trimmed.isEmpty) ? null : trimmed;
    notifyListeners();
  }

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
    _batchName = null;
    notifyListeners();
  }

  int get totalPhotos =>
      _cells.fold<int>(0, (sum, cell) => sum + cell.photos.length);
}
