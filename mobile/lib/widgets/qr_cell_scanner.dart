/// Мини-сканер QR-кода ячейки (6a).
///
/// `showQrCellScanner(context)` → `int?` (cellId) или `null`, если отменён.
/// Принимает только `WMSG:CELL:<id>`; остальные QR игнорирует.
library;

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../services/qr_parser.dart';

Future<int?> showQrCellScanner(BuildContext context) {
  return showDialog<int>(
    context: context,
    barrierDismissible: true,
    builder: (_) => const _QrCellScannerDialog(),
  );
}

class _QrCellScannerDialog extends StatefulWidget {
  const _QrCellScannerDialog();

  @override
  State<_QrCellScannerDialog> createState() => _QrCellScannerDialogState();
}

class _QrCellScannerDialogState extends State<_QrCellScannerDialog> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );

  bool _handled = false;
  String? _error;

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

    final result = parseQrPayload(raw);
    if (!result.isValid || result.type != QrEntityType.cell) {
      // Игнорируем не-CELL коды (не тара, не секция)
      setState(() {
        _error = 'Это не QR ячейки. Ожидается WMSG:CELL:<id>.';
      });
      return;
    }

    _handled = true;
    await _controller.stop();
    if (!mounted) return;
    Navigator.of(context).pop(result.id);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.all(12),
      child: AspectRatio(
        aspectRatio: 3 / 4,
        child: Stack(
          children: [
            MobileScanner(controller: _controller, onDetect: _onDetect),
            // Рамка-прицел
            Center(
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white, width: 3),
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            // Заголовок
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                color: Colors.black54,
                padding: const EdgeInsets.all(12),
                child: const Text(
                  'Сканирование QR ячейки',
                  style: TextStyle(color: Colors.white, fontSize: 16),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
            // Ошибка / подсказка
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                color: Colors.black54,
                padding: const EdgeInsets.all(12),
                child: Text(
                  _error ?? 'Наведите на QR-код ячейки (WMSG:CELL:...)',
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
            // Кнопка «Закрыть»
            Positioned(
              top: 8,
              right: 8,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
