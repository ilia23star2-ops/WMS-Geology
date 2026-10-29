/// Экран сканирования QR для офлайн-входа.
///
/// Парсит base64-json из QR и возвращает `OfflineTokenPayload`.
library;

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../models/offline_token_payload.dart';

class QrLoginScreen extends StatefulWidget {
  const QrLoginScreen({super.key});

  @override
  State<QrLoginScreen> createState() => _QrLoginScreenState();
}

class _QrLoginScreenState extends State<QrLoginScreen> {
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

    try {
      // Пытаемся распарсить как base64(JSON)
      final jsonStr = utf8.decode(base64.decode(raw));
      final data = jsonDecode(jsonStr) as Map<String, dynamic>;
      final payload = OfflineTokenPayload.fromJson(data);
      Navigator.of(context).pop(payload);
    } catch (_) {
      // Фоллбэк для старых токенов (если QR был просто строкой)
      final fallback = OfflineTokenPayload(
        token: raw,
        purpose: 'offline',
        expiresAt: DateTime.now().add(const Duration(hours: 14)),
      );
      Navigator.of(context).pop(fallback);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Сканирование токена'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Stack(
        alignment: Alignment.center,
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Container(
            width: 260,
            height: 260,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white, width: 3),
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const Positioned(
            bottom: 40,
            child: Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('Наведите на QR-код токена'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}