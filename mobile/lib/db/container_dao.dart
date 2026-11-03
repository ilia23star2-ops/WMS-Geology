/// DAO для работы с кэшем тар (3.x-offline-sync c-1, c-9-fill-samples-offline-2a).
///
/// - `saveAll` — upsert серверных тар.
/// - `getById` / `getAll` / `deleteById` — чтение / удаление.
/// - `updateNumberLocal` — обновить `container_number` в локальном JSON
///   (офлайн-филл, номер присвоен локально, сервер ещё не знает).
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
    return jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
  }

  static Future<List<Map<String, dynamic>>> getAll() async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query('containers', orderBy: 'id DESC');
    return rows
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }

  static Future<void> deleteById(int id) async {
    final db = await AppDatabase.instance.database;
    await db.delete('containers', where: 'id = ?', whereArgs: [id]);
  }

  /// c-9-fill-samples-offline-2a: обновить `container_number` в локальном
  /// JSON тары. Нужно после офлайн-филла, где номер введён пользователем,
  /// но на сервер ушёл только в payload очереди. Без этого карточка
  /// показывает «Заготовка» до Pull.
  ///
  /// Ничего не делает, если тары нет в кэше или `number` пустой.
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
}
