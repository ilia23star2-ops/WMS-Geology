/// Локальная SQLite (3.x-offline).
///
/// Версия 7 (c-9-fill-offline-2b): +колонка `pending_sync` в `containers`.
///
/// **Миграция v6 → v7:** только `ALTER TABLE containers ADD COLUMN
/// pending_sync`. `samples` / `catalog` / `container_history` /
/// `sync_queue` **не трогаем** — там офлайн-данные (negatives, кэш,
/// очередь), потерять нельзя.
///
/// Полное пересоздание — только `v < 6` (легаси, до офлайн-филла).
library;

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class AppDatabase {
  static final AppDatabase instance = AppDatabase._();
  AppDatabase._();

  static Database? _database;
  static const String _dbName = 'wms_geology.db';

  static const int _dbVersion = 7;

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
          await _createTables(db);
          return;
        }
        // v6 → v7: только ALTER, данные сохраняем.
        // samples / catalog / container_history / sync_queue — не трогаем.
        if (oldVersion < 7) {
          await db.execute(
            'ALTER TABLE containers ADD COLUMN '
            'pending_sync INTEGER NOT NULL DEFAULT 0',
          );
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
        created_at TEXT NOT NULL
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
  }

  static Future<void> close() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }
}
