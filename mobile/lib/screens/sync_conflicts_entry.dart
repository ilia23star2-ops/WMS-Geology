/// Вход на экран расхождений из экрана синхронизации
/// (пачка conflict-ui-11).
///
/// Показываем только когда есть что разбирать: обычная работа
/// объединяется автоматически и внимания не требует.
library;

import 'package:flutter/material.dart';

import 'conflicts_screen.dart';

class SyncConflictsEntry extends StatelessWidget {
  const SyncConflictsEntry({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final theme = Theme.of(context);
    return Card(
      color: colors.tertiaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Icon(Icons.compare_arrows, color: colors.onTertiaryContainer),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Данные разошлись: $count',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: colors.onTertiaryContainer,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Эти записи изменили и на планшете, и на сервере. '
              'Выберите, что оставить.',
              style: TextStyle(color: colors.onTertiaryContainer),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const ConflictsScreen(),
                ),
              ),
              icon: const Icon(Icons.rule),
              label: const Text('Разобрать'),
            ),
          ],
        ),
      ),
    );
  }
}
