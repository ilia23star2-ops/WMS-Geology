// ignore_for_file: prefer_initializing_formals

import 'package:flutter/foundation.dart';

import '../db/sync_queue_dao.dart';
import '../services/sync_service.dart';
import '../services/sync_pusher.dart';

/// Состояние синхронизации для UI (ChangeNotifier).
///
/// c-9-auto-sync: `pull()` возвращает `PullStats?`.
/// c-6b-updated-since: `_lastPullSince` — время последнего успешного Pull.
/// Передаётся в `pullAll(updatedSince: ...)`, сервер возвращает только
/// изменённые → `PullStats` = реальные изменения (0, если ничего).
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
  DateTime? _lastPullSince;
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

  Future<PullStats?> pull() async {
    if (_isSyncing) return null;
    _isSyncing = true;
    _lastError = null;
    notifyListeners();

    PullStats? stats;
    try {
      // sync-fix-5c: время сервера берём ДО выгрузки, иначе изменения,
      // произошедшие во время Pull, потеряются.
      final serverTime = await _syncService.fetchServerTime();
      stats = await _syncService.pullAll(updatedSince: _lastPullSince);
      if (serverTime != null) _lastPullSince = serverTime;
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
      // sync-fix-3: сначала отправляем локальные изменения, потом забираем
      // серверные. Иначе pull перезаписывал кэш старыми данными, а reconcile
      // снимал pending-флаги до отправки очереди.
      result = await _syncPusher.pushAll();
      final serverTime = await _syncService.fetchServerTime();
      await _syncService.pullAll(updatedSince: _lastPullSince);
      if (serverTime != null) _lastPullSince = serverTime;
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
