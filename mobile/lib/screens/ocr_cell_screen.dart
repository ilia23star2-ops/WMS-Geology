/// Экран осмотра ячейки (6e-1b, 6e-2c).
///
/// Добавление/удаление фото для конкретной ячейки.
/// 6e-2c: «Разметить зоны» → экран разметки; бейдж «Зоны: N».
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../models/ocr_session.dart';
import 'ocr_zone_marking_screen.dart';

class OcrCellScreen extends StatefulWidget {
  final CellPhotos cell;

  const OcrCellScreen({super.key, required this.cell});

  @override
  State<OcrCellScreen> createState() => _OcrCellScreenState();
}

class _OcrCellScreenState extends State<OcrCellScreen> {
  final ImagePicker _picker = ImagePicker();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Осмотр ${widget.cell.fullAddress}'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Column(
        children: [
          // Кнопки добавления фото
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    icon: const Icon(Icons.photo_camera),
                    label: const Text('Сделать фото'),
                    onPressed: _takePhoto,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.photo_library),
                    label: const Text('Из галереи'),
                    onPressed: _pickFromGallery,
                  ),
                ),
              ],
            ),
          ),

          // Сетка фото
          Expanded(
            child: widget.cell.photos.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.add_photo_alternate_outlined,
                          size: 64,
                          color: Theme.of(context).colorScheme.outline,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Добавьте фото этикетки',
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ],
                    ),
                  )
                : GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                        ),
                    itemCount: widget.cell.photos.length,
                    itemBuilder: (context, index) {
                      final photo = widget.cell.photos[index];
                      final zonesCount = widget.cell
                          .zonesFor(photo.path)
                          .length;
                      return Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.file(
                              File(photo.path),
                              fit: BoxFit.cover,
                            ),
                          ),
                          Positioned(
                            top: 8,
                            right: 8,
                            child: GestureDetector(
                              onTap: () => _removePhoto(index),
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: const BoxDecoration(
                                  color: Colors.red,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.delete,
                                  color: Colors.white,
                                  size: 20,
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 8,
                            left: 8,
                            right: 8,
                            child: GestureDetector(
                              onTap: () => _openZoneMarking(context, photo),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: zonesCount > 0
                                      ? Colors.green.shade700
                                      : Colors.black54,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  zonesCount > 0
                                      ? 'Зоны: $zonesCount'
                                      : 'Разметить зоны',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
          ),

          // Кнопка сохранения
          if (widget.cell.photos.isNotEmpty)
            Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom:
                    16 +
                    MediaQuery.paddingOf(context).bottom +
                    MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.arrow_forward),
                  label: const Text('Сохранить и продолжить'),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _takePhoto() async {
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 90,
      );
      if (picked == null) return;
      if (!mounted) return;
      setState(() {
        widget.cell.addPhoto(picked);
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Не удалось сделать фото: $e')));
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );
      if (picked == null) return;
      if (!mounted) return;
      setState(() {
        widget.cell.addPhoto(picked);
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Не удалось выбрать фото: $e')));
    }
  }

  void _removePhoto(int index) {
    setState(() {
      widget.cell.removePhoto(index);
    });
  }

  Future<void> _openZoneMarking(BuildContext context, XFile photo) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => OcrZoneMarkingScreen(cell: widget.cell, photo: photo),
      ),
    );
    if (mounted) setState(() {});
  }
}
