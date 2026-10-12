/// ChangeNotifier-провайдер сканирования тары.
///
/// Хранит состояние последнего скана и карточку тары.
/// Создаётся в `ScannerScreen` (`ChangeNotifierProvider` вокруг экрана).
library;

import 'package:flutter/foundation.dart';

import '../models/container.dart';
import '../services/api_client.dart';
import '../services/container_service.dart';
import '../services/qr_parser.dart';

class ContainerProvider extends ChangeNotifier {
  ContainerProvider(this._service);

  final ContainerService _service;

  Container? _container;
  String? _error;
  bool _isLoading = false;

  Container? get container => _container;
  String? get error => _error;
  bool get isLoading => _isLoading;

  /// Обработка отсканированного QR.
  ///
  /// - Парсит payload.
  /// - Если тара — грузит `Container` из API.
  /// - Иначе ставит понятную ошибку (пока поддерживаем только тару).
  Future<void> handleScan(String raw) async {
    final parsed = parseQrPayload(raw);
    if (!parsed.isValid) {
      _error = parsed.error;
      _container = null;
      notifyListeners();
      return;
    }

    if (parsed.type != QrEntityType.container) {
      _error =
          'Пока поддерживается только сканирование тары. '
          'Отсканирован: ${qrEntityTypeLabels[parsed.type]}.';
      _container = null;
      notifyListeners();
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _container = await _service.fetchById(parsed.id!);
    } on ApiException catch (e) {
      _error = e.statusCode == 404
          ? 'Тара #${parsed.id} не найдена.'
          : e.message;
      _container = null;
    } catch (e) {
      _error = 'Ошибка: $e';
      _container = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Сброс состояния — при повторном сканировании.
  void reset() {
    _container = null;
    _error = null;
    _isLoading = false;
    notifyListeners();
  }
}