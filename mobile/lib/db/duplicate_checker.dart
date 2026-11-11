import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

class DuplicateChecker {
  static Future<Set<String>> findDuplicates(List<String> sampleNumbers) async {
    if (sampleNumbers.isEmpty) return {};
    final duplicates = <String>{};
    try {
      final dbPath = p.join(await getDatabasesPath(), 'wms_geology.db');
      final db = await openDatabase(dbPath, readOnly: true);
      for (final num in sampleNumbers) {
        final result = await db.rawQuery(
          "SELECT COUNT(*) AS c FROM samples WHERE data LIKE ?",
          ['%"sample_number":"$num"%'],
        );
        final count = Sqflite.firstIntValue(result) ?? 0;
        if (count > 0) duplicates.add(num);
      }
      await db.close();
      debugPrint('🔍 Дубликаты: $duplicates');
    } catch (e) {
      debugPrint('Ошибка проверки дубликатов: $e');
    }
    return duplicates;
  }
}
