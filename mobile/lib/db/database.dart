/// Локальная SQLite (3.x-offline).
///
/// Версия 9 (conflict-base-2): +таблица `sync_base` — снимки записей
/// на момент последней синхронизации, нужны для слияния по полям.
///
/// **Миграция v8 → v9:** только `CREATE TABLE sync_base`. Данные сохраняем.
library;

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class AppDatabase {
  static final AppDatabase instance = AppDatabase._();
  AppDatabase._();

  static Database? _database;
  static const String _dbName = 'wms_geology.db';

  static const int _dbVersion = 9;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  static Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);

    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: (db, version) async {
        await _createTables(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        // v < 6: полное пересоздание (до офлайн-филла, терять нечего).
        if (oldVersion < 6) {
          await db.execute('DROP TABLE IF EXISTS containers');
          await db.execute('DROP TABLE IF EXISTS samples');
          await db.execute('DROP TABLE IF EXISTS catalog');
          await db.execute('DROP TABLE IF EXISTS container_history');
          await db.execute('DROP TABLE IF EXISTS sync_queue');
          await _createTables(db);
          return;
        }
        // v6 → v7: только ALTER, данные сохраняем.
        if (oldVersion < 7) {
          await db.execute(
            'ALTER TABLE containers ADD COLUMN '
            'pending_sync INTEGER NOT NULL DEFAULT 0',
          );
        }
        // v7 → v8: local_ref в sync_queue.
        if (oldVersion < 8) {
          await db.execute('ALTER TABLE sync_queue ADD COLUMN local_ref TEXT');
        }
        // v8 → v9: снимки для слияния. Только CREATE, данные целы.
        if (oldVersion < 9) {
          await _createSyncBase(db);
        }
      },
    );
  }

  static Future<void> _createTables(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS containers (
        id INTEGER PRIMARY KEY,
        updated_at TEXT,
        pending_sync INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS samples (
        id INTEGER PRIMARY KEY,
        container_id INTEGER,
        updated_at TEXT,
        data TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        created_at TEXT NOT NULL,
        local_ref TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS catalog (
        kind TEXT NOT NULL,
        id INTEGER NOT NULL,
        parent_id INTEGER,
        data TEXT NOT NULL,
        PRIMARY KEY (kind, id)
      )
    ''');
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_catalog_kind_parent '
      'ON catalog (kind, parent_id)',
    );
    await db.execute('''
      CREATE TABLE IF NOT EXISTS container_history (
        container_id INTEGER NOT NULL,
        id INTEGER NOT NULL,
        created_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (container_id, id)
      )
    ''');
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_history_container '
      'ON container_history (container_id)',
    );
    await _createSyncBase(db);
  }

  /// Снимки записей на момент прошлой синхронизации (conflict-base-2).
  ///
  /// Отдельная таблица, а не колонка в `containers`: `saveAll` пишет
  /// строку через `ConflictAlgorithm.replace` и стёр бы колонку при
  /// каждом pull. Здесь же хранятся и снимки справочников.
  static Future<void> _createSyncBase(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sync_base (
        entity TEXT NOT NULL,
        id INTEGER NOT NULL,
        base_updated_at TEXT,
        data TEXT NOT NULL,
        PRIMARY KEY (entity, id)
      )
    ''');
  }

  static Future<void> close() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }
}
