/// Домашний экран.
///
/// - Приветствие пользователя.
/// - Кнопка «Сканировать QR».
/// - Кнопка «Синхронизация» (с бейджем количества ожидающих отправки).
/// - Заглушки будущих разделов.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/container_provider.dart';
import '../providers/sync_provider.dart';
import '../services/container_service.dart';
import 'scanner_screen.dart';
import 'sync_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<SyncProvider>().refresh();
      }
    });
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
            Text(
              'Здравствуйте, ${user?.displayName ?? "пользователь"}!',
              style: theme.textTheme.headlineSmall,
            ),
            const SizedBox(height: 4),
            Text(
              user?.role != null
                  ? 'Роль: ${user!.role}'
                  : 'Роль не назначена',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ChangeNotifierProvider(
                      create: (ctx) => ContainerProvider(
                        ctx.read<ContainerService>(),
                      ),
                      child: const ScannerScreen(),
                    ),
                  ),
                );
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
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const SyncScreen(),
                      ),
                    );
                  },
                  icon: Badge(
                    isLabelVisible: total > 0,
                    label: Text('$total'),
                    child: const Icon(Icons.sync),
                  ),
                  label: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      total > 0
                          ? 'Синхронизация ($total)'
                          : 'Синхронизация',
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 24),
            Text(
              'Разделы в разработке: приёмка, поиск проб, инвентаризация.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}