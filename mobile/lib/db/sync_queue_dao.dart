import 'dart:convert';
import '../db/database.dart';

class SyncQueueItem {
  final int? id;
  final String action; // 'POST', 'PATCH', 'DELETE'
  final String endpoint; // '/samples/', '/storage/containers/'
  final Map<String, dynamic> payload;
  final String status; // 'PENDING', 'ERROR'
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
}