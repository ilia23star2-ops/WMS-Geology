/// Страница сканирования QR-payload'а (topology-scan-mobile).
///
/// Камера (mobile_scanner) + ручной ввод для проверки без наклейки.
/// По результату — `Navigator.pop(raw)`; разбор и переход — на
/// стороне вызывающего экрана.
library;

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class QrPayloadScannerPage extends StatefulWidget {
  const QrPayloadScannerPage({super.key});

  @override
  State<QrPayloadScannerPage> createState() => _QrPayloadScannerPageState();
}

class _QrPayloadScannerPageState extends State<QrPayloadScannerPage> {
  final MobileScannerController _controller = MobileScannerController();
  final TextEditingController _manual = TextEditingController();
  bool _handled = false;

  @override
  void dispose() {
    _manual.dispose();
    _controller.dispose();
    super.dispose();
  }

  /// Первый валидный кадр или ручной ввод → вернуть raw и закрыть.
  void _submit(String? raw) {
    if (_handled || raw == null || raw.trim().isEmpty) return;
    setState(() => _handled = true);
    Navigator.of(context).pop(raw.trim());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Скан QR')),
      body: Column(
        children: [
          Expanded(
            child: MobileScanner(
              controller: _controller,
              onDetect: (capture) {
                if (capture.barcodes.isEmpty) return;
                _submit(capture.barcodes.first.rawValue);
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _manual,
                    decoration: const InputDecoration(
                      hintText: 'WMSG:CELL:1',
                      isDense: true,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.arrow_forward),
                  onPressed: () => _submit(_manual.text),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
