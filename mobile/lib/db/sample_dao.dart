/// DAO для работы с кэшем проб (c-1, c-9-fill-offline-2c-1..2c-4, c-9-natural-sort, c-2d-2).
///
/// c-9-natural-sort: `getByContainerId` сортирует по `sample_number`
/// естественным образом (`TST6701 < TST6710`), а не по `id`.
///
/// conflict-samples-12: `saveAll` пишет со слиянием полей. Раньше записи
/// с офлайн-правками пропускались, и серверные изменения по ним не
/// применялись вовсе.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';

import '../utils/natural_sort.dart';
import '../utils/record_batch_merge.dart';
import '../utils/sync_conflicts.dart';
import 'database.dart';

/// Готовит строки для таблицы `samples` (чистая, тестируется).
///
/// Слияние помечает правки полем `pending_sync` (стиль тары), а у проб
/// флаг живёт в JSON как `_pending_sync` — здесь переводим.
@visibleForTesting
List<Map<String, dynamic>> sampleRowsForSave(
  List<Map<String, dynamic>> records,
) {
  final rows = <Map<String, dynamic>>[];
  for (final json in records) {
    final id = json['id'];
    if (id is! int) continue;
    final data = Map<String, dynamic>.from(json);
    final mergedFlag = data.remove('pending_sync');
    if (mergedFlag == 1 || mergedFlag == true) {
      data['_pending_sync'] = true;
    }
    rows.add(<String, dynamic>{
      'id': id,
      'container_id': data['container'],
      'updated_at': (data['updated_at'] as String?) ?? '',
      'data': jsonEncode(data),
    });
  }
  return rows;
}

class SampleDao {
  static Future<void> saveAll(List<Map<String, dynamic>> rawList) async {
    final merged = await saveAllMerged(rawList);
    SyncConflicts.syncPage(
      'sample',
      rawList.map((j) => j['id']).whereType<int>().toSet(),
      merged.conflicts,
    );
  }

