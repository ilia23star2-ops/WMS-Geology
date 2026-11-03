/// Точка входа мобильного приложения.
///
/// c-9-auto-sync: `AuthGate` подписан на `NetworkStatusProvider`.
/// При возврате сети (`isOnline: false → true`):
/// 1. **Push** — если в очереди есть pending/errors.
/// 2. **Pull** — всегда (подтянуть серверное).
///
/// SnackBar (объединённый):
/// - только Push: «Отправлено: N»;
/// - только Pull: «Загружено: N»;
/// - Push + Pull: «Отправлено: N, загружено: M»;
/// - ошибка — текст ошибки.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'config.dart';
import 'providers/auth_provider.dart';
import 'providers/network_status_provider.dart';
import 'providers/sync_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/catalog_service.dart';
import 'services/container_service.dart';
import 'services/sample_service.dart';
import 'services/sync_pusher.dart';
import 'services/sync_service.dart';

final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.resolve();
  runApp(const WmsGeologyApp());
}

class WmsGeologyApp extends StatelessWidget {
  const WmsGeologyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..initialize()),
        ChangeNotifierProvider(create: (_) => NetworkStatusProvider()),
        Provider<ContainerService>(
          create: (ctx) =>
              ContainerService(ctx.read<AuthProvider>().service.apiClient),
        ),
        Provider<SampleService>(
          create: (ctx) =>
              SampleService(ctx.read<AuthProvider>().service.apiClient),
        ),
        Provider<CatalogService>(
          create: (ctx) =>
              CatalogService(ctx.read<AuthProvider>().service.apiClient),
        ),
        Provider<SyncService>(
          create: (ctx) =>
              SyncService(ctx.read<AuthProvider>().service.apiClient),
        ),
        Provider<SyncPusher>(
          create: (ctx) =>
              SyncPusher(ctx.read<AuthProvider>().service.apiClient),
        ),
        ChangeNotifierProvider<SyncProvider>(
          create: (ctx) => SyncProvider(
            syncService: ctx.read<SyncService>(),
            syncPusher: ctx.read<SyncPusher>(),
          ),
        ),
      ],
      child: MaterialApp(
        title: 'WMS Geology',
        debugShowCheckedModeBanner: false,
        scaffoldMessengerKey: scaffoldMessengerKey,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF1E3A5F),
            brightness: Brightness.light,
          ),
          useMaterial3: true,
        ),
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _wired = false;
  bool _wasOnline = true;
  bool _autoSyncInProgress = false;
  NetworkStatusProvider? _net;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _wired) return;
      _wired = true;
      final auth = context.read<AuthProvider>();
      final net = context.read<NetworkStatusProvider>();
      _net = net;
      net.onBaseUrlChanged = (url) {
        auth.service.apiClient.dio.options.baseUrl = url;
      };
      _wasOnline = net.isOnline;
      net.addListener(_onNetChanged);
      net.start();
    });
  }

  @override
  void dispose() {
    _net?.removeListener(_onNetChanged);
    super.dispose();
  }

  void _onNetChanged() {
    final net = _net;
    if (net == null) return;
    final cameOnline = !_wasOnline && net.isOnline;
    _wasOnline = net.isOnline;
    if (!cameOnline) return;
    unawaited(_autoSync());
  }

  /// c-9-auto-sync: Push (если есть pending) + Pull (всегда).
  /// Один объединённый SnackBar — Push + Pull + ошибка.
  Future<void> _autoSync() async {
    if (_autoSyncInProgress || !mounted) return;
    final sync = context.read<SyncProvider>();
    final auth = context.read<AuthProvider>();
    if (auth.isPendingOffline) return;
    if (sync.isSyncing) return;

    await sync.refresh();
    if (!mounted) return;

    final hadPending = sync.pendingCount > 0 || sync.errorCount > 0;

    _autoSyncInProgress = true;
    try {
      String? pushError;
      PushResult? pushResult;
      if (hadPending) {
        pushResult = await sync.push();
        if (!mounted) return;
        pushError = sync.lastError;
      }

      String? pullError;
      PullStats? pullStats;
      // Pull — всегда при возврате сети, даже если Push упал.
      if (pushError == null) {
        pullStats = await sync.pull();
        if (!mounted) return;
        pullError = sync.lastError;
      }

      final messenger = scaffoldMessengerKey.currentState;
      if (messenger == null) return;

      if (pushError != null) {
        messenger.showSnackBar(SnackBar(content: Text(pushError)));
        return;
      }
      if (pullError != null) {
        messenger.showSnackBar(SnackBar(content: Text(pullError)));
        return;
      }

      final sent = pushResult?.sent ?? 0;
      final loaded = pullStats?.total ?? 0;
      final failed = pushResult?.failed ?? 0;

      if (sent == 0 && loaded == 0 && failed == 0) return;

      final parts = <String>[];
      if (sent > 0) parts.add('отправлено: $sent');
      if (failed > 0) parts.add('с ошибками: $failed');
      if (loaded > 0) parts.add('загружено: $loaded');

      messenger.showSnackBar(
        SnackBar(content: Text('Синхронизировано — ${parts.join(', ')}')),
      );
    } finally {
      _autoSyncInProgress = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        if (auth.isInitializing) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (auth.isAuthenticated) {
          return const HomeScreen();
        }
        return const LoginScreen();
      },
    );
  }
}
