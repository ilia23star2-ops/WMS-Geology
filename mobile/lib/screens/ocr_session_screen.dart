/// Главный экран сессии оцифровки (6e-1b).
///
/// Список ячеек со счётчиком фото + кнопка "Отправить на сервер".
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/ocr_session.dart';
import '../providers/auth_provider.dart';
import 'ocr_cell_screen.dart';
import '../widgets/qr_cell_scanner.dart';

class OcrSessionScreen extends StatefulWidget {
  const OcrSessionScreen({super.key});

  @override
  State<OcrSessionScreen> createState() => _OcrSessionScreenState();
}

class _OcrSessionScreenState extends State<OcrSessionScreen> {
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
              // Кнопки выбора ячейки
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        icon: const Icon(Icons.grid_view),
                        label: const Text('Выбрать ячейку'),
                        onPressed: () => _selectCell(context, session),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.qr_code_scanner),
                        label: const Text('Сканировать QR'),
                        onPressed: () => _scanQr(context, session),
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
                                onPressed: () =>
                                    _openCellInspection(context, cell),
                                child: const Text('Осмотреть'),
                              ),
                            ),
                          );
                        },
                      ),
              ),

              // Кнопка отправки
              if (totalPhotos > 0)
                Padding(
                  padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 16 + MediaQuery.paddingOf(context).bottom + MediaQuery.viewInsetsOf(context).bottom),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      icon: const Icon(Icons.cloud_upload),
                      label: Text(
                        'Отправить на сервер ($totalPhotos фото в ${cells.length} ячейках)',
                      ),
                      onPressed: () => _uploadSession(context, session),
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

  Future<void> _uploadSession(BuildContext context, OcrSession session) async {
    // TODO: отправка сессии на сервер
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Отправка сессии — в разработке')),
    );
  }
}
