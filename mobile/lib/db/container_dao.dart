/// DAO для работы с кэшем тар (c-1, c-9-fill-samples-offline-2a, -2b).
///
/// - `saveAll` — upsert серверных тар, `pending_sync = 0` (сервер = синхронизировано).
/// - `getById` / `getAll` — читают JSON + добавляют `_pending_sync: bool`.
/// - `updateNumberLocal` — 2a: обновить `container_number`.
/// - `updateStatusLocal` — 2a-fix: обновить `status`.
/// - `setPendingSync` — 2b: флаг «есть несинхронизированные изменения».
library;

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'database.dart';

class ContainerDao {
  /// Upsert серверных тар. `pending_sync = 0` — Pull = серверная правда.
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

  /// 2a: обновить `container_number` в локальном JSON тары.
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

  /// 2a-fix: обновить `status` в локальном JSON тары.
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

  /// 2b: поставить/снять флаг «не синхронизировано».
  static Future<void> setPendingSync(int id, bool pending) async {
    final db = await AppDatabase.instance.database;
    await db.update(
      'containers',
      {'pending_sync': pending ? 1 : 0},
      where: 'id = ?',
      whereArgs: [id],
    );
  }
}
