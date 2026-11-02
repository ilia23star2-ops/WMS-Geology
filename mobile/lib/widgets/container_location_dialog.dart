/// Диалог «Местоположение тары» (c-7c).
///
/// Открывается для тары, у которой `cellId != null` (размещена в ячейке).
/// Показывает текущий адрес — в вебе аналог ведёт в `/topology?cell_id=`,
/// в мобилке раздела топологии нет, поэтому показываем адрес текстом.
///
/// Статус тары не меняет. Для размещения / переразмещения — кнопка
/// [Разместить] (`PlaceContainerDialog`).
library;

import 'package:flutter/material.dart' hide Container;

import '../models/container.dart';

class ContainerLocationDialog extends StatelessWidget {
  const ContainerLocationDialog({super.key, required this.container});

  final Container container;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasCell =
        container.cellFullAddress != null &&
        container.cellFullAddress!.isNotEmpty;
    final hasFloor =
        container.floorRoomName != null && container.floorRoomName!.isNotEmpty;

    return AlertDialog(
      title: const Text('Местоположение тары'),
      scrollable: true,
      content: SizedBox(
        width: 400,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _row(context, 'Тара', container.displayName, mono: true),
            _row(context, 'Статус', container.statusLabel),
            const Divider(height: 24),
            if (hasCell) ...[
              _row(context, 'Ячейка', container.cellFullAddress!),
              if (container.positionOnPallet != null)
                _row(
                  context,
                  'Позиция на поддоне',
                  '${container.positionOnPallet}',
                ),
            ] else if (hasFloor) ...[
              _row(context, 'На полу', container.floorRoomName!),
            ] else
              Text(
                'Место не указано.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Закрыть'),
        ),
      ],
    );
  }

  Widget _row(
    BuildContext context,
    String label,
    String value, {
    bool mono = false,
  }) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontFamily: mono ? 'monospace' : null,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
