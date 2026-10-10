/// Карточка тары после сканирования QR.
///
/// Показывает основные поля. Действия (переместить, в партию печати) —
/// в следующих заходах.
///
/// ВАЖНО: `hide Container` — иначе конфликт имён с Flutter-виджетом
/// `Container` (flutter/src/widgets/container.dart).
library;

import 'package:flutter/material.dart' hide Container;

import '../models/container.dart';

class ContainerDetailScreen extends StatelessWidget {
  const ContainerDetailScreen({super.key, required this.container});

  final Container container;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(container.containerNumber),
        backgroundColor: theme.colorScheme.inversePrimary,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _row(context, 'Номер', container.containerNumber, mono: true),
                  _row(context, 'ID', '#${container.id}'),
                  _row(context, 'Статус', container.statusLabel),
                  _row(context, 'Тип тары', 'ID ${container.containerType}'),
                  if (container.pallet != null)
                    _row(context, 'Поддон', 'ID ${container.pallet}'),
                  if (container.floorRoom != null)
                    _row(context, 'На полу в комнате',
                        'ID ${container.floorRoom}'),
                  if (container.positionOnPallet != null)
                    _row(context, 'Позиция на поддоне',
                        '${container.positionOnPallet}'),
                  if (container.qrCode != null &&
                      container.qrCode!.isNotEmpty)
                    _row(context, 'QR', container.qrCode!, mono: true),
                  if (container.commentTemplateText != null &&
                      container.commentTemplateText!.isNotEmpty)
                    _row(context, 'Комментарий (шаблон)',
                        container.commentTemplateText!),
                  if (container.comment.isNotEmpty)
                    _row(context, 'Комментарий', container.comment),
                  if (container.createdAt != null)
                    _row(context, 'Создана',
                        container.createdAt!.toLocal().toString()),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Список проб и действия появятся в следующих обновлениях.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
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
            width: 150,
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
