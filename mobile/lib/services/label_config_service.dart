/// Сервис для хранения конфигурации этикеток (ТД-56).
library;

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/label_config.dart';

class LabelConfigService {
  static const _key = 'label_config';
  static LabelConfig? _cached;

  /// Загружает конфиг из кэша. Если нет — возвращает дефолтный.
  static Future<LabelConfig> load() async {
    if (_cached != null) return _cached!;

    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw != null) {
      try {
        _cached = LabelConfig.fromJson(jsonDecode(raw));
        return _cached!;
      } catch (_) {
        // Если формат устарел, сбрасываем
        await prefs.remove(_key);
      }
    }
    return LabelConfig.defaultConfig;
  }

  /// Сохраняет новый конфиг (вызывается при Pull).
  static Future<void> save(LabelConfig config) async {
    _cached = config;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(config.toJson()));
  }

  /// Для тестов.
  static void resetCache() {
    _cached = null;
  }
}
