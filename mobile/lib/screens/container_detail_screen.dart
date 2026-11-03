/// Карточка тары после сканирования QR (c-7a + c-7b + c-7f + c-7g + c-7d + c-7c + c-9-overflow-fix-2 + c-9-container-list-actions).
///
/// Вкладки: Пробы (0) / Редактирование (1) / История (2).
/// `initialTabIndex` — какая вкладка открывается первой (по умолчанию 0).
/// Реестр тары использует `initialTabIndex: 1` для кнопки «Заполнить»
/// у тар в статусе `PENDING_FILLING`.
///
/// Карандаш ✏ в `AppBar` — форма шапки (`ContainerEditForm`).
/// c-7d: «Предпросмотр» — PDF этикетки (online + offline-fallback).
/// c-7c: «Разместить» / «Местоположение» — раздельные кнопки, как в вебе.
///
/// ВАЖНО: `hide Container` — иначе конфликт имён с Flutter-виджетом.
library;

import 'dart:io';

import 'package:flutter/material.dart' hide Container;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';

import '../models/container.dart';
import '../models/container_history_entry.dart';
import '../models/label_data.dart';
import '../models/sample.dart';
import '../services/api_client.dart';
import '../services/container_service.dart';
import '../services/label_service.dart';
import '../services/sample_service.dart';
import '../widgets/container_edit_form.dart';
import '../widgets/container_location_dialog.dart';
import '../widgets/fill_container_content.dart';
import '../widgets/place_container_dialog.dart';
import '../widgets/sample_edit_dialog.dart';
import '../widgets/sample_status_chip.dart';

class ContainerDetailScreen extends StatefulWidget {
  const ContainerDetailScreen({
    super.key,
    required this.container,
    this.initialTabIndex = 0,
  });

  final Container container;

  /// c-9-container-list-actions: 0 — Пробы, 1 — Редактирование, 2 — История.
  /// Реестр открывает с `initialTabIndex: 1` для кнопки «Заполнить».
  final int initialTabIndex;

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

  final _searchCtrl = TextEditingController();
  final Set<int> _selectedIds = {};
  SampleStatus? _bulkStatus;
  bool _bulkLoading = false;

  bool _previewLoading = false;

