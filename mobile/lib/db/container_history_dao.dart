/// DAO кэша истории тары (c-7e-2).
///
/// Хранит `{container_id, id, created_at, data}` в таблице
/// `container_history`. `data` — сырой JSON AuditLog.
///
/// `saveAll` — полная замена для `container_id` (DELETE + INSERT):
/// история — append-only на сервере, при каждом `fetchHistory` онлайн
/// мы получаем полный список и перезаписываем кэш. Иначе старые записи
/// копились бы бесконечно.
library;

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'database.dart';

class ContainerHistoryDao {
  static Future<void> saveAll(
    int containerId,
    List<Map<String, dynamic>> items,
  ) async {
    final db = await AppDatabase.instance.database;
    final batch = db.batch();

    batch.delete(
      'container_history',
      where: 'container_id = ?',
      whereArgs: [containerId],
    );

    for (final json in items) {
      final id = json['id'] as int?;
      if (id == null) continue;
      batch.insert('container_history', {
        'container_id': containerId,
        'id': id,
        'created_at': (json['created_at'] as String?) ?? '',
        'data': jsonEncode(json),
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }

    await batch.commit(noResult: true);
  }

  static Future<List<Map<String, dynamic>>> getByContainerId(
    int containerId,
  ) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'container_history',
      where: 'container_id = ?',
      whereArgs: [containerId],
      orderBy: 'created_at DESC, id DESC',
    );
    return rows
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }

  static Future<void> deleteByContainerId(int containerId) async {
    final db = await AppDatabase.instance.database;
    await db.delete(
      'container_history',
      where: 'container_id = ?',
      whereArgs: [containerId],
    );
  }
}
