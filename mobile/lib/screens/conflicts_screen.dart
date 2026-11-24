/// Экран «Данные разошлись» (пачка conflict-ui-10).
///
/// Показывает записи, которые изменили и на планшете, и на сервере.
/// По каждому спорному полю видно оба значения, человек выбирает.
/// Обычные действия (создал, отредактировал, отправил) сюда не попадают —
/// они объединяются автоматически.
library;

import 'package:flutter/material.dart';

import '../db/container_dao.dart';
import '../db/sample_dao.dart';
import '../db/sync_queue_dao.dart';
import '../services/conflict_apply_service.dart';
import '../utils/field_labels.dart';
import '../utils/record_batch_merge.dart';
import '../utils/sync_conflicts.dart';

class ConflictsScreen extends StatefulWidget {
  const ConflictsScreen({super.key});

  @override
  State<ConflictsScreen> createState() => _ConflictsScreenState();
}

class _ConflictsScreenState extends State<ConflictsScreen> {
  bool _busy = false;
  String? _error;

  /// Пока расхождения собираются только по таре.
  ConflictApplyService _service() => ConflictApplyService(
    getLocal: (id) => ContainerDao.getById(id),
    getQueuePayload: (endpoint) =>
        SyncQueueDao.getPayloadByEndpoint(endpoint, action: 'PATCH'),
    updateQueuePayload: (endpoint, payload) async {
      await SyncQueueDao.updatePayloadByEndpoint(
        endpoint,
        payload,
        action: 'PATCH',
      );
    },
    deleteQueueItem: (endpoint) => SyncQueueDao.deleteByEndpoint(endpoint),
    updateLocalFields: (id, fields) =>
        ContainerDao.updateFieldsLocal(id, fields),
  );

  /// Пробы правятся своим DAO: флаг у них в JSON, а не в колонке.
  ConflictApplyService _sampleService() => ConflictApplyService(
    getLocal: (id) => SampleDao.getById(id),
    getQueuePayload: (endpoint) =>
        SyncQueueDao.getPayloadByEndpoint(endpoint, action: 'PATCH'),
    updateQueuePayload: (endpoint, payload) async {
      await SyncQueueDao.updatePayloadByEndpoint(endpoint, payload, action: 'PATCH');
    },
    deleteQueueItem: (endpoint) => SyncQueueDao.deleteByEndpoint(endpoint),
    updateLocalFields: (id, fields) => SampleDao.updateLocalFields(id, fields),
  );

  Future<void> _apply(
    RecordConflict conflict, {
    required bool keepLocal,
  }) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final service = conflict.entity == 'sample' ? _sampleService() : _service();
      await service.apply(conflict, keepLocal: keepLocal);
    } catch (e) {
      _error = 'Не удалось применить выбор: $e';
    }
    if (!mounted) return;
    setState(() {
      _busy = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final items = SyncConflicts.items;
    return Scaffold(
      appBar: AppBar(title: const Text('Данные разошлись')),
      body: items.isEmpty
          ? const _EmptyState()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                const _Intro(),
                if (_error != null) ...<Widget>[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                for (final conflict in items) ...<Widget>[
                  const SizedBox(height: 12),
                  _ConflictCard(
                    conflict: conflict,
                    busy: _busy,
                    onKeepLocal: () => _apply(conflict, keepLocal: true),
                    onTakeServer: () => _apply(conflict, keepLocal: false),
                  ),
                ],
              ],
            ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            const Icon(Icons.check_circle_outline, size: 48),
            const SizedBox(height: 12),
            Text(
              'Расхождений нет',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            const Text(
              'Данные на планшете и на сервере согласованы.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _Intro extends StatelessWidget {
  const _Intro();

  @override
  Widget build(BuildContext context) {
    return const Text(
      'Эти записи изменили и на планшете, и на сервере. '
      'Выберите, что оставить. Остальные поля уже объединены автоматически.',
    );
  }
}

class _ConflictCard extends StatelessWidget {
  const _ConflictCard({
    required this.conflict,
    required this.busy,
    required this.onKeepLocal,
    required this.onTakeServer,
  });

  final RecordConflict conflict;
  final bool busy;
  final VoidCallback onKeepLocal;
  final VoidCallback onTakeServer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = conflict.title ?? 'Тара #${conflict.id}';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            for (final field in conflict.fields) ...<Widget>[
              Text(fieldLabel(field.field), style: theme.textTheme.bodySmall),
              const SizedBox(height: 4),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Expanded(
                    child: _ValueBox(
                      caption: 'На планшете',
                      value: displayValue(field.field, field.localValue),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ValueBox(
                      caption: 'На сервере',
                      value: displayValue(field.field, field.serverValue),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton(
                    onPressed: busy ? null : onKeepLocal,
                    child: const Text('Оставить с планшета'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: busy ? null : onTakeServer,
                    child: const Text('Взять с сервера'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ValueBox extends StatelessWidget {
  const _ValueBox({required this.caption, required this.value});

  final String caption;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(caption, style: theme.textTheme.bodySmall),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
      ],
    );
  }
}
