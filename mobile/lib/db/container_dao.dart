/// DAO для работы с кэшем тар (c-1, c-9-fill-offline-2a..-2c-3-fix-3a, c-2d-2).
library;

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'database.dart';

class ContainerDao {
  static Future<void> saveAll(List<Map<String, dynamic>> rawList) async {
    final db = await AppDatabase.instance.database;
    final batch = db.batch();

    for (final json in rawList) {
      final id = json['id'] as int;
      final updatedAt = (json['updated_at'] as String?) ?? '';

      batch.insert('containers', {
        'id': id,
        'updated_at': updatedAt,
        'pending_sync': 0,
        'data': jsonEncode(json),
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }

    await batch.commit(noResult: true);
  }

  static Future<Map<String, dynamic>?> getById(int id) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'containers',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (rows.isEmpty) return null;
    final data =
        jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
    data['_pending_sync'] = (rows.first['pending_sync'] as int? ?? 0) == 1;
    return data;
  }

  static Future<List<Map<String, dynamic>>> getAll() async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query('containers', orderBy: 'id DESC');
    return rows.map((r) {
      final data = jsonDecode(r['data'] as String) as Map<String, dynamic>;
      data['_pending_sync'] = (r['pending_sync'] as int? ?? 0) == 1;
      return data;
    }).toList();
  }

  static Future<void> deleteById(int id) async {
    final db = await AppDatabase.instance.database;
    await db.delete('containers', where: 'id = ?', whereArgs: [id]);
  }

  static Future<void> updateNumberLocal(int id, String number) async {
    final trimmed = number.trim();
    if (trimmed.isEmpty) return;
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'containers',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (rows.isEmpty) return;
    final json =
        jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
    json['container_number'] = trimmed;
    await db.update(
      'containers',
      {'data': jsonEncode(json)},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> updateStatusLocal(int id, String status) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'containers',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (rows.isEmpty) return;
    final json =
        jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
    json['status'] = status;
    await db.update(
      'containers',
      {'data': jsonEncode(json)},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> setPendingSync(int id, bool pending) async {
    final db = await AppDatabase.instance.database;
    await db.update(
      'containers',
      {'pending_sync': pending ? 1 : 0},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> clearPendingSync(int id) async {
    await setPendingSync(id, false);
  }

  /// c-9-fill-offline-2c-3-fix-3a: reconcile.
  ///
  /// Для всех тар с `pending_sync = 1`, которых **нет** в
  /// [keepContainerIds] (есть запись в `sync_queue`) — сбрасываем флаг.
  static Future<int> reconcilePendingContainers(
    Set<int> keepContainerIds,
  ) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query('containers', where: 'pending_sync = 1');
    var cleared = 0;
    final batch = db.batch();
    for (final r in rows) {
      final id = r['id'] as int;
      if (keepContainerIds.contains(id)) continue;
      batch.update(
        'containers',
        {'pending_sync': 0},
        where: 'id = ?',
        whereArgs: [id],
      );
      cleared++;
    }
    if (cleared == 0) return 0;
    await batch.commit(noResult: true);
    return cleared;
  }

  /// c-2d-2: перемапить PK тары `oldId → newId` после успешного
  /// `bulk-create`. Если записи с `oldId` нет — no-op.
  /// Флаг `pending_sync` сохраняется.
  static Future<void> remapId(int oldId, int newId) async {
    if (oldId == newId) return;
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'containers',
      where: 'id = ?',
      whereArgs: [oldId],
      limit: 1,
    );
    if (rows.isEmpty) return;

    final row = rows.first;
    final data = jsonDecode(row['data'] as String) as Map<String, dynamic>;
    data['id'] = newId;

    final pending = (row['pending_sync'] as int? ?? 0);
    final updatedAt = (row['updated_at'] as String?) ?? '';

    final batch = db.batch();
    batch.delete('containers', where: 'id = ?', whereArgs: [oldId]);
    batch.insert('containers', {
      'id': newId,
      'updated_at': updatedAt,
      'pending_sync': pending,
      'data': jsonEncode(data),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
    await batch.commit(noResult: true);
  }
}
