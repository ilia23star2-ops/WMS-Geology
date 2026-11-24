/// Снимки записей на момент прошлой синхронизации (conflict-base-2).
///
/// Снимок — «что было на сервере, когда мы последний раз синхронизировались».
/// По нему слияние понимает, кто менял поле: планшет, сервер или оба.
/// Без снимка любой разнобой приходится отдавать человеку.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';

import 'database.dart';

/// Локальные флаги в снимок не входят: они не серверные данные.
const Set<String> kSnapshotVolatileFields = <String>{
  'pending_sync',
  '_pending_sync',
};

/// Готовит снимок из записи: убирает локальные флаги, не меняя исходник.
@visibleForTesting
Map<String, dynamic> snapshotOf(Map<String, dynamic> record) {
  final out = <String, dynamic>{};
  for (final entry in record.entries) {
    if (kSnapshotVolatileFields.contains(entry.key)) continue;
    out[entry.key] = entry.value;
  }
  return out;
}

class SyncBaseDao {
  /// Записать снимки пачкой (вызывается при pull).
  static Future<void> saveAll(
    String entity,
    List<Map<String, dynamic>> items,
  ) async {
    if (items.isEmpty) return;
    final db = await AppDatabase.instance.database;
    final batch = db.batch();
    for (final item in items) {
      final id = item['id'];
      if (id is! int) continue;
      batch.insert('sync_base', {
        'entity': entity,
        'id': id,
        'base_updated_at': item['updated_at'] as String?,
        'data': jsonEncode(snapshotOf(item)),
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  /// Снимок записи или null, если его ещё нет.
  static Future<Map<String, dynamic>?> get(String entity, int id) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'sync_base',
      where: 'entity = ? AND id = ?',
      whereArgs: [entity, id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
  }

  /// Убрать снимок удалённой записи.
  static Future<void> delete(String entity, int id) async {
    final db = await AppDatabase.instance.database;
    await db.delete(
      'sync_base',
      where: 'entity = ? AND id = ?',
      whereArgs: [entity, id],
    );
  }
}
