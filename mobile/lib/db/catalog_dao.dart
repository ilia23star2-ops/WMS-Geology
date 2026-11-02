/// DAO кэша справочников (c-7-offline-catalog).
///
/// Хранит `{kind, id, parent_id, data}` в таблице `catalog`.
/// `data` — сырой JSON с сервера, чтобы `*fromJson` могли его распарсить
/// и онлайн, и офлайн одинаково.
///
/// `parent_id` нужен для офлайн-фильтрации топологии в каскаде
/// (`fetchRacks(roomId)` → `getByParent('rack', roomId)`).
/// Для верхнеуровневых справочников (`room`, `site`, `research_type`,
/// `laboratory`, `container_type`) — `NULL`.
library;

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'database.dart';

/// Извлечь ID родителя из JSON справочника.
///
/// Имена полей — по DRF-конвенции, пробуем оба варианта (`room` / `room_id`),
/// чтобы быть устойчивыми к стилю сериализатора. Если не нашли — `null`
/// (для верхнеуровневых справочников это нормально; для topology —
/// означает, что фильтр по родителю офлайн вернёт пусто, но онлайн
/// всё работает).
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
  /// `parentId` — явный ID родителя (для онлайн-фетча с фильтром, когда
  /// сервер уже отфильтровал и в JSON может не быть поля). Если `null` —
  /// пытаемся извлечь из JSON через [catalogParentId].
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

  /// Полная очистка справочника (для будущего полного рефреша, сейчас
  /// не используется — Pull делает upsert).
  static Future<void> deleteByKind(String kind) async {
    final db = await AppDatabase.instance.database;
    await db.delete('catalog', where: 'kind = ?', whereArgs: [kind]);
  }
}
