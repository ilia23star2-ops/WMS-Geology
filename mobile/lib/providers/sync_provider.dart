// ignore_for_file: prefer_initializing_formals

import 'package:flutter/foundation.dart';

import '../db/sync_queue_dao.dart';
import '../services/sync_service.dart';
import '../services/sync_pusher.dart';

/// Состояние синхронизации для UI (ChangeNotifier).
///
/// c-9-fill-offline-2c-3-fix-3b: `push()` / `syncAll()` возвращают
/// `PushResult?` (реальный счётчик отправленного).
/// c-9-auto-sync: `pull()` возвращает `PullStats?` (сколько пришло
/// с сервера — для уведомления «Загружено: N»).
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

  /// Скачать данные с сервера (Pull). Возвращает `PullStats`
  /// (сколько тар и проб пришло) или `null`, если Pull упал.
  Future<PullStats?> pull() async {
    if (_isSyncing) return null;
    _isSyncing = true;
    _lastError = null;
    notifyListeners();

    PullStats? stats;
    try {
      stats = await _syncService.pullAll();
      _lastSyncTime = DateTime.now();
    } catch (e) {
      _lastError = 'Ошибка загрузки (Pull): $e';
    } finally {
      _isSyncing = false;
      await refresh();
      notifyListeners();
    }
    return stats;
  }

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

  Future<void> retryErrors() async {
    await SyncQueueDao.resetErrors();
    await refresh();
  }
}
