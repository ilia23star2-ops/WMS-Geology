/// DAO очереди синхронизации (c-3, c-9-fill-offline-2c-1).
///
/// - `enqueue` / `getPending` / `markAsSynced` / `markAsError` / `resetErrors`.
/// - `getPayloadByEndpoint` — найти payload по endpoint + POST (для
///   пересборки после офлайн-редактирования проб).
/// - `updatePayloadByEndpoint` — заменить payload у существующей записи
///   (endpoint + POST, любой статус). Возвращает `true`, если нашли.
library;

import 'dart:convert';

import '../db/database.dart';

class SyncQueueItem {
  final int? id;
  final String action;
  final String endpoint;
  final Map<String, dynamic> payload;
  final String status;
  final String? errorMessage;
  final String createdAt;

  SyncQueueItem({
    this.id,
    required this.action,
    required this.endpoint,
    required this.payload,
    this.status = 'PENDING',
    this.errorMessage,
    required this.createdAt,
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
    );
  }
}

class SyncQueueDao {
  static Future<void> enqueue({
    required String action,
    required String endpoint,
    required Map<String, dynamic> payload,
  }) async {
    final db = await AppDatabase.instance.database;
    final item = SyncQueueItem(
      action: action,
      endpoint: endpoint,
      payload: payload,
      createdAt: DateTime.now().toUtc().toIso8601String(),
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

  /// c-9-fill-offline-2c-1: прочитать payload существующей записи
  /// (`action = 'POST'`, `endpoint`). Нужно для пересборки `sample_groups`
  /// при офлайн-редактировании проб: остальные поля (work_order_coded,
  /// research_type_id, site_id, container_number) сохраняются.
  ///
  /// Возвращает `null`, если записи нет.
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

  /// c-9-fill-offline-2c-1: заменить payload у существующей записи
  /// (`action = 'POST'`, `endpoint`). Статус (PENDING / ERROR) не меняется.
  ///
  /// Возвращает `true`, если нашли и обновили. `false` — записи нет
  /// (например, она уже ушла в Push или была удалена).
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
}
