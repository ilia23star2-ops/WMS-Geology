/// Локальная SQLite (3.x-offline).
///
/// Версия 5 (c-7-offline-catalog): +таблица `catalog` для кэша справочников
/// (`room`, `rack`, `section`, `tier`, `cell`, `site`, `research_type`,
/// `laboratory`, `container_type`).
///
/// `sync_queue` при миграции **не пересоздаём** — там несохранённые
/// изменения. `containers`, `samples`, `catalog` — пересоздаются
/// (восстановятся при следующем Pull).
library;

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class AppDatabase {
  static final AppDatabase instance = AppDatabase._();
  AppDatabase._();

  static Database? _database;
  static const String _dbName = 'wms_geology.db';

  static const int _dbVersion = 5;

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
        // Пересоздаём кэш-таблицы. sync_queue НЕ трогаем —
        // там локальные изменения, которые ещё не ушли на сервер.
        await db.execute('DROP TABLE IF EXISTS containers');
        await db.execute('DROP TABLE IF EXISTS samples');
        await db.execute('DROP TABLE IF EXISTS catalog');
        await _createTables(db);
      },
    );
  }

  static Future<void> _createTables(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS containers (
        id INTEGER PRIMARY KEY,
        updated_at TEXT,
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
    // c-7-offline-catalog: кэш справочников.
    // kind — 'room' | 'rack' | 'section' | 'tier' | 'cell'
    //        | 'site' | 'research_type' | 'laboratory' | 'container_type'
    // parent_id — ID родителя для topology (rack→room, section→rack,
    //             tier→section, cell→tier). NULL для верхнеуровневых.
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
  }

  static Future<void> close() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }
}
