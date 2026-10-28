/// DAO для работы с кэшем проб (3.x-offline-sync c-1).
library;

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'database.dart';

class SampleDao {
  /// Сохранить список проб в кэш.
  static Future<void> saveAll(List<Map<String, dynamic>> rawList) async {
    final db = await AppDatabase.instance.database;
    final batch = db.batch();

    for (final json in rawList) {
      final id = json['id'] as int;
      final containerId = json['container'] as int; // ID тары
      final updatedAt = (json['updated_at'] as String?) ?? '';

      batch.insert('samples', {
        'id': id,
        'container_id': containerId,
        'updated_at': updatedAt,
        'data': jsonEncode(json),
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }

    await batch.commit(noResult: true);
  }

  /// Получить все пробы, привязанные к таре.
  static Future<List<Map<String, dynamic>>> getByContainerId(
    int containerId,
  ) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'container_id = ?',
      whereArgs: [containerId],
    );

    return rows
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }
}
