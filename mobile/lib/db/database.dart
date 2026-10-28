/// Инициализация локальной базы данных SQLite (3.x-offline-sync c-1).
///
/// Схема:
/// - `containers` — кэш тар.
/// - `samples` — кэш проб.
/// - `sync_queue` — очередь офлайн-операций.
///
/// Для моделей используем документо-ориентированный подход:
/// колонка `data` хранит сырой JSON ответа от сервера. Это избавляет
/// от необходимости писать мапперы под каждое новое поле.
library;

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class AppDatabase {
  static final AppDatabase instance = AppDatabase._init();
  static Database? _database;

  AppDatabase._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('wms_geology.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(path, version: 1, onCreate: _createDB);
  }

  Future<void> _createDB(Database db, int version) async {
    // 1. Таблица тар
    await db.execute('''
      CREATE TABLE containers (
        id INTEGER PRIMARY KEY,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )
    ''');

    // 2. Таблица проб
    await db.execute('''
      CREATE TABLE samples (
        id INTEGER PRIMARY KEY,
        container_id INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )
    ''');
    // Индекс для быстрого поиска проб по таре
    await db.execute(
      'CREATE INDEX idx_samples_container_id ON samples (container_id)',
    );

    // 3. Очередь операций (SyncQueue)
    await db.execute('''
      CREATE TABLE sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    ''');
  }

  /// Очистка всех данных (например, при логауте).
  Future<void> clearAll() async {
    final db = await instance.database;
    await db.delete('containers');
    await db.delete('samples');
    await db.delete('sync_queue');
  }
}
