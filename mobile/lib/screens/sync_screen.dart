/// Экран синхронизации (c-4 + c-6h + c-9-fill-offline-2c-3-fix-2).
///
/// c-9-fill-offline-2c-3-fix-2: после Push / SyncAll — SnackBar
/// «Отправлено: N, ошибок: M» (разница `pendingCount` до и после) или
/// ошибка, если `lastError != null`.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/network_status_provider.dart';
import '../providers/sync_provider.dart';

class SyncScreen extends StatelessWidget {
  const SyncScreen({super.key});

  Future<void> _runAction(
    BuildContext context,
    SyncProvider sync,
    Future<void> Function() action,
  ) async {
    final before = sync.pendingCount;
    await action();
    if (!context.mounted) return;
    final err = sync.lastError;
    final messenger = ScaffoldMessenger.of(context);
    if (err != null) {
      messenger.showSnackBar(SnackBar(content: Text(err)));
      return;
    }
    final after = sync.pendingCount;
    final sent = (before - after).clamp(0, before);
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          sent > 0 ? 'Отправлено: $sent' : 'Нечего отправлять (очередь пуста)',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Синхронизация')),
      body: Consumer2<SyncProvider, NetworkStatusProvider>(
        builder: (context, sync, net, _) {
          final online = net.isOnline;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (!online) ...[
                const _OfflineBanner(),
                const SizedBox(height: 16),
              ],
              _StatusCard(sync: sync, online: online, lastHost: net.lastHost),
              const SizedBox(height: 16),
              _ActionsCard(
                sync: sync,
                online: online,
                onSyncAll: () => _runAction(context, sync, sync.syncAll),
                onPull: () => _runAction(context, sync, sync.pull),
                onPush: () => _runAction(context, sync, sync.push),
              ),
              if (sync.lastError != null) ...[
                const SizedBox(height: 16),
                _ErrorCard(message: sync.lastError!),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      color: colors.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.cloud_off, color: colors.onErrorContainer),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Нет связи с сервером. Проверьте USB-кабель / WiFi. '
                'Синхронизация будет доступна после восстановления связи.',
                style: TextStyle(color: colors.onErrorContainer),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.sync,
    required this.online,
    required this.lastHost,
  });

  final SyncProvider sync;
  final bool online;
  final String? lastHost;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final last = sync.lastSyncTime;
    final lastText = last == null
        ? 'Ещё не синхронизировалось'
        : '${last.day.toString().padLeft(2, '0')}.'
              '${last.month.toString().padLeft(2, '0')}.'
              '${last.year} '
              '${last.hour.toString().padLeft(2, '0')}:'
              '${last.minute.toString().padLeft(2, '0')}';

    final connectionText = online ? _hostLabel(lastHost) : 'нет связи';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Статус', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            _row(
              'Связь с сервером',
              connectionText,
              color: online ? null : theme.colorScheme.error,
            ),
            _row('Последняя синхронизация', lastText),
            _row('Ожидает отправки', '${sync.pendingCount}'),
            _row(
              'С ошибками',
              '${sync.errorCount}',
              color: sync.errorCount > 0 ? theme.colorScheme.error : null,
            ),
            if (sync.isSyncing) ...[
              const SizedBox(height: 16),
              const LinearProgressIndicator(),
              const SizedBox(height: 8),
              Text('Синхронизация...', style: theme.textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }

  String _hostLabel(String? host) {
    return switch (host) {
      '127.0.0.1' => 'USB (127.0.0.1)',
      '192.168.0.77' => 'WiFi (192.168.0.77)',
      '10.0.2.2' => 'Эмулятор (10.0.2.2)',
      _ => host ?? 'онлайн',
    };
  }

  Widget _row(String label, String value, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(
            value,
            style: TextStyle(fontWeight: FontWeight.bold, color: color),
          ),
        ],
      ),
    );
  }
}

class _ActionsCard extends StatelessWidget {
  const _ActionsCard({
    required this.sync,
    required this.online,
    required this.onSyncAll,
    required this.onPull,
    required this.onPush,
  });

  final SyncProvider sync;
  final bool online;
  final Future<void> Function() onSyncAll;
  final Future<void> Function() onPull;
  final Future<void> Function() onPush;

  @override
  Widget build(BuildContext context) {
    final disabled = sync.isSyncing || !online;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Действия', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: disabled ? null : onSyncAll,
              icon: const Icon(Icons.sync),
              label: const Text('Синхронизировать всё'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: disabled ? null : onPull,
              icon: const Icon(Icons.download),
              label: const Text('Скачать данные (Pull)'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: disabled ? null : onPush,
              icon: const Icon(Icons.upload),
              label: const Text('Отправить изменения (Push)'),
            ),
            if (sync.errorCount > 0) ...[
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: disabled ? null : () => sync.retryErrors(),
                icon: const Icon(Icons.refresh),
                label: const Text('Сбросить ошибки и повторить'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      color: colors.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.error_outline, color: colors.onErrorContainer),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: TextStyle(color: colors.onErrorContainer),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
