/// Экран сканирования QR.
///
/// Использует `mobile_scanner`. После первого удачного скана
/// переходит на карточку тары (или показывает ошибку — в зависимости
/// от того, что нашлось по payload'у).
library;

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../providers/container_provider.dart';
import 'container_detail_screen.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  // Отдельный контроллер — чтобы можно было остановить сканирование
  // после первого срабатывания (иначе поток даёт сотни повторов).
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back,
  );

  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled) return;
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;
    final raw = barcodes.first.rawValue;
    if (raw == null || raw.isEmpty) return;

    _handled = true;
    await _controller.stop();

    if (!mounted) return;

    final provider = context.read<ContainerProvider>();
    provider.reset();
    await provider.handleScan(raw);

    if (!mounted) return;

    final container = provider.container;
    final error = provider.error;

    if (container != null) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ContainerDetailScreen(container: container),
        ),
      );
      if (!mounted) return;
      // При возврате — продолжаем сканирование.
      _handled = false;
      await _controller.start();
    } else {
      // Ошибка или неизвестный тип — показать snackbar, продолжить.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error ?? 'Не удалось обработать QR.'),
          duration: const Duration(seconds: 3),
        ),
      );
      _handled = false;
      await _controller.start();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = context.watch<ContainerProvider>().isLoading;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Сканирование'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Stack(
        alignment: Alignment.center,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          // Прицел по центру.
          Container(
            width: 220,
            height: 220,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white, width: 3),
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          if (isLoading)
            const Positioned(
              bottom: 40,
              child: Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      SizedBox(width: 12),
                      Text('Загрузка тары...'),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}