  @override
  void initState() {
    super.initState();
    _container = widget.container;
    _loadSamples();
    _loadHistory();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
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
        _selectedIds.removeWhere((id) => !samples.any((s) => s.id == id));
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

  Future<void> _openEditSample(Sample s) async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (_) => SampleEditDialog(initial: s),
    );
    if (changed == true && mounted) {
      _loadSamples();
      _loadHistory();
    }
  }

  Future<void> _applyBulkStatus() async {
    if (_bulkStatus == null || _selectedIds.isEmpty) return;
    setState(() => _bulkLoading = true);
    final service = context.read<SampleService>();
    final failed = <int>[];
    for (final id in _selectedIds) {
      try {
        await service.update(id, {'status': sampleStatusToApi(_bulkStatus!)});
      } catch (_) {
        failed.add(id);
      }
    }
    if (!mounted) return;
    setState(() {
      _bulkLoading = false;
      _selectedIds.clear();
      _bulkStatus = null;
    });
    if (failed.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Не удалось обновить ${failed.length} проб')),
      );
    }
    await _loadSamples();
    await _loadHistory();
  }

  Future<void> _onPreview() async {
    if (_previewLoading) return;
    setState(() => _previewLoading = true);
    final service = context.read<ContainerService>();
    final samplesForOffline = _samples ?? const <Sample>[];
    try {
      final bytes = await service.fetchLabelPdf(_container.id);
      if (!mounted) return;

      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/label-${_container.id}.pdf');
      await file.writeAsBytes(bytes, flush: true);

      final result = await OpenFilex.open(file.path);
      if (!mounted) return;
      if (result.type != ResultType.done) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось открыть PDF: ${result.message}')),
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.isNetworkError) {
        await _renderOfflinePreview(samplesForOffline);
      } else {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Не удалось открыть PDF: $e')));
    } finally {
      if (mounted) setState(() => _previewLoading = false);
    }
  }

  Future<void> _renderOfflinePreview(List<Sample> samples) async {
    try {
      final data = LabelData.fromContainer(_container, samples);
      final ok = await LabelService.openInViewer(data);
      if (!mounted) return;
      if (!ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не удалось открыть PDF офлайн')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Ошибка офлайн-рендера: $e')));
    }
  }

  Future<void> _onPlace() async {
    final service = context.read<ContainerService>();
    final outcome = await showDialog<PlaceOutcome>(
      context: context,
      builder: (_) => PlaceContainerDialog(
        containerId: _container.id,
        currentLocation: _container.locationLabel,
      ),
    );
    if (outcome == null || !mounted) return;

    if (outcome == PlaceOutcome.queued) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Размещение сохранено. Отправится при синхронизации.'),
        ),
      );
      return;
    }

    try {
      final updated = await service.fetchById(_container.id);
      if (!mounted) return;
      setState(() => _container = updated);
      _loadHistory();
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Тара размещена')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Размещено, но не удалось обновить: $e')),
      );
    }
  }

  Future<void> _onShowLocation() {
    return showDialog<void>(
      context: context,
      builder: (_) => ContainerLocationDialog(container: _container),
    );
  }

  List<Sample> get _filteredSamples {
    final all = _samples ?? const <Sample>[];
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return all;
    return all
        .where(
          (s) =>
              s.sampleNumber.toLowerCase().contains(q) ||
              (s.wellName ?? '').toLowerCase().contains(q),
        )
        .toList();
  }

  void _toggleSelect(int id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        _selectedIds.add(id);
      }
    });
  }

  void _toggleSelectAll() {
    final filtered = _filteredSamples;
    setState(() {
      if (_selectedIds.length == filtered.length && filtered.isNotEmpty) {
        _selectedIds.clear();
      } else {
        _selectedIds.addAll(filtered.map((s) => s.id));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DefaultTabController(
      length: 3,
      initialIndex: widget.initialTabIndex.clamp(0, 2),
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
    final canPlace =
        _container.status == ContainerStatus.pendingFilling ||
        _container.status == ContainerStatus.pendingPlacement;
    final hasCell = _container.cellId != null;

    final buttons = <Widget>[
      Expanded(
        child: OutlinedButton.icon(
          onPressed: _previewLoading ? null : _onPreview,
          icon: _previewLoading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.picture_as_pdf_outlined),
          label: Text(_previewLoading ? 'Загрузка...' : 'Предпросмотр'),
        ),
      ),
    ];

    if (canPlace) {
      buttons.add(const SizedBox(width: 8));
      buttons.add(
        Expanded(
          child: FilledButton.icon(
            onPressed: () => _onPlace(),
            icon: const Icon(Icons.inventory_2_outlined),
            label: const Text('Разместить'),
          ),
        ),
      );
    }

    if (hasCell) {
      buttons.add(const SizedBox(width: 8));
      buttons.add(
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _onShowLocation,
            icon: const Icon(Icons.place_outlined),
            label: const Text('Местоположение'),
          ),
        ),
      );
    }

    return Row(children: buttons);
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

    final filtered = _filteredSamples;
    final all = _samples ?? const <Sample>[];
    if (all.isEmpty) {
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

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: TextField(
            controller: _searchCtrl,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Поиск по номеру или скважине',
              border: OutlineInputBorder(),
              isDense: true,
            ),
            onChanged: (_) => setState(() {}),
          ),
        ),
        if (_selectedIds.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Выбрано: ${_selectedIds.length}',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<SampleStatus>(
                        initialValue: _bulkStatus,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          isDense: true,
                          border: OutlineInputBorder(),
                          labelText: 'Сменить статус',
                        ),
                        items: SampleStatus.values
                            .map(
                              (s) => DropdownMenuItem<SampleStatus>(
                                value: s,
                                child: Text(
                                  sampleStatusLabels[s] ?? s.name,
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: _bulkLoading
                            ? null
                            : (v) => setState(() => _bulkStatus = v),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: _bulkLoading || _bulkStatus == null
                          ? null
                          : _applyBulkStatus,
                      child: _bulkLoading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Применить'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Checkbox(
                value:
                    filtered.isNotEmpty &&
                    _selectedIds.length == filtered.length,
                onChanged: (_) => _toggleSelectAll(),
              ),
              Text(
                'Проб: ${filtered.length}',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Нет проб по фильтру'))
              : ListView.separated(
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) =>
                      _sampleTile(context, filtered[i], i + 1),
                ),
        ),
      ],
    );
  }

  Widget _sampleTile(BuildContext context, Sample sample, int num) {
    final theme = Theme.of(context);
    final selected = _selectedIds.contains(sample.id);
    return InkWell(
      onTap: () => _openEditSample(sample),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          children: [
            Checkbox(
              value: selected,
              onChanged: (_) => _toggleSelect(sample.id),
            ),
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
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            const SizedBox(width: 8),
            SampleStatusChip(status: sample.status),
            IconButton(
              tooltip: 'Редактировать',
              icon: const Icon(Icons.edit, size: 18),
              onPressed: () => _openEditSample(sample),
            ),
          ],
        ),
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
