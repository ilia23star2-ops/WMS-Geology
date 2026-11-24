/// DAO для работы с кэшем тар (c-1, c-9-fill-offline-2a..-2c-3-fix-3a, c-2d-2, c-2d-2c-fix-1, c-8b).
///
/// conflict-pull-5: `saveAllMerged` — запись со слиянием по полям.
/// Старый `saveAll` пропускал записи с офлайн-правками, из-за чего
/// серверные изменения по ним не применялись вовсе.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';

import '../utils/record_batch_merge.dart';
import '../utils/sync_conflicts.dart';
import 'database.dart';

/// Готовит строки для таблицы `containers` (чистая, тестируется).
@visibleForTesting
List<Map<String, dynamic>> containerRowsForSave(
  List<Map<String, dynamic>> records,
) {
  final rows = <Map<String, dynamic>>[];
  for (final json in records) {
    final id = json['id'];
    if (id is! int) continue;
    final pending =
        (json['pending_sync'] as int?) ??
        (json['_pending_sync'] == true ? 1 : 0);
    rows.add(<String, dynamic>{
      'id': id,
      'updated_at': (json['updated_at'] as String?) ?? '',
      'pending_sync': pending,
      'data': jsonEncode(json),
    });
  }
  return rows;
}

class ContainerDao {
  static Future<void> saveAll(List<Map<String, dynamic>> rawList) async {
    // conflict-pull-6: пишем со слиянием, расхождения — человеку.
    final merged = await saveAllMerged(rawList);
    SyncConflicts.syncPage(
      'container',
      rawList.map((j) => j['id']).whereType<int>().toSet(),
      merged.conflicts,
    );
  }

  /// Запись со слиянием по полям (conflict-pull-5).
  ///
  /// Записи без офлайн-правок берутся серверными. С правками —
  /// объединяются: разные поля дополняют друг друга, спорные уходят
  /// в результат для человека, а своё значение остаётся в кэше.
  static Future<BatchMergeResult> saveAllMerged(
    List<Map<String, dynamic>> rawList,
  ) async {
    if (rawList.isEmpty) {
      return const BatchMergeResult(
        toSave: <Map<String, dynamic>>[],
        conflicts: <RecordConflict>[],
        autoMergedFields: 0,
      );
    }
    final db = await AppDatabase.instance.database;
    final ids = rawList.map((j) => j['id']).whereType<int>().toList();
    if (ids.isEmpty) {
      return BatchMergeResult(
        toSave: rawList,
        conflicts: const <RecordConflict>[],
        autoMergedFields: 0,
      );
    }
    final placeholders = List.filled(ids.length, '?').join(',');

    final localRows = await db.query(
      'containers',
      where: 'id IN ($placeholders)',
      whereArgs: ids,
    );
    final localById = <int, Map<String, dynamic>>{};
    final pendingIds = <int>{};
    for (final r in localRows) {
      final id = r['id'] as int;
      localById[id] = jsonDecode(r['data'] as String) as Map<String, dynamic>;
      if ((r['pending_sync'] as int? ?? 0) == 1) pendingIds.add(id);
    }

    final baseRows = await db.query(
      'sync_base',
      where: 'entity = ? AND id IN ($placeholders)',
      whereArgs: <Object>['container', ...ids],
    );
    final baseById = <int, Map<String, dynamic>>{};
    for (final r in baseRows) {
      baseById[r['id'] as int] =
          jsonDecode(r['data'] as String) as Map<String, dynamic>;
    }

    final merged = mergeBatch(
      entity: 'container',
      serverRecords: rawList,
      localById: localById,
      baseById: baseById,
      pendingIds: pendingIds,
      titleOf: (r) => (r['container_number'] as String?) ?? 'Тара #${r['id']}',
    );

    final batch = db.batch();
    for (final row in containerRowsForSave(merged.toSave)) {
      batch.insert(
        'containers',
        row,
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
    return merged;
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

  /// c-2d-2c-fix-1: локальное обновление места при офлайн-размещении.
  static Future<void> updateLocationLocal(
    int id, {
    required String status,
    int? cellId,
    String? cellFullAddress,
    int? floorRoomId,
    String? floorRoomName,
  }) async {
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
    json['cell_id'] = cellId;
    json['cell_full_address'] = cellFullAddress;
    json['floor_room'] = floorRoomId;
    json['floor_room_name'] = floorRoomName;
    json['pallet'] = null;
    json['updated_at'] = DateTime.now().toUtc().toIso8601String();
    await db.update(
      'containers',
      {'data': jsonEncode(json)},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// c-8b: локальное обновление шапки тары при офлайн-`update`.
  /// `fields` — серверные поля (`container_number`, `container_type`,
  /// `comment`, `position_on_pallet`, `draft_site`, `draft_research_type`,
  /// `draft_work_order_coded`, `draft_work_order_incoming`).
  /// Мержит `fields` в JSON, обновляет `updated_at`.
  /// `_pending_sync` не трогает (это делает `setPendingSync`).
  static Future<void> updateFieldsLocal(
    int id,
    Map<String, dynamic> fields,
  ) async {
    if (fields.isEmpty) return;
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
    for (final e in fields.entries) {
      json[e.key] = e.value;
    }
    json['updated_at'] = DateTime.now().toUtc().toIso8601String();
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

  /// c-2d-2: перемапить PK тары `oldId → newId` после `bulk-create`.
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
