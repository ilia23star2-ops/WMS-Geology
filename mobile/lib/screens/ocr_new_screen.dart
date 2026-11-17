/// Экран «Оцифровка» (6e-1).
///
/// Список ячеек + фото per cell (state в памяти) → одна отправка = один batch.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../models/ocr_task.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../services/ocr_service.dart';
import '../widgets/qr_cell_scanner.dart';

class OcrNewScreen extends StatefulWidget {
  const OcrNewScreen({super.key});

  @override
  State<OcrNewScreen> createState() => _OcrNewScreenState();
}

class _OcrNewScreenState extends State<OcrNewScreen> {
  int? _cellId;
  String? _cellLabel;
  final List<XFile> _photos = [];
  bool _uploading = false;
  List<OcrRecognizeResult> _results = [];
  String? _error;
  int? _batchId;

  final ImagePicker _picker = ImagePicker();

  Future<void> _scanCell() async {
    final cellId = await showQrCellScanner(context);
    if (cellId == null || !mounted) return;

    // 6a-fix2: Получаем label из API
    String label = 'Ячейка #$cellId';
    try {
      final auth = context.read<AuthProvider>();
      final response = await auth.service.apiClient.get(
        '/storage/cells/$cellId/',
      );
      if (response.data != null && response.data['full_address'] != null) {
        label = response.data['full_address'];
      }
    } catch (_) {
      // Если ошибка, оставляем дефолтный label
    }

    if (!mounted) return;
    setState(() {
      _cellId = cellId;
      _cellLabel = label;
      _error = null;
    });
  }

  Future<void> _addPhoto() async {
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 90,
      );
      if (picked == null) return;
      if (!mounted) return;
      setState(() {
        _photos.add(picked);
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Не удалось сделать фото: $e');
    }
  }

  Future<void> _addFromGallery() async {
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );
      if (picked == null) return;
      if (!mounted) return;
      setState(() {
        _photos.add(picked);
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Не удалось выбрать фото: $e');
    }
  }

  void _removePhoto(int index) {
    setState(() {
      _photos.removeAt(index);
    });
  }

  Future<void> _uploadBatch() async {
    if (_photos.isEmpty) {
      if (!mounted) return;
      setState(() => _error = 'Добавь хотя бы одно фото.');
      return;
    }
    if (!mounted) return;
    setState(() {
      _uploading = true;
      _error = null;
      _results = [];
    });

    try {
      final auth = context.read<AuthProvider>();
      final service = OcrService(auth.service.apiClient);

      // Отправляем первое фото для создания батча
      var result = await service.recognize(
        imagePath: _photos.first.path,
        cellId: _cellId,
      );
      _batchId = result.batchId;
      _results.add(result);

      // Остальные фото добавляем в тот же батч
      for (var i = 1; i < _photos.length; i++) {
        result = await service.recognize(
          imagePath: _photos[i].path,
          batchId: _batchId,
        );
        _results.add(result);
      }

      if (!mounted) return;
      setState(() {});
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Ошибка: $e');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _reset() {
    setState(() {
      _photos.clear();
      _results.clear();
      _batchId = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Оцифровка'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildCellCard(),
          const SizedBox(height: 16),
          _buildPhotosList(),
          const SizedBox(height: 16),
          if (_results.isEmpty)
            Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        icon: const Icon(Icons.photo_camera_outlined),
                        label: const Text('Камера'),
                        onPressed: _addPhoto,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.photo_library_outlined),
                        label: const Text('Галерея'),
                        onPressed: _addFromGallery,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    icon: _uploading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.cloud_upload_outlined),
                    label: Text(
                      _uploading
                          ? 'Отправка…'
                          : 'Отправить батч (${_photos.length})',
                    ),
                    onPressed: _uploading || _photos.isEmpty
                        ? null
                        : _uploadBatch,
                  ),
                ),
              ],
            )
          else
            _buildResultsList(),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Card(
              color: Colors.red.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ошибка',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(_error!),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => setState(() => _error = null),
                        child: const Text('Ок'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCellCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Ячейка', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: Text(
                    _cellLabel ?? 'Не выбрана',
                    style: TextStyle(
                      color: _cellLabel == null
                          ? Theme.of(context).hintColor
                          : null,
                    ),
                  ),
                ),
                TextButton.icon(
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text('Сканировать'),
                  onPressed: _scanCell,
                ),
                if (_cellId != null)
                  IconButton(
                    icon: const Icon(Icons.clear),
                    tooltip: 'Убрать',
                    onPressed: () => setState(() {
                      _cellId = null;
                      _cellLabel = null;
                    }),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotosList() {
    if (_photos.isEmpty) return const SizedBox.shrink();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Фото (${_photos.length})',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 100,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _photos.length,
                itemBuilder: (context, index) {
                  return Stack(
                    children: [
                      Container(
                        margin: const EdgeInsets.only(right: 8),
                        width: 100,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          image: DecorationImage(
                            image: FileImage(File(_photos[index].path)),
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 12,
                        child: GestureDetector(
                          onTap: () => _removePhoto(index),
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close,
                              color: Colors.white,
                              size: 16,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResultsList() {
    return Card(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.green),
                const SizedBox(width: 8),
                Text(
                  'Батч #$_batchId отправлен',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text('Задач: ${_results.length}'),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: ListView.builder(
                itemCount: _results.length,
                itemBuilder: (context, index) {
                  final r = _results[index];
                  return ListTile(
                    title: Text('Task #${r.taskId}'),
                    subtitle: Text(
                      r.extracted?.containerNumber ?? 'Нет данных',
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.copy),
                      onPressed: () async {
                        if (!mounted) return;
                        await Clipboard.setData(
                          ClipboardData(text: r.taskId.toString()),
                        );
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('task_id=${r.taskId} скопирован'),
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _reset,
                child: const Text('Новый батч'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
