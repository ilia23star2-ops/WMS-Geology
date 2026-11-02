/// Карточка тары после сканирования QR (c-7a + c-7b + c-7f + landscape fix).
///
/// Вкладки (как в вебе):
/// - **Пробы** — список проб внутри.
/// - **Редактирование** — `FillContainerContent` (диапазоны + существующие).
/// - **История** — аудит.
///
/// Карандаш ✏ в `AppBar` — форма шапки (`ContainerEditForm`) в bottom sheet.
///
/// c-7b-fix: кнопки `[Предпросмотр] [Разместить]` в `bottomNavigationBar`
/// + `SafeArea` — не уходят под системный бар.
///
/// c-7f-fix: в `_sampleTile` убраны надписи «ТИ · Н/З» — они уже в шапке.
///
/// ВАЖНО: `hide Container` — иначе конфликт имён с Flutter-виджетом
/// `Container` (flutter/src/widgets/container.dart).
library;

import 'package:flutter/material.dart' hide Container;
import 'package:provider/provider.dart';

import '../models/container.dart';
import '../models/container_history_entry.dart';
import '../models/sample.dart';
import '../services/container_service.dart';
import '../services/sample_service.dart';
import '../widgets/container_edit_form.dart';
import '../widgets/fill_container_content.dart';

class ContainerDetailScreen extends StatefulWidget {
  const ContainerDetailScreen({super.key, required this.container});

  final Container container;

  @override
  State<ContainerDetailScreen> createState() => _ContainerDetailScreenState();
}

class _ContainerDetailScreenState extends State<ContainerDetailScreen> {
  late Container _container;

  List<Sample>? _samples;
  String? _samplesError;
  bool _samplesLoading = true;

  List<ContainerHistoryEntry>? _history;
  String? _historyError;
  bool _historyLoading = true;

  @override
  void initState() {
    super.initState();
    _container = widget.container;
    _loadSamples();
    _loadHistory();
  }

