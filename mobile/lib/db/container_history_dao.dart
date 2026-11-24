/// DAO кэша истории тары (c-7e-2).
///
/// Хранит `{container_id, id, created_at, data}` в таблице
/// `container_history`. `data` — сырой JSON AuditLog.
///
/// `saveAll` — полная замена для `container_id` (DELETE + INSERT):
/// история — append-only на сервере, при каждом `fetchHistory` онлайн
/// мы получаем полный список и перезаписываем кэш. Иначе старые записи
/// копились бы бесконечно.
///
/// `appendAll` (sync-fix-1) — дополнение без удаления. При инкрементальном
/// Pull (`updated_since`) приходят только свежие записи, и полная замена
/// стирала бы уже закэшированную историю тары.
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
    _putRows(batch, containerId, items);

    await batch.commit(noResult: true);
  }

  /// Дополнить кэш истории, не удаляя существующие записи (sync-fix-1).
  static Future<void> appendAll(
    int containerId,
    List<Map<String, dynamic>> items,
  ) async {
    if (items.isEmpty) return;
    final db = await AppDatabase.instance.database;
    final batch = db.batch();
    _putRows(batch, containerId, items);
    await batch.commit(noResult: true);
  }

  /// Общая вставка строк истории для `saveAll` и `appendAll`.
  static void _putRows(
    Batch batch,
    int containerId,
    List<Map<String, dynamic>> items,
  ) {
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
