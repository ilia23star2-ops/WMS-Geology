/// Цветной чип статуса пробы (c-7g).
///
/// Маппинг (как `STATUS_COLORS` в `FillContainerContent.tsx`):
/// - `IN_STORAGE` — зелёный (на хранении);
/// - `IN_TRANSIT` — синий (в пути);
/// - `CONSUMED` — оранжевый (израсходована);
/// - `DISPOSED` — красный (утилизирована);
/// - `PENDING_PLACEMENT` — оранжевый;
/// - `SELECTED` — серый (нейтральный);
/// - `unknown` — серый.
library;

import 'package:flutter/material.dart';

import '../models/sample.dart';

class SampleStatusChip extends StatelessWidget {
  const SampleStatusChip({super.key, required this.status});

  final SampleStatus status;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = _colors(context, status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        sampleStatusLabels[status] ?? 'Неизвестно',
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }

  (Color, Color) _colors(BuildContext context, SampleStatus s) {
    switch (s) {
      case SampleStatus.inStorage:
        return (Colors.green.shade900, Colors.green.shade50);
      case SampleStatus.inTransit:
        return (Colors.blue.shade900, Colors.blue.shade50);
      case SampleStatus.consumed:
        return (Colors.orange.shade900, Colors.orange.shade50);
      case SampleStatus.disposed:
        return (Colors.red.shade900, Colors.red.shade50);
      case SampleStatus.pendingPlacement:
        return (Colors.orange.shade900, Colors.orange.shade50);
      case SampleStatus.selected:
      case SampleStatus.unknown:
        final c = Theme.of(context).colorScheme;
        return (c.onSurfaceVariant, c.surfaceContainerHighest);
    }
  }
}
