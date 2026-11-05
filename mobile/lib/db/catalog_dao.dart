/// DAO кэша справочников (c-7-offline-catalog, c-8-catalog-create-offline).
///
/// Хранит `{kind, id, parent_id, data}` в таблице `catalog`.
/// `data` — сырой JSON с сервера, чтобы `*fromJson` могли его распарсить
/// и онлайн, и офлайн одинаково.
///
/// c-8-catalog-create-offline:
/// - `saveLocalOffline(kind, payload)` — negative ID + `_pending_sync = true`.
/// - `remapId(kind, oldId, newId)` — после Push (negative → server).
/// - `setPendingSync` / `clearPendingSync` — флаг `_pending_sync` в JSON.
/// - `reconcilePendingCatalog(keepIds)` — сброс флага, если записи в
///   `sync_queue` нет.
library;

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'database.dart';

/// Извлечь ID родителя из JSON справочника.
int? catalogParentId(String kind, Map<String, dynamic> json) {
  final fields = switch (kind) {
    'rack' => const ['room', 'room_id'],
    'section' => const ['rack', 'rack_id'],
    'tier' => const ['section', 'section_id'],
    'cell' => const ['tier', 'tier_id'],
    _ => const <String>[],
  };
  for (final f in fields) {
    final v = json[f];
    if (v is int) return v;
  }
  return null;
}

class CatalogDao {
  /// Сохранить список справочника (upsert по `(kind, id)`).
  ///
  /// **Не трогает** `_pending_sync` в JSON. Если сервер вернул запись,
  /// которая есть в кэше офлайн (`_pending_sync = true`), она будет
  /// перезаписана серверной версией — это нормально после успешного Push.
  /// Но `reconcile` вызывается раньше, поэтому `_pending_sync` ещё
  /// актуален. Специально оставляем replace как есть — reconcile
  /// закроет флаг до или после.
  static Future<void> saveAll(
    String kind,
    List<Map<String, dynamic>> items, {
    int? parentId,
  }) async {
    final db = await AppDatabase.instance.database;
    final batch = db.batch();

    for (final json in items) {
      final id = json['id'] as int;
      final parent = parentId ?? catalogParentId(kind, json);
      batch.insert('catalog', {
        'kind': kind,
        'id': id,
        'parent_id': parent,
        'data': jsonEncode(json),
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }

    await batch.commit(noResult: true);
  }

  /// c-8-catalog-create-offline: сохранить офлайн-созданный справочник
  /// с negative ID. Возвращает этот ID.
  ///
  /// `payload` — то, что ушло бы на сервер (`code`, `name`, ...).
  /// В `data` кладём `{...payload, 'id': negativeId, '_pending_sync': true}`.
  static Future<int> saveLocalOffline(
    String kind,
    Map<String, dynamic> payload,
  ) async {
    final db = await AppDatabase.instance.database;
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    // Уникальный negative ID в рамках всей таблицы catalog (rowid не
    // играет роли — `(kind, id)` составной PK, но `id` у нас уникален
    // глобально, чтобы remapId не путался).
    final existingRows = await db.rawQuery(
      'SELECT MIN(id) AS min_id FROM catalog WHERE id < 0',
    );
    final currentMin = (existingRows.first['min_id'] as int?) ?? 0;
    final negativeId = currentMin <= -now ? currentMin - 1 : -now;

    final data = <String, dynamic>{
      ...payload,
      'id': negativeId,
      '_pending_sync': true,
    };
    await db.insert('catalog', {
      'kind': kind,
      'id': negativeId,
      'parent_id': catalogParentId(kind, payload),
      'data': jsonEncode(data),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
    return negativeId;
  }

  /// Все записи справочника.
  static Future<List<Map<String, dynamic>>> getAll(String kind) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'catalog',
      where: 'kind = ?',
      whereArgs: [kind],
      orderBy: 'id ASC',
    );
    return rows
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }

  /// Записи справочника по родителю (для topology).
  static Future<List<Map<String, dynamic>>> getByParent(
    String kind,
    int parentId,
  ) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'catalog',
      where: 'kind = ? AND parent_id = ?',
      whereArgs: [kind, parentId],
      orderBy: 'id ASC',
    );
    return rows
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }

  /// c-8-catalog-create-offline: одна запись по `(kind, id)`.
  static Future<Map<String, dynamic>?> getById(String kind, int id) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'catalog',
      where: 'kind = ? AND id = ?',
      whereArgs: [kind, id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
  }

  /// c-8-catalog-create-offline: перемапить PK `oldId → newId` для
  /// `(kind, oldId)`. Меняет `data['id']`, удаляет старую запись,
  /// вставляет с новым ID. `_pending_sync` сохраняется (не сбрасываем —
  /// этим занимается `SyncPusher` после успешного ответа сервера).
  static Future<void> remapId(String kind, int oldId, int newId) async {
    if (oldId == newId) return;
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'catalog',
      where: 'kind = ? AND id = ?',
      whereArgs: [kind, oldId],
      limit: 1,
    );
    if (rows.isEmpty) return;

    final data =
        jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
    data['id'] = newId;
    final parentId = rows.first['parent_id'] as int?;

    final batch = db.batch();
    batch.delete(
      'catalog',
      where: 'kind = ? AND id = ?',
      whereArgs: [kind, oldId],
    );
    batch.insert('catalog', {
      'kind': kind,
      'id': newId,
      'parent_id': parentId,
      'data': jsonEncode(data),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
    await batch.commit(noResult: true);
  }

  /// c-8-catalog-create-offline: установить `_pending_sync` в JSON записи.
  static Future<void> setPendingSync(String kind, int id, bool pending) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'catalog',
      where: 'kind = ? AND id = ?',
      whereArgs: [kind, id],
      limit: 1,
    );
    if (rows.isEmpty) return;
    final data =
        jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
    data['_pending_sync'] = pending;
    await db.update(
      'catalog',
      {'data': jsonEncode(data)},
      where: 'kind = ? AND id = ?',
      whereArgs: [kind, id],
    );
  }

  /// c-8-catalog-create-offline: снять `_pending_sync` у всех записей
  /// `kind`, которых нет в `keepIds`. `keepIds` — negative ID из
  /// `sync_queue.local_ref` (для этого `kind`).
  static Future<int> reconcilePendingCatalog(
    String kind,
    Set<int> keepIds,
  ) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'catalog',
      where: 'kind = ? AND id < 0',
      whereArgs: [kind],
    );
    var cleared = 0;
    final batch = db.batch();
    for (final r in rows) {
      final id = r['id'] as int;
      if (keepIds.contains(id)) continue;
      final data = jsonDecode(r['data'] as String) as Map<String, dynamic>;
      if (data['_pending_sync'] != true) continue;
      data['_pending_sync'] = false;
      batch.update(
        'catalog',
        {'data': jsonEncode(data)},
        where: 'kind = ? AND id = ?',
        whereArgs: [kind, id],
      );
      cleared++;
    }
    if (cleared == 0) return 0;
    await batch.commit(noResult: true);
    return cleared;
  }

  /// Полная очистка справочника (для будущего полного рефреша, сейчас
  /// не используется — Pull делает upsert).
  static Future<void> deleteByKind(String kind) async {
    final db = await AppDatabase.instance.database;
    await db.delete('catalog', where: 'kind = ?', whereArgs: [kind]);
  }
}
