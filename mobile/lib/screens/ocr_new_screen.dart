/// Экран «Оцифровка» (6a).
///
/// 6a-fix1: ApiClient через AuthProvider.service (в main.dart нет провайдера ApiClient).
///          + кнопка «Сделать фото» (камера).
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../models/ocr_task.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../services/catalog_service.dart';
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
  String? _imagePath;
  bool _uploading = false;
  OcrRecognizeResult? _result;
  String? _error;

  final ImagePicker _picker = ImagePicker();

  Future<void> _scanCell() async {
    final cellId = await showQrCellScanner(context);
    if (cellId == null || !mounted) return;

    String? label;
    try {
      final catalog = context.read<CatalogService>();
      // TODO 6a-fix2: label из /storage/cells/{id}/, если нужно.
      // ignore: unused_local_variable
      final _ = catalog;
      label = 'Ячейка #$cellId';
    } catch (_) {
      label = 'Ячейка #$cellId';
    }

    setState(() {
      _cellId = cellId;
      _cellLabel = label;
      _error = null;
    });
  }

  Future<void> _pickImage() async {
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );
      if (picked == null) return;
      setState(() {
        _imagePath = picked.path;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = 'Не удалось выбрать фото: $e');
    }
  }

  Future<void> _takePhoto() async {
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 90,
      );
      if (picked == null) return;
      setState(() {
        _imagePath = picked.path;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = 'Не удалось сделать фото: $e');
    }
  }

  Future<void> _upload() async {
    if (_imagePath == null) {
      setState(() => _error = 'Сначала выбери или сделай фото.');
      return;
    }
    setState(() {
      _uploading = true;
      _error = null;
      _result = null;
    });
    try {
      // 6a-fix1: ApiClient — из AuthProvider.service
      final auth = context.read<AuthProvider>();
      final service = OcrService(auth.service.apiClient);
      final result = await service.recognize(
        imagePath: _imagePath!,
        cellId: _cellId,
      );
      if (!mounted) return;
      setState(() => _result = result);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Ошибка: $e');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _copyTaskId() async {
    if (_result == null) return;
    await Clipboard.setData(ClipboardData(text: _result!.taskId.toString()));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('task_id=${_result!.taskId} скопирован')),
    );
  }

  void _reset() {
    setState(() {
      _imagePath = null;
      _result = null;
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
          _buildImageCard(),
          const SizedBox(height: 16),
          if (_result == null)
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
                label: Text(_uploading ? 'Отправка…' : 'Отправить на сервер'),
                onPressed: _uploading ? null : _upload,
              ),
            )
          else
            _buildResultCard(),
          if (_error != null) ...[
            const SizedBox(height: 12),
            AlertDialog(
              title: const Text('Ошибка'),
              content: Text(_error!),
              actions: [
                TextButton(
                  onPressed: () => setState(() => _error = null),
                  child: const Text('Ок'),
                ),
              ],
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
            const SizedBox(height: 4),
            Text(
              'Сканируй QR на ячейке — фото привяжется к ней. '
              'Или оставь пустым.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImageCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Фото этикетки',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            if (_imagePath != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.file(
                  File(_imagePath!),
                  height: 200,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 8),
            ],
            Row(
              children: [
                TextButton.icon(
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: const Text('Сделать фото'),
                  onPressed: _takePhoto,
                ),
                const SizedBox(width: 8),
                TextButton.icon(
                  icon: const Icon(Icons.photo_library_outlined),
                  label: Text(_imagePath == null ? 'Из галереи' : 'Заменить'),
                  onPressed: _pickImage,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResultCard() {
    final r = _result!;
    final ex = r.extracted;
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
                  'Задача #${r.taskId} отправлена',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('batch_id = ${r.batchId}'),
            if (ex != null && !ex.isEmpty) ...[
              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 8),
              if (ex.workOrderCoded != null)
                _kv('Н/З (текущий)', ex.workOrderCoded!),
              if (ex.workOrderIncoming != null)
                _kv('Н/З (входящий)', ex.workOrderIncoming!),
              if (ex.containerNumber != null)
                _kv('Номер тары', ex.containerNumber!),
              if (ex.researchType != null) _kv('ТИ', ex.researchType!),
              if (ex.samples.isNotEmpty)
                _kv(
                  'Пробы',
                  '${ex.samples.length}: ${ex.samples.take(5).join(", ")}'
                      '${ex.samples.length > 5 ? "…" : ""}',
                ),
              if (ex.wells.isNotEmpty) _kv('Скважины', ex.wells.join(', ')),
            ] else
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text('Поля не распознаны (нет зон / пустой OCR).'),
              ),
            const SizedBox(height: 16),
            Text(
              'Проверьте и подтвердите на компьютере: /ocr/review/${r.taskId}',
              style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                OutlinedButton.icon(
                  icon: const Icon(Icons.copy),
                  label: const Text('Скопировать task_id'),
                  onPressed: _copyTaskId,
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: _reset,
                  child: const Text('Ещё одну'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(k, style: const TextStyle(color: Colors.grey)),
          ),
          Expanded(
            child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
