/// Главный экран сессии оцифровки (6e-1b, 6e-a3).
///
/// Список ячеек со счётчиком фото + кнопка "Отправить на сервер".
/// 6e-a3: `_uploadSession` — фото → recognize (один батч) → sendBatch → clear.
/// 6e-a3-fix: информативный прогресс «Фото N/M · адрес ячейки».
/// 6e-4-resolve-4b: после отправки показываем, сколько фото требуют уточнения.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/ocr_session.dart';
import '../providers/auth_provider.dart';
import '../services/ocr_service.dart';
import 'ocr_cell_screen.dart';
import '../widgets/qr_cell_scanner.dart';

class OcrSessionScreen extends StatefulWidget {
  const OcrSessionScreen({super.key});

  @override
  State<OcrSessionScreen> createState() => _OcrSessionScreenState();
}

class _OcrSessionScreenState extends State<OcrSessionScreen> {
  final TextEditingController _nameCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  bool _isUploading = false;
  String _uploadLabel = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('OCR Оцифровка'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Consumer<OcrSession>(
        builder: (context, session, child) {
          final cells = session.cells;
          final totalPhotos = cells.fold<int>(
            0,
            (sum, cell) => sum + cell.photos.length,
          );

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: TextField(
                  controller: _nameCtrl,
                  enabled: _isUploading == false,
                  decoration: const InputDecoration(
                    labelText: 'Имя пакета (необязательно)',
                    helperText: 'Пусто — сервер поставит адрес ячейки и дату',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: session.setBatchName,
                ),
              ),

              // Кнопки выбора ячейки
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        icon: const Icon(Icons.grid_view),
                        label: const Text('Выбрать ячейку'),
                        onPressed: _isUploading
                            ? null
                            : () => _selectCell(context, session),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.qr_code_scanner),
                        label: const Text('Сканировать QR'),
                        onPressed: _isUploading
                            ? null
                            : () => _scanQr(context, session),
                      ),
                    ),
                  ],
                ),
              ),

              // Список ячеек
              Expanded(
                child: cells.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.photo_library_outlined,
                              size: 64,
                              color: Theme.of(context).colorScheme.outline,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Добавьте ячейку для начала оцифровки',
                              style: Theme.of(context).textTheme.bodyLarge,
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: cells.length,
                        itemBuilder: (context, index) {
                          final cell = cells[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: ListTile(
                              contentPadding: const EdgeInsets.all(16),
                              title: Text(
                                cell.fullAddress,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 16,
                                ),
                              ),
                              subtitle: Row(
                                children: [
                                  Icon(
                                    Icons.photo_camera,
                                    size: 16,
                                    color: Theme.of(context)
                                        .colorScheme
                                        .outline,
                                  ),
                                  const SizedBox(width: 4),
                                  Text('${cell.photos.length} фото'),
                                ],
                              ),
                              trailing: FilledButton(
                                onPressed: _isUploading
                                    ? null
                                    : () => _openCellInspection(context, cell),
                                child: const Text('Осмотреть'),
                              ),
                            ),
                          );
                        },
                      ),
              ),

              // Кнопка отправки
              if (totalPhotos > 0 || _isUploading)
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
                      icon: _isUploading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.cloud_upload),
                      label: Text(
                        _isUploading
                            ? (_uploadLabel.isEmpty
                                  ? 'Отправка…'
                                  : _uploadLabel)
                            : 'Отправить на сервер ($totalPhotos фото в ${cells.length} ячейках)',
                      ),
                      onPressed: _isUploading
                          ? null
                          : () => _uploadSession(context, session),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _selectCell(BuildContext context, OcrSession session) async {
    // TODO: открыть диалог выбора ячейки из списка
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Выбор ячейки из списка — в разработке')),
    );
  }

  Future<void> _scanQr(BuildContext context, OcrSession session) async {
    final cellId = await showQrCellScanner(context);
    if (cellId == null || !context.mounted) return;

    // Получаем адрес ячейки
    String fullAddress = 'Ячейка #$cellId';
    try {
      final auth = context.read<AuthProvider>();
      final response = await auth.service.apiClient.get(
        '/storage/cells/$cellId/',
      );
      if (response.data != null && response.data['full_address'] != null) {
        fullAddress = response.data['full_address'];
      }
    } catch (_) {}

    if (!mounted) return;
    session.addCell(cellId, fullAddress);
  }

  void _openCellInspection(BuildContext context, CellPhotos cell) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => OcrCellScreen(cell: cell)),
    );
  }

  /// 6e-a3: все фото сессии → один батч → статус SENT → очистка.
  ///
  /// Успешно отправленные фото удаляются сразу — при ошибке повтор
  /// отправит только оставшиеся (без дублей задач на сервере).
  /// 6e-4-resolve-4b: считаем фото с needs_input и показываем в SnackBar.
  Future<void> _uploadSession(BuildContext context, OcrSession session) async {
    if (_isUploading || session.totalPhotos == 0) return;
    setState(() => _isUploading = true);

    final ocrService = context.read<OcrService>();
    final messenger = ScaffoldMessenger.of(context);
    final total = session.totalPhotos;
    var sent = 0;
    var needsAttentionCount = 0;
    int? batchId;

    try {
      for (final cell in session.cells) {
        final photos = List.of(cell.photos);
        for (final photo in photos) {
          setState(
            () =>
                _uploadLabel = 'Фото ${sent + 1}/$total · ${cell.fullAddress}',
          );
          final result = await ocrService.recognize(
            imagePath: photo.path,
            cellId: cell.cellId,
            batchId: batchId,
            name: batchId == null ? session.batchName : null,
            zones: cell.zonesFor(photo.path).map((z) => z.toPayload()).toList(),
          );
          batchId ??= result.batchId;
          if (result.needsAttention) needsAttentionCount++;
          cell.removePhoto(0);
          sent++;
        }
      }
      setState(() => _uploadLabel = 'Завершение батча…');
      if (batchId != null) {
        await ocrService.sendBatch(batchId);
      }
      session.clear();
      _nameCtrl.clear();
      final attention = needsAttentionCount > 0
          ? ' · требуют уточнения: $needsAttentionCount (проверь в web)'
          : '';
      messenger.showSnackBar(
        SnackBar(content: Text('Отправлено на сервер: $sent фото$attention')),
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Ошибка отправки (успешно $sent): $e')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isUploading = false;
          _uploadLabel = '';
        });
      }
    }
  }
}
