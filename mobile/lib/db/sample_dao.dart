/// DAO для работы с кэшем проб (3.x-offline-sync c-1, c-9-fill-samples-offline).
library;

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'database.dart';

class SampleDao {
  static Future<void> saveAll(List<Map<String, dynamic>> rawList) async {
    final db = await AppDatabase.instance.database;
    final batch = db.batch();

    for (final json in rawList) {
      final id = json['id'] as int;
      final containerId = json['container'] as int;
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

  static Future<List<Map<String, dynamic>>> getByContainerId(
    int containerId,
  ) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'container_id = ?',
      whereArgs: [containerId],
      orderBy: 'id ASC',
    );

    return rows
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }

  static Future<void> saveLocalOffline({
    required int containerId,
    required List<Map<String, dynamic>> samples,
  }) async {
    if (samples.isEmpty) return;
    final db = await AppDatabase.instance.database;

    final minRows = await db.rawQuery(
      'SELECT MIN(id) AS min_id FROM samples WHERE container_id = ? AND id < 0',
      [containerId],
    );
    int nextId = (minRows.first['min_id'] as int?) ?? 0;

    final batch = db.batch();
    for (final s in samples) {
      nextId -= 1;
      final json = <String, dynamic>{
        'id': nextId,
        'container': containerId,
        'sample_number': s['sample_number'] as String? ?? '',
        'status': s['status'] as String? ?? 'PENDING_PLACEMENT',
        'well_name': s['well_name'],
        'research_type_name': s['research_type_name'] ?? '',
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      };
      batch.insert('samples', {
        'id': nextId,
        'container_id': containerId,
        'updated_at': json['updated_at'],
        'data': jsonEncode(json),
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  static Future<void> cleanupAfterPull(
    int containerId,
    Set<String> serverNumbers,
  ) async {
    if (serverNumbers.isEmpty) return;
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'container_id = ? AND id < 0',
      whereArgs: [containerId],
    );
    final toDelete = <int>[];
    for (final r in rows) {
      final json = jsonDecode(r['data'] as String) as Map<String, dynamic>;
      final num = json['sample_number'] as String?;
      if (num != null && serverNumbers.contains(num)) {
        toDelete.add(r['id'] as int);
      }
    }
    if (toDelete.isEmpty) return;
    final batch = db.batch();
    for (final id in toDelete) {
      batch.delete('samples', where: 'id = ?', whereArgs: [id]);
    }
    await batch.commit(noResult: true);
  }

  /// c-9-fill-samples-offline: удалить одну пробу по ID (для negative
  /// локальных, когда пользователь отменяет офлайн-филл).
  static Future<void> deleteById(int id) async {
    final db = await AppDatabase.instance.database;
    await db.delete('samples', where: 'id = ?', whereArgs: [id]);
  }
}
