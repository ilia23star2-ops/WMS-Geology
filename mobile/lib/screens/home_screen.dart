import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/scan_history_entry.dart';
import '../providers/auth_provider.dart';
import '../providers/container_provider.dart';
import '../providers/network_status_provider.dart';
import '../providers/sync_provider.dart';
import '../services/container_service.dart';
import '../services/scan_history_service.dart';
import '../widgets/network_badge.dart';
import 'container_detail_screen.dart';
import 'scanner_screen.dart';
import 'sync_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<ScanHistoryEntry> _historyEntries = const [];

  @override
  void initState() {
    super.initState();
    _loadHistory();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<SyncProvider>().refresh();
    });
  }

  Future<void> _loadHistory() async {
    final entries = await ScanHistoryService.getHistory();
    if (mounted) setState(() => _historyEntries = entries);
  }

  Future<void> _openContainerById(int id) async {
    final service = context.read<ContainerService>();
    try {
      final container = await service.fetchById(id);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ContainerDetailScreen(container: container),
        ),
      );
      await _loadHistory();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Тара #$id не найдена: $e')));
    }
  }

  Future<void> _openScanner() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChangeNotifierProvider(
          create: (ctx) => ContainerProvider(ctx.read<ContainerService>()),
          child: const ScannerScreen(),
        ),
      ),
    );
    await _loadHistory();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('WMS Geology'),
        backgroundColor: theme.colorScheme.inversePrimary,
        actions: [
          const NetworkBadge(),
          IconButton(
            tooltip: 'Выйти',
            icon: const Icon(Icons.logout),
            onPressed: auth.isLoading
                ? null
                : () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (auth.isPendingOffline)
              Container(
                padding: const EdgeInsets.all(8),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.tertiaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.vpn_key,
                      color: theme.colorScheme.onTertiaryContainer,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Временный доступ (нет сети). Синхронизация станет '
                        'доступна после подключения.',
                        style: TextStyle(
                          color: theme.colorScheme.onTertiaryContainer,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            Text(
              'Здравствуйте, ${user?.displayName ?? "пользователь"}!',
              style: theme.textTheme.headlineSmall,
            ),
            const SizedBox(height: 4),
            Text(
              user?.role != null ? 'Роль: ${user!.role}' : 'Роль не назначена',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _openScanner,
              icon: const Icon(Icons.qr_code_scanner),
              label: const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('Сканировать QR'),
              ),
            ),
            const SizedBox(height: 12),
            Consumer2<SyncProvider, NetworkStatusProvider>(
              builder: (context, sync, net, _) {
                final total = sync.pendingCount + sync.errorCount;
                final blocked = !net.isOnline || auth.isPendingOffline;
                final tooltip = auth.isPendingOffline
                    ? 'Временный доступ: синхронизация недоступна'
                    : (!net.isOnline
                          ? 'Нет связи с сервером'
                          : 'Открыть экран синхронизации');

                return Tooltip(
                  message: tooltip,
                  child: OutlinedButton.icon(
                    onPressed: blocked
                        ? null
                        : () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const SyncScreen(),
                            ),
                          ),
                    icon: blocked
                        ? const Icon(Icons.cloud_off)
                        : Badge(
                            isLabelVisible: total > 0,
                            label: Text('$total'),
                            child: const Icon(Icons.sync),
                          ),
                    label: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        blocked
                            ? 'Синхронизация (нет связи)'
                            : (total > 0
                                  ? 'Синхронизация ($total)'
                                  : 'Синхронизация'),
                      ),
                    ),
                  ),
                );
              },
            ),
            if (_historyEntries.isNotEmpty) ...[
              const SizedBox(height: 24),
              Text('Недавно отсканировано', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _historyEntries.map((e) {
                  return ActionChip(
                    avatar: const Icon(Icons.inventory_2, size: 18),
                    label: Text(e.label),
                    tooltip: 'Открыть тару #${e.id}',
                    onPressed: () => _openContainerById(e.id),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