  /// Запись со слиянием по полям (conflict-samples-12).
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
      'samples',
      where: 'id IN ($placeholders)',
      whereArgs: ids,
    );
    final localById = <int, Map<String, dynamic>>{};
    final pendingIds = <int>{};
    for (final r in localRows) {
      final id = r['id'] as int;
      final json = jsonDecode(r['data'] as String) as Map<String, dynamic>;
      localById[id] = json;
      if (json['_pending_sync'] == true) pendingIds.add(id);
    }

    final baseRows = await db.query(
      'sync_base',
      where: 'entity = ? AND id IN ($placeholders)',
      whereArgs: <Object>['sample', ...ids],
    );
    final baseById = <int, Map<String, dynamic>>{};
    for (final r in baseRows) {
      baseById[r['id'] as int] =
          jsonDecode(r['data'] as String) as Map<String, dynamic>;
    }

    final merged = mergeBatch(
      entity: 'sample',
      serverRecords: rawList,
      localById: localById,
      baseById: baseById,
      pendingIds: pendingIds,
      titleOf: (r) => (r['sample_number'] as String?) ?? 'Проба #${r['id']}',
    );

    final batch = db.batch();
    for (final row in sampleRowsForSave(merged.toSave)) {
      batch.insert(
        'samples',
        row,
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
    return merged;
  }

  /// Проба по id или null (conflict-samples-12).
  static Future<Map<String, dynamic>?> getById(int id) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
  }

  /// Все пробы тары, отсортированные по `sample_number`
  /// естественным образом (`TST6701 < TST6702 < ... < TST6710`).
  static Future<List<Map<String, dynamic>>> getByContainerId(
    int containerId,
  ) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'container_id = ?',
      whereArgs: [containerId],
    );

    final decoded = rows
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
    decoded.sort(naturalCompareSampleNumber);
    return decoded;
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
        'site_name': s['site_name'] ?? '',
        '_prefix': s['_prefix'] ?? '',
        '_middle': s['_middle'] ?? '',
        '_sequence': s['_sequence'] ?? 0,
        '_sequence_digits': s['_sequence_digits'] ?? 3,
        '_well_name': s['_well_name'],
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

  static Future<void> deleteById(int id) async {
    final db = await AppDatabase.instance.database;
    await db.delete('samples', where: 'id = ?', whereArgs: [id]);
  }

  static Future<List<Map<String, dynamic>>> getLocalNegativeByContainer(
    int containerId,
  ) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'container_id = ? AND id < 0',
      whereArgs: [containerId],
      orderBy: 'id ASC',
    );
    return rows
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }

  static Future<void> updateLocalStatus(int sampleId, String status) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'id = ?',
      whereArgs: [sampleId],
      limit: 1,
    );
    if (rows.isEmpty) return;
    final json =
        jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
    json['status'] = status;
    if (sampleId > 0) {
      json['_pending_sync'] = true;
    }
    await db.update(
      'samples',
      {'data': jsonEncode(json)},
      where: 'id = ?',
      whereArgs: [sampleId],
    );
  }

  static Future<void> updateLocalFields(
    int sampleId,
    Map<String, dynamic> fields,
  ) async {
    if (fields.isEmpty) return;
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'id = ?',
      whereArgs: [sampleId],
      limit: 1,
    );
    if (rows.isEmpty) return;
    final json =
        jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
    for (final entry in fields.entries) {
      json[entry.key] = entry.value;
    }
    await db.update(
      'samples',
      {'data': jsonEncode(json)},
      where: 'id = ?',
      whereArgs: [sampleId],
    );
  }

  static Future<void> setPendingSyncLocal(int sampleId, bool pending) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'id = ?',
      whereArgs: [sampleId],
      limit: 1,
    );
    if (rows.isEmpty) return;
    final json =
        jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
    json['_pending_sync'] = pending;
    await db.update(
      'samples',
      {'data': jsonEncode(json)},
      where: 'id = ?',
      whereArgs: [sampleId],
    );
  }

  static Future<bool> hasPendingForContainer(int containerId) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'container_id = ?',
      whereArgs: [containerId],
    );
    for (final r in rows) {
      final json = jsonDecode(r['data'] as String) as Map<String, dynamic>;
      if (json['_pending_sync'] == true) return true;
    }
    return false;
  }

  static Future<void> clearPendingSyncBySampleId(int sampleId) async {
    if (sampleId <= 0) return;
    await setPendingSyncLocal(sampleId, false);
  }

  static Future<int> reconcilePendingSamples(Set<int> keepSampleIds) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query('samples');
    var cleared = 0;
    final batch = db.batch();
    for (final r in rows) {
      final json = jsonDecode(r['data'] as String) as Map<String, dynamic>;
      if (json['_pending_sync'] != true) continue;
      final id = r['id'] as int;
      if (keepSampleIds.contains(id)) continue;
      json['_pending_sync'] = false;
      batch.update(
        'samples',
        {'data': jsonEncode(json)},
        where: 'id = ?',
        whereArgs: [id],
      );
      cleared++;
    }
    if (cleared == 0) return 0;
    await batch.commit(noResult: true);
    return cleared;
  }

  /// c-2d-2: перемапить `container_id` у всех проб после `bulk-create`.
  /// Меняет и колонку, и JSON-поле `container`. `_pending_sync` сохраняется.
  static Future<void> remapContainerId(
    int oldContainerId,
    int newContainerId,
  ) async {
    if (oldContainerId == newContainerId) return;
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'samples',
      where: 'container_id = ?',
      whereArgs: [oldContainerId],
    );
    if (rows.isEmpty) return;

    final batch = db.batch();
    for (final r in rows) {
      final json = jsonDecode(r['data'] as String) as Map<String, dynamic>;
      json['container'] = newContainerId;
      batch.update(
        'samples',
        {'container_id': newContainerId, 'data': jsonEncode(json)},
        where: 'id = ?',
        whereArgs: [r['id']],
      );
    }
    await batch.commit(noResult: true);
  }
}
