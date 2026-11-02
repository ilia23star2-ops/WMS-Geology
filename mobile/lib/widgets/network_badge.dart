/// Иконка-бейдж сети для AppBar (c-6g).
///
/// Состояние — из `NetworkStatusProvider` (heartbeat `/health/`):
/// - `!isOnline`         → `cloud_off`, красный — нет связи с сервером;
/// - online + USB        → `cloud_done`, зелёный — «USB (127.0.0.1)»;
/// - online + WiFi       → `cloud_done`, зелёный — «WiFi (192.168.x)».
///
/// В режиме `PendingOffline` (QR без сети) `AuthProvider` перекрывает
/// статус — иконка `vpn_key` оранжевая. На `LoginScreen` этого режима нет
/// (пользователь ещё не вошёл) — там показывается только online/offline.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/network_status_provider.dart';

class NetworkBadge extends StatelessWidget {
  const NetworkBadge({super.key});

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

    final (icon, color, tooltip) = _resolve(pendingOffline, online, lastHost);

    return Tooltip(
      message: tooltip,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Icon(icon, color: color),
      ),
    );
  }

  (IconData, Color, String) _resolve(
    bool pendingOffline,
    bool online,
    String? lastHost,
  ) {
    if (pendingOffline) {
      return (Icons.vpn_key, Colors.orange, 'Временный доступ (нет сети)');
    }
    if (!online) {
      return (Icons.cloud_off, Colors.red, 'Нет связи с сервером');
    }
    final label = switch (lastHost) {
      '127.0.0.1' => 'USB (127.0.0.1)',
      '192.168.0.77' => 'WiFi (192.168.0.77)',
      '10.0.2.2' => 'Эмулятор (10.0.2.2)',
      _ => lastHost ?? 'Онлайн',
    };
    return (Icons.cloud_done, Colors.green, 'Онлайн · $label');
  }
}
