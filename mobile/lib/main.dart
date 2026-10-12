/// Точка входа мобильного приложения.
///
/// - `MultiProvider` — регистрирует `AuthProvider`, `ContainerService`,
///   `SampleService`.
/// - `AuthGate` — переключает экраны: спиннер (при инициализации),
///   login или home.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/container_service.dart';
import 'services/sample_service.dart';

void main() {
  runApp(const WmsGeologyApp());
}

class WmsGeologyApp extends StatelessWidget {
  const WmsGeologyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AuthProvider()..initialize(),
        ),
        Provider<ContainerService>(
          create: (ctx) => ContainerService(
            ctx.read<AuthProvider>().service.apiClient,
          ),
        ),
        Provider<SampleService>(
          create: (ctx) => SampleService(
            ctx.read<AuthProvider>().service.apiClient,
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
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

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