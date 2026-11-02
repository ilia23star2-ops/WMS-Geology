/// Карточка тары после сканирования QR (c-7a + landscape fix).
///
/// Разный layout под ориентацию:
/// - **Портрет** — `AppBar` с `TabBar.bottom` + `NestedScrollView`:
///   шапка (`SliverToBoxAdapter`) растягивается на натуральную высоту,
///   при скролле уезжает вверх. `TabBar` всегда прилипает.
/// - **Ландшафт** — `Row`: слева панель с метаданными (скроллится
///   отдельно), справа `TabBar` + `TabBarView`. Вкладки на всю высоту.
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

class ContainerDetailScreen extends StatefulWidget {
  const ContainerDetailScreen({super.key, required this.container});

  final Container container;

  @override
  State<ContainerDetailScreen> createState() => _ContainerDetailScreenState();
}

class _ContainerDetailScreenState extends State<ContainerDetailScreen> {
  // Пробы
  List<Sample>? _samples;
  String? _samplesError;
  bool _samplesLoading = true;

  // История
  List<ContainerHistoryEntry>? _history;
  String? _historyError;
  bool _historyLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSamples();
    _loadHistory();
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

  Future<void> _loadHistory() async {
    setState(() {
      _historyLoading = true;
      _historyError = null;
    });
    try {
      final service = context.read<ContainerService>();
      final entries = await service.fetchHistory(widget.container.id);
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final container = widget.container;
    return DefaultTabController(
      length: 3,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isLandscape = constraints.maxWidth > constraints.maxHeight;
          return isLandscape
              ? _buildLandscape(context, theme, container, constraints)
              : _buildPortrait(context, theme, container);
        },
      ),
    );
  }

  // ----------------------------------------------------------
  // Портрет: AppBar + TabBar.bottom, шапка отдельным sliver'ом
  // ----------------------------------------------------------
  Widget _buildPortrait(
    BuildContext context,
    ThemeData theme,
    Container container,
  ) {
    return Scaffold(
      appBar: AppBar(
        title: Text(container.displayName),
        backgroundColor: theme.colorScheme.inversePrimary,
        actions: [
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
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) {
          return [
            // Шапка — обычный sliver, растягивается на свою высоту.
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildHeader(context, container),
                    const SizedBox(height: 8),
                    _buildActionButtons(context, container),
                  ],
                ),
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

  // ----------------------------------------------------------
  // Ландшафт: слева панель с метаданными, справа вкладки
  // ----------------------------------------------------------
  Widget _buildLandscape(
    BuildContext context,
    ThemeData theme,
    Container container,
    BoxConstraints constraints,
  ) {
    final panelWidth = (constraints.maxWidth * 0.4).clamp(320.0, 460.0);
    return Scaffold(
      appBar: AppBar(
        title: Text(container.displayName),
        backgroundColor: theme.colorScheme.inversePrimary,
        actions: [
          IconButton(
            tooltip: 'Обновить',
            icon: const Icon(Icons.refresh),
            onPressed: _refreshAll,
          ),
        ],
      ),
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: panelWidth,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildHeader(context, container),
                const SizedBox(height: 8),
                _buildActionButtons(context, container),
              ],
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

  Widget _buildHeader(BuildContext context, Container container) {
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

  Widget _buildActionButtons(BuildContext context, Container container) {
    final canPlace = container.status != ContainerStatus.active;
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
          Text(sample.statusLabel, style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }

  Widget _buildEditTab(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Icon(
                  Icons.construction,
                  size: 48,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                const SizedBox(height: 12),
                Text(
                  'Редактирование тары',
                  style: theme.textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Форма редактирования появится в следующем заходе.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ],
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
