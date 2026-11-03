// ignore_for_file: prefer_initializing_formals

import 'package:flutter/foundation.dart';

import '../db/sync_queue_dao.dart';
import '../services/sync_service.dart';
import '../services/sync_pusher.dart';

/// Состояние синхронизации для UI (ChangeNotifier).
///
/// c-9-fill-offline-2c-3-fix-3b: `push()` / `syncAll()` возвращают
/// `PushResult?` — UI показывает «Отправлено: N» по **реальному**
/// счётчику из `SyncPusher`, а не по разнице `pendingCount`
/// (который в офлайне застревал на 0).
class SyncProvider extends ChangeNotifier {
  SyncProvider({
    required SyncService syncService,
    required SyncPusher syncPusher,
    Future<int> Function()? getPendingCount,
    Future<List<SyncQueueItem>> Function()? getPendingItems,
  }) : _syncService = syncService,
       _syncPusher = syncPusher,
       _getPendingCount =
           getPendingCount ??
           (() async => (await SyncQueueDao.getPending()).length),
       _getPendingItems = getPendingItems ?? SyncQueueDao.getPending;

  final SyncService _syncService;
  final SyncPusher _syncPusher;
  final Future<int> Function() _getPendingCount;
  final Future<List<SyncQueueItem>> Function() _getPendingItems;

  bool _isSyncing = false;
  DateTime? _lastSyncTime;
  int _pendingCount = 0;
  int _errorCount = 0;
  String? _lastError;

  bool get isSyncing => _isSyncing;
  DateTime? get lastSyncTime => _lastSyncTime;
  int get pendingCount => _pendingCount;
  int get errorCount => _errorCount;
  String? get lastError => _lastError;

  /// Обновить статистику очереди (без выполнения самой синхронизации).
  /// Вызывать после любой офлайн-операции, чтобы счётчик на кнопке
  /// синхронизации сразу отражал реальность.
  Future<void> refresh() async {
    try {
      _pendingCount = await _getPendingCount();
      final items = await _getPendingItems();
      _errorCount = items.where((i) => i.status == 'ERROR').length;
      notifyListeners();
    } catch (e) {
      _lastError = 'Ошибка чтения очереди: $e';
      notifyListeners();
    }
  }

  /// Скачать данные с сервера (Pull). Результата не возвращает.
  Future<void> pull() async {
    if (_isSyncing) return;
    _isSyncing = true;
    _lastError = null;
    notifyListeners();

    try {
      await _syncService.pullAll();
      _lastSyncTime = DateTime.now();
    } catch (e) {
      _lastError = 'Ошибка загрузки (Pull): $e';
    } finally {
      _isSyncing = false;
      await refresh();
      notifyListeners();
    }
  }

  /// Отправить локальные изменения на сервер (Push).
  ///
  /// Возвращает `PushResult` (или `null`, если синхронизация уже идёт
  /// либо упала). UI показывает «Отправлено: N» по `result.sent`.
  Future<PushResult?> push() async {
    if (_isSyncing) return null;
    _isSyncing = true;
    _lastError = null;
    notifyListeners();

    PushResult? result;
    try {
      result = await _syncPusher.pushAll();
      _lastSyncTime = DateTime.now();
    } catch (e) {
      _lastError = 'Ошибка отправки (Push): $e';
    } finally {
      _isSyncing = false;
      await refresh();
      notifyListeners();
    }
    return result;
  }

  /// Полная синхронизация (Pull + Push).
  ///
  /// Возвращает `PushResult` от `pushAll` (или `null`, если Pull упал).
  Future<PushResult?> syncAll() async {
    if (_isSyncing) return null;
    _isSyncing = true;
    _lastError = null;
    notifyListeners();

    PushResult? result;
    try {
      await _syncService.pullAll();
      result = await _syncPusher.pushAll();
      _lastSyncTime = DateTime.now();
    } catch (e) {
      _lastError = 'Ошибка синхронизации: $e';
    } finally {
      _isSyncing = false;
      await refresh();
      notifyListeners();
    }
    return result;
  }

  /// Сбросить ошибки в очереди и попробовать снова.
  Future<void> retryErrors() async {
    await SyncQueueDao.resetErrors();
    await refresh();
  }
}
