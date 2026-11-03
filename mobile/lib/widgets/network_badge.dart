/// Иконка-бейдж сети для AppBar (c-6g, c-6g-tap-ping).
///
/// Состояние — из `NetworkStatusProvider` (heartbeat `/health/`):
/// - `!isOnline`         → `cloud_off`, красный — нет связи с сервером;
/// - online + USB        → `cloud_done`, зелёный — «USB (127.0.0.1)»;
/// - online + WiFi       → `cloud_done`, зелёный — «WiFi (192.168.x)».
///
/// В режиме `PendingOffline` (QR без сети) `AuthProvider` перекрывает
/// статус — иконка `vpn_key` оранжевая.
///
/// c-6g-tap-ping: тап по иконке → `pingNow()` немедленно (без ожидания
/// 10-сек heartbeat). Пока пинг идёт — `SizedBox` + `CircularProgressIndicator`
/// вместо иконки. SnackBar не показываем — иконка сама меняет цвет.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/network_status_provider.dart';

class NetworkBadge extends StatefulWidget {
  const NetworkBadge({super.key});

  @override
  State<NetworkBadge> createState() => _NetworkBadgeState();
}

class _NetworkBadgeState extends State<NetworkBadge> {
  bool _pinging = false;

  Future<void> _onTap() async {
    if (_pinging) return;
    setState(() => _pinging = true);
    try {
      await context.read<NetworkStatusProvider>().pingNow();
    } finally {
      if (mounted) setState(() => _pinging = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pendingOffline = context.select<AuthProvider, bool>(
      (a) => a.isPendingOffline,
    );
    final online = context.select<NetworkStatusProvider, bool>(
      (n) => n.isOnline,
    );
    final lastHost = context.select<NetworkStatusProvider, String?>(
      (n) => n.lastHost,
    );

    final (icon, color, tooltip) = _resolve(
      pendingOffline,
      online,
      lastHost,
      _pinging,
    );

    return IconButton(
      tooltip: tooltip,
      onPressed: _pinging ? null : _onTap,
      icon: _pinging
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(icon, color: color),
    );
  }

  (IconData, Color, String) _resolve(
    bool pendingOffline,
    bool online,
    String? lastHost,
    bool pinging,
  ) {
    if (pinging) {
      return (Icons.cloud_sync, Colors.grey, 'Проверка связи…');
    }
    if (pendingOffline) {
      return (Icons.vpn_key, Colors.orange, 'Временный доступ (нет сети)');
    }
    if (!online) {
      return (Icons.cloud_off, Colors.red, 'Нет связи. Нажмите для проверки');
    }
    final label = switch (lastHost) {
      '127.0.0.1' => 'USB (127.0.0.1)',
      '192.168.0.77' => 'WiFi (192.168.0.77)',
      '10.0.2.2' => 'Эмулятор (10.0.2.2)',
      _ => lastHost ?? 'Онлайн',
    };
    return (
      Icons.cloud_done,
      Colors.green,
      'Онлайн · $label (нажмите для проверки)',
    );
  }
}
