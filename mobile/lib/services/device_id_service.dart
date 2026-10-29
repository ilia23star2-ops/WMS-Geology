/// Сервис для хранения и генерации уникального ID устройства.
///
/// Нужен для офлайн-входа: сервер привязывает `offline` токен
/// к первому `device_id`, с которого пришёл запрос.
library;

import 'dart:math';
import 'package:shared_preferences/shared_preferences.dart';

class DeviceIdService {
  static const String _key = 'device_id';
  static String? _cachedId;

  /// Получить ID устройства. Если его нет — сгенерировать и сохранить.
  static Future<String> getDeviceId() async {
    if (_cachedId != null) return _cachedId!;

    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_key);

    if (id == null || id.isEmpty) {
      id = _generateUuidV4();
      await prefs.setString(_key, id);
    }

    _cachedId = id;
    return id;
  }

  /// Генерация UUID v4 без внешних зависимостей.
  static String _generateUuidV4() {
    final random = Random();
    const hexDigits = '0123456789abcdef';

    String hex(int length) =>
        List.generate(length, (_) => hexDigits[random.nextInt(16)]).join();

    return '${hex(8)}-${hex(4)}-4${hex(3)}-${hex(1)}${hex(3)}-${hex(12)}';
  }
}