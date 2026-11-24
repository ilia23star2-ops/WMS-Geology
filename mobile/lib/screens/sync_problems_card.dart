/// Карточка проблем синхронизации (пачка sync-problems-2).
///
/// Показывает то, что раньше терялось молча: операции очереди, упавшие
/// с ошибкой, и записи, отправленные но не связанные с серверными.
/// Раньше счётчик «С ошибками» всегда был 0 — ошибки не виделись вообще.
library;

import 'package:flutter/material.dart';

import '../providers/sync_provider.dart';

/// Название операции на русском по endpoint очереди.
///
/// Отрицательные ID — офлайн-созданные записи, их тоже узнаём.
String describeSyncOperation(String endpoint) {
  switch (endpoint) {
    case '/storage/containers/bulk-create/':
      return 'Создание тары';
    case '/storage/containers/bulk-place/':
      return 'Размещение тары';
    case '/sites/':
      return 'Создание участка';
    case '/research-types/':
      return 'Создание типа исследования';
    case '/laboratories/':
      return 'Создание лаборатории';
    case '/storage/container-types/':
      return 'Создание типа тары';
  }
  if (RegExp(r'^/storage/containers/-?\d+/fill-samples/$').hasMatch(endpoint)) {
    return 'Заполнение тары пробами';
  }
  if (RegExp(r'^/storage/containers/-?\d+/$').hasMatch(endpoint)) {
    return 'Изменение шапки тары';
  }
  if (RegExp(r'^/samples/-?\d+/dispose/$').hasMatch(endpoint)) {
    return 'Списание пробы';
  }
  if (RegExp(r'^/samples/-?\d+/restore/$').hasMatch(endpoint)) {
    return 'Восстановление пробы';
  }
  if (RegExp(r'^/samples/-?\d+/$').hasMatch(endpoint)) {
    return 'Изменение пробы';
  }
  return 'Операция с данными';
}

class SyncProblemsCard extends StatelessWidget {
  const SyncProblemsCard({super.key, required this.sync});

  final SyncProvider sync;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final theme = Theme.of(context);
    final errors = sync.errorItems;
    final mapping = sync.mappingErrors;
    final bodyStyle = TextStyle(color: colors.onErrorContainer);
    final hintStyle = theme.textTheme.bodySmall?.copyWith(
      color: colors.onErrorContainer,
    );

    return Card(
      color: colors.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.report_problem_outlined,
                  color: colors.onErrorContainer,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Проблемы синхронизации',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: colors.onErrorContainer,
                    ),
                  ),
                ),
              ],
            ),
            if (errors.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Не отправлено: ${errors.length}',
                style: bodyStyle.copyWith(fontWeight: FontWeight.bold),
              ),
              for (final item in errors)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        describeSyncOperation(item.endpoint),
                        style: bodyStyle,
                      ),
                      Text(
                        item.errorMessage ?? 'Причина не указана',
                        style: hintStyle,
                      ),
                    ],
                  ),
                ),
            ],
            if (mapping.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Отправлено, но не связано с сервером: ${mapping.length}',
                style: bodyStyle.copyWith(fontWeight: FontWeight.bold),
              ),
              for (final message in mapping)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(message, style: bodyStyle),
                ),
              const SizedBox(height: 8),
              Text(
                'Повторите синхронизацию. Если проблема останется — '
                'сообщите администратору.',
                style: hintStyle,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
