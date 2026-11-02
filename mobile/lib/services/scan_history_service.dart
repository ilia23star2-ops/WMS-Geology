/// Сервис истории отсканированных тар (c-7h).
///
/// Хранит `List<ScanHistoryEntry>` как JSON-строки в `shared_preferences`
/// (ключ `scan_history_entries`).
///
/// Миграция: если ключ пуст, но есть старый `scan_history_ids` (`List<int>`),
/// — преобразуем в `ScanHistoryEntry` с `label = «Тара #ID»` и удаляем
/// старый ключ.
library;

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/scan_history_entry.dart';

class ScanHistoryService {
  static const String _entriesKey = 'scan_history_entries';
  static const String _oldIdsKey = 'scan_history_ids';
  static const int _maxItems = 10;

  /// Получить историю (от новых к старым).
  static Future<List<ScanHistoryEntry>> getHistory() async {
    final prefs = await SharedPreferences.getInstance();

    final raw = prefs.getStringList(_entriesKey) ?? const [];

    // Миграция со старого формата (List<int> id).
    if (raw.isEmpty) {
      final oldIds = prefs.getStringList(_oldIdsKey) ?? const [];
      if (oldIds.isNotEmpty) {
        final migrated = oldIds
            .map(int.tryParse)
            .whereType<int>()
            .map(
              (id) => ScanHistoryEntry(
                id: id,
                containerNumber: null,
                workOrderCoded: '',
                researchTypeName: null,
              ),
            )
            .toList(growable: false);
        await _save(migrated);
        await prefs.remove(_oldIdsKey);
        return migrated;
      }
      return const [];
    }

    final entries = <ScanHistoryEntry>[];
    for (final s in raw) {
      try {
        final map = jsonDecode(s) as Map<String, dynamic>;
        entries.add(ScanHistoryEntry.fromJson(map));
      } catch (_) {
        // Битая запись — пропускаем.
      }
    }
    return entries;
  }

  /// Добавить запись (с дедупликацией по `id`, ограничение `_maxItems`).
  static Future<void> addToHistory(ScanHistoryEntry entry) async {
    final prefs = await SharedPreferences.getInstance();
    final current = await getHistory();

    final list = current.where((e) => e.id != entry.id).toList();
    list.insert(0, entry);
    if (list.length > _maxItems) {
      list.removeRange(_maxItems, list.length);
    }

    await _save(list);
    // На всякий случай чистим старый ключ.
    await prefs.remove(_oldIdsKey);
  }

  static Future<void> _save(List<ScanHistoryEntry> entries) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = entries.map((e) => jsonEncode(e.toJson())).toList();
    await prefs.setStringList(_entriesKey, raw);
  }
}
