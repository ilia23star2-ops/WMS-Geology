/// Страница сканирования QR-payload'а (topology-scan-mobile, фикс заход 3).
///
/// Как у обычных сканеров: полноэкранная камера, окно сканирования
/// с рамкой и затемнением вне него, распознавание только внутри
/// окна (scan_window.dart), поле ввода кода плашкой внизу.
/// По результату — `Navigator.pop(raw)`; разбор — на вызывающей стороне.
library;

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../utils/scan_window.dart';

/// Затемнение с «вырезом» над окном сканирования.
class _DimPainter extends CustomPainter {
  const _DimPainter(this.window);

  final Rect window;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(window, const Radius.circular(12)))
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(path, Paint()..color = Colors.black.withValues(alpha: 0.45));
  }

  @override
  bool shouldRepaint(covariant _DimPainter old) => old.window != window;
}

class QrPayloadScannerPage extends StatefulWidget {
  const QrPayloadScannerPage({super.key});

  @override
  State<QrPayloadScannerPage> createState() => _QrPayloadScannerPageState();
}

class _QrPayloadScannerPageState extends State<QrPayloadScannerPage> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );
  final TextEditingController _manual = TextEditingController();
  bool _handled = false;

  @override
  void dispose() {
    _manual.dispose();
    _controller.dispose();
    super.dispose();
  }

  /// Первый код в окне сканирования или ручной ввод → raw и закрыть.
  void _submit(String? raw) {
    if (_handled || raw == null || raw.trim().isEmpty) return;
    setState(() => _handled = true);
    Navigator.of(context).pop(raw.trim());
  }

  void _onDetect(BarcodeCapture capture, Size widgetSize) {
    if (_handled || capture.barcodes.isEmpty) return;
    final barcode = capture.barcodes.first;
    final raw = barcode.rawValue;
    if (raw == null || raw.isEmpty) return;
    final window = calculateScanWindow(widgetSize, 260);
    final center = barcodeCenterFromCorners(barcode.corners);
    if (!isPointInsideScanWindow(
      pointInImage: center,
      imageSize: capture.size,
      widgetSize: widgetSize,
      scanWindow: window,
    )) {
      return;
    }
    _submit(raw);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(title: const Text('Скан QR')),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final size = Size(constraints.maxWidth, constraints.maxHeight);
          final window = calculateScanWindow(size, 260);
          return Stack(
            children: [
              Positioned.fill(
                child: MobileScanner(
                  controller: _controller,
                  onDetect: (c) => _onDetect(c, size),
                ),
              ),
              CustomPaint(painter: _DimPainter(window)),
              Positioned.fromRect(
                rect: window,
                child: Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.white, width: 3),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  color: Colors.black54,
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: SafeArea(
                    top: false,
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _manual,
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(
                              hintText: 'WMSG:CELL:1 или номер ячейки',
                              hintStyle: TextStyle(color: Colors.white70),
                              isDense: true,
                              filled: true,
                              fillColor: Colors.white12,
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(
                            Icons.arrow_forward,
                            color: Colors.white,
                          ),
                          onPressed: () => _submit(_manual.text),
                        ),
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
