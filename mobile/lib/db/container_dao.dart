/// DAO для работы с кэшем тар (3.x-offline-sync c-1).
library;

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'database.dart';

class ContainerDao {
  /// Сохранить список тар в кэш (bulk insert/update).
  /// [data] — список сырых JSON с сервера.
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

  /// Получить тару по ID из кэша.
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

  /// Получить все тары (для списка).
  static Future<List<Map<String, dynamic>>> getAll() async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query('containers', orderBy: 'id DESC');
    return rows
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }

  /// Удалить тару из кэша (если сервер прислал удаление).
  static Future<void> deleteById(int id) async {
    final db = await AppDatabase.instance.database;
    await db.delete('containers', where: 'id = ?', whereArgs: [id]);
  }
}
