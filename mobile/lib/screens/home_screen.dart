import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/container_provider.dart';
import '../services/container_service.dart';
import '../services/scan_history_service.dart';
import 'scanner_screen.dart';
import 'container_detail_screen.dart';
import 'sync_screen.dart';
import '../providers/sync_provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<int> _historyIds = [];

  @override
  void initState() {
    super.initState();
    _loadHistory();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<SyncProvider>().refresh();
    });
  }

  Future<void> _loadHistory() async {
    final ids = await ScanHistoryService.getHistory();
    if (mounted) setState(() => _historyIds = ids);
  }

  Future<void> _openContainerById(int id) async {
    final provider = context.read<ContainerProvider>();
    provider.reset();
    await provider.handleScan('WMSG:CONTAINER:$id');
    
    if (!mounted) return;
    if (provider.container != null) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ContainerDetailScreen(container: provider.container!),
        ),
      );
      _loadHistory();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.error ?? 'Тара не найдена')),
      );
    }
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
          IconButton(
            tooltip: 'Выйти',
            icon: const Icon(Icons.logout),
            onPressed: auth.isLoading ? null : () => context.read<AuthProvider>().logout(),
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
                  color: theme.colorScheme.tertiaryContainer, // Другой цвет для "временного"
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.vpn_key, color: theme.colorScheme.onTertiaryContainer),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Временный доступ (нет сети). Синхронизация станет доступна после подключения.',
                        style: TextStyle(color: theme.colorScheme.onTertiaryContainer),
                      ),
                    ),
                  ],
                ),
              )
            else if (auth.isOffline)
              Container(
                padding: const EdgeInsets.all(8),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.wifi_off, color: theme.colorScheme.onErrorContainer),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Офлайн-режим. Данные могут быть неактуальны.',
                        style: TextStyle(color: theme.colorScheme.onErrorContainer),
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
              style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ChangeNotifierProvider(
                      create: (ctx) => ContainerProvider(ctx.read<ContainerService>()),
                      child: const ScannerScreen(),
                    ),
                  ),
                );
                _loadHistory();
              },
              icon: const Icon(Icons.qr_code_scanner),
              label: const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('Сканировать QR'),
              ),
            ),
            const SizedBox(height: 12),
            Consumer<SyncProvider>(
              builder: (context, sync, _) {
                final total = sync.pendingCount + sync.errorCount;
                return OutlinedButton.icon(
                  onPressed: (auth.isPendingOffline) 
                    ? null // Блокируем, пока нет сети
                    : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SyncScreen())),
                  icon: Badge(
                    isLabelVisible: total > 0,
                    label: Text('$total'),
                    child: const Icon(Icons.sync),
                  ),
                  label: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(total > 0 ? 'Синхронизация ($total)' : 'Синхронизация'),
                  ),
                );
              },
            ),
            if (_historyIds.isNotEmpty) ...[
              const SizedBox(height: 24),
              Text('Недавно отсканировано', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _historyIds.map((id) {
                  return ActionChip(
                    avatar: const Icon(Icons.inventory_2, size: 18),
                    label: Text('Тара #$id'),
                    onPressed: () => _openContainerById(id),
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