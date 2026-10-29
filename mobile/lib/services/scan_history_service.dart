import 'package:shared_preferences/shared_preferences.dart';

/// Сервис для хранения истории отсканированных тар.
class ScanHistoryService {
  static const String _key = 'scan_history_ids';
  static const int _maxItems = 10;

  /// Получить список ID из истории (от новых к старым).
  static Future<List<int>> getHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_key) ?? [];
    return list.map(int.parse).toList();
  }

  /// Добавить ID в историю (удаляя дубликаты и ограничивая размер).
  static Future<void> addToHistory(int id) async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_key) ?? [];
    
    // Удаляем, если уже есть (чтобы переместить в начало)
    list.remove(id.toString());
    // Вставляем в начало
    list.insert(0, id.toString());
    
    // Обрезаем до максимума
    if (list.length > _maxItems) {
      list.removeRange(_maxItems, list.length);
    }
    
    await prefs.setStringList(_key, list);
  }
}