  Future<void> _loadSamples() async {
    setState(() {
      _samplesLoading = true;
      _samplesError = null;
    });
    try {
      final samples = await context.read<SampleService>().fetchByContainerId(
        _container.id,
      );
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

  Future<void> _loadHistory() async {
    setState(() {
      _historyLoading = true;
      _historyError = null;
    });
    try {
      final entries = await context.read<ContainerService>().fetchHistory(
        _container.id,
      );
      if (!mounted) return;
      setState(() {
        _history = entries;
        _historyLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _historyError = 'Не удалось загрузить историю: $e';
        _historyLoading = false;
      });
    }
  }

  Future<void> _refreshAll() async {
    await Future.wait([_loadSamples(), _loadHistory()]);
  }

  Future<void> _onSaveEdit(Map<String, dynamic> payload) async {
    try {
      final updated = await context.read<ContainerService>().update(
        _container.id,
        payload,
      );
      if (!mounted) return;
      setState(() => _container = updated);
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Тара сохранена')));
      _loadHistory();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Не удалось сохранить: $e')));
    }
  }

  void _openEditSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.85,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Редактировать шапку тары',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ContainerEditForm(
                  key: ValueKey(_container.updatedAt),
                  initial: _container,
                  onSubmit: _onSaveEdit,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DefaultTabController(
      length: 3,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isLandscape = constraints.maxWidth > constraints.maxHeight;
          return isLandscape
              ? _buildLandscape(context, theme, constraints)
              : _buildPortrait(context, theme);
        },
      ),
    );
  }

  Widget _buildPortrait(BuildContext context, ThemeData theme) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_container.displayName),
        backgroundColor: theme.colorScheme.inversePrimary,
        actions: [
          IconButton(
            tooltip: 'Редактировать шапку',
            icon: const Icon(Icons.edit),
            onPressed: _openEditSheet,
          ),
          IconButton(
            tooltip: 'Обновить',
            icon: const Icon(Icons.refresh),
            onPressed: _refreshAll,
          ),
        ],
        bottom: const TabBar(
          tabs: [
            Tab(icon: Icon(Icons.science_outlined), text: 'Пробы'),
            Tab(icon: Icon(Icons.edit_outlined), text: 'Редактирование'),
            Tab(icon: Icon(Icons.history), text: 'История'),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomBar(context),
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) {
          return [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: _buildHeader(context),
              ),
            ),
          ];
        },
        body: TabBarView(
          children: [
            _buildSamplesTab(context),
            _buildEditTab(context),
            _buildHistoryTab(context),
          ],
        ),
      ),
    );
  }

  Widget _buildLandscape(
    BuildContext context,
    ThemeData theme,
    BoxConstraints constraints,
  ) {
    final panelWidth = (constraints.maxWidth * 0.4).clamp(320.0, 460.0);
    return Scaffold(
      appBar: AppBar(
        title: Text(_container.displayName),
        backgroundColor: theme.colorScheme.inversePrimary,
        actions: [
          IconButton(
            tooltip: 'Редактировать шапку',
            icon: const Icon(Icons.edit),
            onPressed: _openEditSheet,
          ),
          IconButton(
            tooltip: 'Обновить',
            icon: const Icon(Icons.refresh),
            onPressed: _refreshAll,
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomBar(context),
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: panelWidth,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [_buildHeader(context)],
            ),
          ),
          const VerticalDivider(width: 1, thickness: 1),
          Expanded(
            child: Column(
              children: [
                const TabBar(
                  tabs: [
                    Tab(icon: Icon(Icons.science_outlined), text: 'Пробы'),
                    Tab(
                      icon: Icon(Icons.edit_outlined),
                      text: 'Редактирование',
                    ),
                    Tab(icon: Icon(Icons.history), text: 'История'),
                  ],
                ),
                Expanded(
                  child: TabBarView(
                    children: [
                      _buildSamplesTab(context),
                      _buildEditTab(context),
                      _buildHistoryTab(context),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      elevation: 0,
      child: SafeArea(
        top: false,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: theme.dividerColor, width: 1),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: _buildActionButtons(context),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final container = _container;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _row(context, 'Номер', container.displayName, mono: true),
            _row(context, 'ID', '#${container.id}'),
            _row(context, 'Статус', container.statusLabel),
            _row(
              context,
              'Тип тары',
              container.containerTypeName ?? 'ID ${container.containerType}',
            ),
            _row(context, 'Локация', container.locationLabel),
            if (container.positionOnPallet != null)
              _row(
                context,
                'Позиция на поддоне',
                '${container.positionOnPallet}',
              ),
            if (container.draftSiteName != null ||
                container.draftResearchTypeName != null ||
                container.draftWorkOrderCoded.isNotEmpty) ...[
              const Divider(height: 24),
              if (container.draftSiteName != null)
                _row(context, 'Участок (черновик)', container.draftSiteName!),
              if (container.draftResearchTypeName != null)
                _row(
                  context,
                  'ТИ (черновик)',
                  container.draftResearchTypeName!,
                ),
              if (container.draftWorkOrderCoded.isNotEmpty)
                _row(context, 'Н/З (черновик)', container.draftWorkOrderCoded),
              if (container.draftWorkOrderIncoming.isNotEmpty)
                _row(
                  context,
                  'Н/З вх. (черновик)',
                  container.draftWorkOrderIncoming,
                ),
            ],
            if (container.commentTemplateText != null &&
                container.commentTemplateText!.isNotEmpty)
              _row(
                context,
                'Комментарий (шаблон)',
                container.commentTemplateText!,
              ),
            if (container.comment.isNotEmpty)
              _row(context, 'Комментарий', container.comment),
            if (container.createdAt != null)
              _row(
                context,
                'Создана',
                container.createdAt!.toLocal().toString().split('.').first,
              ),
            if (container.labelPrintedAt != null)
              _row(
                context,
                'Этикетка напечатана',
                container.labelPrintedAt!.toLocal().toString().split('.').first,
              ),
            if (container.printBatchStatus != null)
              _row(
                context,
                'Партия печати',
                _printBatchLabel(container.printBatchStatus!),
              ),
          ],
        ),
      ),
    );
  }

  String _printBatchLabel(String status) {
    switch (status) {
      case 'DRAFT':
        return 'Черновик';
      case 'READY':
        return 'Готова к печати';
      case 'PRINTED':
        return 'Напечатана';
      default:
        return status;
    }
  }

  Widget _buildActionButtons(BuildContext context) {
    final canPlace = _container.status != ContainerStatus.active;
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: null, // c-7d
            icon: const Icon(Icons.picture_as_pdf_outlined),
            label: const Text('Предпросмотр'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: FilledButton.icon(
            onPressed: null, // c-7c
            icon: const Icon(Icons.place_outlined),
            label: Text(canPlace ? 'Разместить' : 'Местоположение'),
          ),
        ),
      ],
    );
  }

  Widget _buildSamplesTab(BuildContext context) {
    final theme = Theme.of(context);

    if (_samplesLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_samplesError != null) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
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
          ),
        ],
      );
    }

    final samples = _samples ?? const <Sample>[];
    if (samples.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('В таре нет проб.'),
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: samples.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (_, i) => _sampleTile(context, samples[i], i + 1),
    );
  }

  /// c-7f-fix: только номер пробы + статус. ТИ и Н/З — в шапке тары,
  /// не дублируем под каждой пробой.
  Widget _sampleTile(BuildContext context, Sample sample, int num) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
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
            child: Text(
              sample.sampleNumber,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(sample.statusLabel, style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }

  Widget _buildEditTab(BuildContext context) {
    return FillContainerContent(
      key: ValueKey('fill-${_container.updatedAt}'),
      container: _container,
      onClose: () {},
      onSuccess: (containerId, totalSamples) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Проб в таре: $totalSamples')));
        _loadSamples();
        _loadHistory();
      },
    );
  }

  Widget _buildHistoryTab(BuildContext context) {
    final theme = Theme.of(context);

    if (_historyLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_historyError != null) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(
                    _historyError!,
                    style: TextStyle(color: theme.colorScheme.error),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _loadHistory,
                    child: const Text('Повторить'),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    final entries = _history ?? const <ContainerHistoryEntry>[];
    if (entries.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('История пуста.'),
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: entries.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (_, i) => _historyTile(context, entries[i]),
    );
  }

  Widget _historyTile(BuildContext context, ContainerHistoryEntry entry) {
    final theme = Theme.of(context);
    final created = entry.createdAt?.toLocal().toString().split('.').first;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            _historyIcon(entry.action),
            size: 20,
            color: theme.colorScheme.primary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.actionDisplay.isNotEmpty
                      ? entry.actionDisplay
                      : entry.action,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (entry.username != null) entry.username,
                    if (created != null) created,
                  ].join(' · '),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _historyIcon(String action) {
    switch (action) {
      case 'CREATE':
        return Icons.add_circle_outline;
      case 'UPDATE':
        return Icons.edit_outlined;
      case 'DELETE':
        return Icons.delete_outline;
      case 'FILL_SAMPLES':
        return Icons.science_outlined;
      case 'PLACE':
        return Icons.place_outlined;
      case 'CREATE_IN_CELL':
        return Icons.add_box_outlined;
      default:
        return Icons.history;
    }
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
