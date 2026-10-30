import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../providers/container_provider.dart';
import '../services/scan_history_service.dart';
import '../utils/scan_window.dart';
import 'container_detail_screen.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  /// Размер окна сканирования (c-6d). Совпадает с визуальной рамкой.
  static const double _scanWindowSize = 220;

  final MobileScannerController _controller = MobileScannerController(
    // c-6d-fix: `normal` вместо `noDuplicates`. Иначе после reject
    // (QR вне рамки) плагин не даст повторно сработать тому же
    // штрихкоду, даже если его занести в рамку. Дублирующую
    // обработку блокирует флаг `_handled`.
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );

  bool _handled = false;

  /// Размер виджета и scanWindow сохраняются из LayoutBuilder и
  /// используются в `_onDetect` для фильтрации штрихкодов.
  Size? _widgetSize;
  Rect? _scanWindow;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled) return;
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    // c-6d-fix: native `scanWindow` на Android ненадёжен — фильтруем
    // вручную по положению центра штрихкода. Если все снаружи рамки —
    // молча игнорируем кадр (камера продолжает работать).
    final barcode = _pickBarcodeInScanWindow(barcodes, capture.size);
    if (barcode == null) return;

    final raw = barcode.rawValue;
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
      await ScanHistoryService.addToHistory(container.id);

      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ContainerDetailScreen(container: container),
        ),
      );
      if (!mounted) return;
      _handled = false;
      await _controller.start();
    } else {
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

  /// Возвращает первый штрихкод, чей центр (в системе изображения,
  /// пересчитанный в систему виджета) попадает в scanWindow.
  /// `null` — все снаружи.
  Barcode? _pickBarcodeInScanWindow(List<Barcode> barcodes, Size imageSize) {
    final scanWindow = _scanWindow;
    final widgetSize = _widgetSize;
    // Первый кадр до LayoutBuilder (крайне редко) — не блокируем.
    if (scanWindow == null || widgetSize == null || imageSize.isEmpty) {
      return barcodes.first;
    }
    for (final b in barcodes) {
      if (b.corners.isEmpty) continue;
      final center = barcodeCenterFromCorners(b.corners);
      if (isPointInsideScanWindow(
        pointInImage: center,
        imageSize: imageSize,
        widgetSize: widgetSize,
        scanWindow: scanWindow,
      )) {
        return b;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = context.watch<ContainerProvider>().isLoading;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Сканирование'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final size = constraints.biggest;
          // c-6d: мёртвая зона — сканируется только область внутри рамки.
          // `scanWindow` — в координатах виджета `MobileScanner`.
          // На устройствах, где native-`scanWindow` работает, — экономит CPU.
          // На Android 7.4.2 он ненадёжен — фильтр в `_onDetect` дублирует.
          final scanWindow = calculateScanWindow(size, _scanWindowSize);
          // Сохраняем для фильтра в `_onDetect`.
          _widgetSize = size;
          _scanWindow = scanWindow;
          return Stack(
            alignment: Alignment.center,
            children: [
              MobileScanner(
                controller: _controller,
                scanWindow: scanWindow,
                onDetect: _onDetect,
              ),
              Container(
                width: _scanWindowSize,
                height: _scanWindowSize,
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
          );
        },
      ),
    );
  }
}
