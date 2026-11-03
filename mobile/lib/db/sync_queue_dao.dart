/// DAO очереди синхронизации (c-3, c-9-fill-offline-2c-1, -2c-3, -2c-3-fix-2, -fix-3a, c-2d-2).
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../db/database.dart';

class SyncQueueItem {
  final int? id;
  final String action;
  final String endpoint;
  final Map<String, dynamic> payload;
  final String status;
  final String? errorMessage;
  final String createdAt;
  final String? localRef; // c-2d-2: локальные ID для маппинга

  SyncQueueItem({
    this.id,
    required this.action,
    required this.endpoint,
    required this.payload,
    this.status = 'PENDING',
    this.errorMessage,
    required this.createdAt,
    this.localRef,
  });

  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'action': action,
      'endpoint': endpoint,
      'payload': jsonEncode(payload),
      'status': status,
      'error_message': errorMessage,
      'created_at': createdAt,
      'local_ref': localRef,
    };
  }

  factory SyncQueueItem.fromMap(Map<String, dynamic> map) {
    return SyncQueueItem(
      id: map['id'] as int?,
      action: map['action'] as String,
      endpoint: map['endpoint'] as String,
      payload: jsonDecode(map['payload'] as String) as Map<String, dynamic>,
      status: map['status'] as String,
      errorMessage: map['error_message'] as String?,
      createdAt: map['created_at'] as String,
      localRef: map['local_ref'] as String?,
    );
  }
}

class SyncQueueDao {
  static Future<void> enqueue({
    required String action,
    required String endpoint,
    required Map<String, dynamic> payload,
    String? localRef, // c-2d-2
  }) async {
    final db = await AppDatabase.instance.database;
    final item = SyncQueueItem(
      action: action,
      endpoint: endpoint,
      payload: payload,
      createdAt: DateTime.now().toUtc().toIso8601String(),
      localRef: localRef,
    );
    await db.insert('sync_queue', item.toMap());
  }

  static Future<List<SyncQueueItem>> getPending() async {
    final db = await AppDatabase.instance.database;
    final maps = await db.query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: ['PENDING'],
      orderBy: 'created_at ASC',
    );
    return maps.map((map) => SyncQueueItem.fromMap(map)).toList();
  }

  /// c-9-fill-offline-2c-3-fix-3a: **все** записи (PENDING + ERROR).
  static Future<List<SyncQueueItem>> getAll() async {
    final db = await AppDatabase.instance.database;
    final maps = await db.query('sync_queue', orderBy: 'created_at ASC');
    return maps.map((map) => SyncQueueItem.fromMap(map)).toList();
  }

  static Future<void> markAsSynced(int id) async {
    final db = await AppDatabase.instance.database;
    await db.delete('sync_queue', where: 'id = ?', whereArgs: [id]);
  }

  static Future<void> markAsError(int id, String error) async {
    final db = await AppDatabase.instance.database;
    await db.update(
      'sync_queue',
      {'status': 'ERROR', 'error_message': error},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> resetErrors() async {
    final db = await AppDatabase.instance.database;
    await db.update(
      'sync_queue',
      {'status': 'PENDING', 'error_message': null},
      where: 'status = ?',
      whereArgs: ['ERROR'],
    );
  }

  static Future<Map<String, dynamic>?> getPayloadByEndpoint(
    String endpoint,
  ) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'sync_queue',
      where: 'endpoint = ? AND action = ?',
      whereArgs: [endpoint, 'POST'],
      orderBy: 'created_at DESC',
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return jsonDecode(rows.first['payload'] as String) as Map<String, dynamic>;
  }

  static Future<bool> updatePayloadByEndpoint(
    String endpoint,
    Map<String, dynamic> payload,
  ) async {
    final db = await AppDatabase.instance.database;
    final count = await db.update(
      'sync_queue',
      {'payload': jsonEncode(payload)},
      where: 'endpoint = ? AND action = ?',
      whereArgs: [endpoint, 'POST'],
    );
    return count > 0;
  }

  /// c-2d-2: после успешного `bulk-create` перемапить negative ID
  /// во **всех** записях очереди (PENDING + ERROR).
  ///
  /// Меняет `payload` (`container_id`, `container_ids[]`,
  /// `containers[].id`) и `local_ref` (int-строка, JSON-массив).
  /// Идемпотентно: ключей нет в [mapping] — не трогаем.
  static Future<void> remapAllLocalRefs(Map<int, int> mapping) async {
    if (mapping.isEmpty) return;
    final db = await AppDatabase.instance.database;
    final rows = await db.query('sync_queue');
    if (rows.isEmpty) return;

    final batch = db.batch();
    for (final row in rows) {
      final payloadRaw = row['payload'] as String;
      final localRefRaw = row['local_ref'] as String?;
      final payload = jsonDecode(payloadRaw) as Map<String, dynamic>;
      remapInPlace(payload, mapping);
      final newLocalRef = remapLocalRef(localRefRaw, mapping);
      batch.update(
        'sync_queue',
        {'payload': jsonEncode(payload), 'local_ref': newLocalRef},
        where: 'id = ?',
        whereArgs: [row['id']],
      );
    }
    await batch.commit(noResult: true);
  }

  /// c-2d-2: перемапить ключи в payload in-place.
  /// Обрабатывает `container_id`, `container_ids[]`, `containers[].id`.
  @visibleForTesting
  static void remapInPlace(
    Map<String, dynamic> payload,
    Map<int, int> mapping,
  ) {
    final cid = payload['container_id'];
    if (cid is int && mapping.containsKey(cid)) {
      payload['container_id'] = mapping[cid];
    }

    final cids = payload['container_ids'];
    if (cids is List) {
      payload['container_ids'] = cids
          .map((v) => (v is int && mapping.containsKey(v)) ? mapping[v] : v)
          .toList();
    }

    final containers = payload['containers'];
    if (containers is List) {
      for (final c in containers) {
        if (c is Map<String, dynamic>) {
          final id = c['id'];
          if (id is int && mapping.containsKey(id)) {
            c['id'] = mapping[id];
          }
        }
      }
    }
  }

  /// c-2d-2: перемапить `local_ref`.
  ///
  /// Поддерживает:
  /// - int-строку (`"-1"` → `"42"`);
  /// - JSON-массив int (`"[-1,-2]"` → `"[42,43]"`).
  ///
  /// Прочее (null, невалидный JSON, нет ключей) — без изменений.
  @visibleForTesting
  static String? remapLocalRef(String? localRef, Map<int, int> mapping) {
    if (localRef == null || mapping.isEmpty) return localRef;

    final asInt = int.tryParse(localRef);
    if (asInt != null) {
      return mapping.containsKey(asInt) ? mapping[asInt].toString() : localRef;
    }

    try {
      final parsed = jsonDecode(localRef);
      if (parsed is List) {
        final mapped = parsed
            .map((v) => (v is int && mapping.containsKey(v)) ? mapping[v] : v)
            .toList();
        return jsonEncode(mapped);
      }
    } catch (_) {
      // не JSON — оставляем как есть
    }
    return localRef;
  }
}
