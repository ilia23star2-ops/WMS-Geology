/// Карточка тары после сканирования QR.
///
/// Показывает:
/// - основные поля тары (номер, статус, тип, локация, комментарий);
/// - список проб внутри (номер, тип исследования, Н/З, статус).
///
/// Пробы грузятся асинхронно при открытии экрана.
///
/// ВАЖНО: `hide Container` — иначе конфликт имён с Flutter-виджетом
/// `Container` (flutter/src/widgets/container.dart).
library;

import 'package:flutter/material.dart' hide Container;
import 'package:provider/provider.dart';

import '../models/container.dart';
import '../models/sample.dart';
import '../services/sample_service.dart';

class ContainerDetailScreen extends StatefulWidget {
  const ContainerDetailScreen({super.key, required this.container});

  final Container container;

  @override
  State<ContainerDetailScreen> createState() => _ContainerDetailScreenState();
}

class _ContainerDetailScreenState extends State<ContainerDetailScreen> {
  List<Sample>? _samples;
  String? _samplesError;
  bool _samplesLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSamples();
  }

  Future<void> _loadSamples() async {
    setState(() {
      _samplesLoading = true;
      _samplesError = null;
    });
    try {
      final service = context.read<SampleService>();
      final samples = await service.fetchByContainerId(widget.container.id);
      if (!mounted) return;
      setState(() {
        _samples = samples;
        _samplesLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _samplesError = 'Не удалось загрузить пробы: $e';
        _samplesLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final container = widget.container;
    return Scaffold(
      appBar: AppBar(
        title: Text(container.containerNumber),
        backgroundColor: theme.colorScheme.inversePrimary,
      ),
      body: RefreshIndicator(
        onRefresh: _loadSamples,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildContainerCard(context, container),
            const SizedBox(height: 16),
            Text(
              'Пробы внутри',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            _buildSamplesSection(context),
          ],
        ),
      ),
    );
  }

  Widget _buildContainerCard(BuildContext context, Container container) {
    return Card(
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
              _row(context, 'На полу в комнате', 'ID ${container.floorRoom}'),
            if (container.positionOnPallet != null)
              _row(context, 'Позиция на поддоне',
                  '${container.positionOnPallet}'),
            if (container.qrCode != null && container.qrCode!.isNotEmpty)
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
    );
  }

  Widget _buildSamplesSection(BuildContext context) {
    final theme = Theme.of(context);

    if (_samplesLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_samplesError != null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Text(
                _samplesError!,
                style: TextStyle(color: theme.colorScheme.error),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _loadSamples,
                child: const Text('Повторить'),
              ),
            ],
          ),
        ),
      );
    }

    final samples = _samples ?? const <Sample>[];
    if (samples.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('В таре нет проб.'),
        ),
      );
    }

    return Card(
      child: Column(
        children: [
          for (var i = 0; i < samples.length; i++) ...[
            _sampleTile(context, samples[i], i + 1),
            if (i < samples.length - 1) const Divider(height: 1),
          ],
        ],
      ),
    );
  }

  Widget _sampleTile(BuildContext context, Sample sample, int num) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 32,
            child: Text(
              '$num.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sample.sampleNumber,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${sample.researchTypeName}'
                  '${sample.currentWorkOrderNumber != null ? " · Н/З ${sample.currentWorkOrderNumber}" : ""}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            sample.statusLabel,
            style: theme.textTheme.bodySmall,
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