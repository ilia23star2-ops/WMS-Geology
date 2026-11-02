/// Точка входа мобильного приложения.
///
/// - `AppConfig.resolve()` — auto-detect сети (c-6c).
/// - `NetworkStatusProvider` (c-6g) — heartbeat `/health/` 10 с.
/// - `CatalogService` (c-7b-full) — справочники для формы редактирования.
/// - `MultiProvider` — AuthProvider, NetworkStatusProvider, ContainerService,
///   SampleService, CatalogService, SyncService, SyncPusher, SyncProvider.
/// - `AuthGate` — спиннер / login / home.
library;

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

/// Переключатель экранов по состоянию аутентификации.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _wired = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _wired) return;
      _wired = true;
      final auth = context.read<AuthProvider>();
      final net = context.read<NetworkStatusProvider>();
      net.onBaseUrlChanged = (url) {
        auth.service.apiClient.dio.options.baseUrl = url;
      };
      net.start();
    });
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
