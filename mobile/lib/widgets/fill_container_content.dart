/// Управление пробами в таре (c-7f + c-7g + c-9-fill-offline-2a-fix + 2c-2 + 2c-3-fix-3b).
///
/// c-9-fill-offline-2c-3-fix-3b: после офлайн-филла — `SyncProvider.refresh()`,
/// чтобы счётчик на кнопке «Синхронизация» обновился сразу.
library;

import 'package:flutter/material.dart' hide Container;
import 'package:provider/provider.dart';

import '../models/catalog.dart';
import '../models/container.dart';
import '../models/sample.dart';
import '../providers/sync_provider.dart';
import '../services/catalog_service.dart';
import '../services/sample_service.dart';
import '../utils/int_ranges.dart';
import '../utils/sample_range_parser.dart';
import 'range_edit_dialog.dart';
import 'sample_edit_dialog.dart';
import 'sample_status_chip.dart';

class FillContainerContent extends StatefulWidget {
  const FillContainerContent({
    super.key,
    required this.container,
    required this.onClose,
    required this.onSuccess,
  });

  final Container container;
  final VoidCallback onClose;
  final void Function(int containerId, int totalSamples) onSuccess;

  @override
  State<FillContainerContent> createState() => _FillContainerContentState();
}

class _AddedRange {
  _AddedRange({
    required this.id,
    required this.rawInput,
    required this.prefix,
    required this.middle,
    required this.sequenceFrom,
    required this.sequenceTo,
    required this.sequenceDigits,
    required this.wellName,
    required this.allSeqs,
    this.skippedSeqs = const [],
    this.selectedSeqs = const [],
  });

  final String id;
  final String rawInput;
  final String prefix;
  final String middle;
  final int sequenceFrom;
  final int sequenceTo;
  final int sequenceDigits;
  final String? wellName;
  final List<int> allSeqs;
  final List<int> skippedSeqs;
  final List<int> selectedSeqs;

  List<int> get validSeqs =>
      allSeqs.where((s) => !skippedSeqs.contains(s)).toList();
}

class _FillContainerContentState extends State<FillContainerContent> {
  final _inputCtrl = TextEditingController();
  final _numberCtrl = TextEditingController();

  List<_AddedRange> _ranges = [];
  List<int> _deletedIds = [];
  String? _inputError;
  String? _submitError;
  bool _submitting = false;

  List<Sample>? _existingSamples;
  bool _samplesLoading = true;
  String? _samplesError;

  List<String> _labPrefixes = const [];
  List<String> _sitePatterns = const [];

  _AddedRange? _editingRange;

  @override
  void initState() {
    super.initState();
    _loadSamples();
    _loadCatalogs();
  }

  @override
  void dispose() {
    _inputCtrl.dispose();
    _numberCtrl.dispose();
    super.dispose();
  }

  void _refreshSync() {
    if (!mounted) return;
    context.read<SyncProvider>().refresh();
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
        _existingSamples = samples;
        _samplesLoading = false;
        _deletedIds.removeWhere((id) => !samples.any((s) => s.id == id));
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _samplesError = 'Не удалось загрузить пробы: $e';
        _samplesLoading = false;
      });
    }
  }

  Future<void> _loadCatalogs() async {
    try {
      final catalog = context.read<CatalogService>();
      final results = await Future.wait<dynamic>([
        catalog.fetchLaboratories(),
        catalog.fetchSites(),
      ]);
      if (!mounted) return;
      final labs = results[0] as List<Laboratory>;
      final sites = results[1] as List<Site>;
      setState(() {
        _labPrefixes = labs.expand((l) => l.prefixes).toList(growable: false);
        _sitePatterns = sites
            .expand((s) => s.matchPatterns)
            .toList(growable: false);
      });
    } catch (_) {
      // Не критично.
    }
  }

  bool get _hasIncoming => widget.container.draftWorkOrderIncoming.isNotEmpty;

  Set<String> get _existingNumbers {
    final set = <String>{};
    for (final s in _existingSamples ?? const <Sample>[]) {
      if (!_deletedIds.contains(s.id)) set.add(s.sampleNumber);
    }
    for (final r in _ranges) {
      for (final seq in r.validSeqs) {
        set.add(
          '${r.prefix}${r.middle}${seq.toString().padLeft(r.sequenceDigits, '0')}',
        );
      }
    }
    return set;
  }

  void _handleAddRange() {
    setState(() => _inputError = null);
    final result = parseSampleInput(
      _inputCtrl.text,
      laboratoryPrefixes: _labPrefixes,
      siteMatchPatterns: _sitePatterns,
      hasIncomingWorkOrder: _hasIncoming,
    );
    if (!result.ok) {
      setState(() => _inputError = result.error);
      return;
    }
    final parsed = result.value!;
    final nums = buildSampleNumbers(parsed);
    final dupes = nums.where(_existingNumbers.contains).toList();
    if (dupes.isNotEmpty) {
      setState(
        () => _inputError = 'Проба уже добавлена: ${dupes.take(3).join(', ')}',
      );
      return;
    }

    final allSeqs = <int>[];
    for (var i = parsed.sequenceFrom; i <= parsed.sequenceTo; i++) {
      allSeqs.add(i);
    }

    setState(() {
      _ranges = [
        ..._ranges,
        _AddedRange(
          id: '${DateTime.now().microsecondsSinceEpoch}-${_ranges.length}',
          rawInput: _inputCtrl.text.trim(),
          prefix: parsed.prefix,
          middle: parsed.middle,
          sequenceFrom: parsed.sequenceFrom,
          sequenceTo: parsed.sequenceTo,
          sequenceDigits: parsed.sequenceDigits,
          wellName: parsed.wellName,
          allSeqs: allSeqs,
        ),
      ];
      _inputCtrl.clear();
    });
  }

  void _handleRemoveRange(String id) {
    setState(() {
      _ranges = _ranges.where((r) => r.id != id).toList();
    });
  }

  void _handleSaveRangeEdit(
    String newRaw,
    List<int> skipped,
    List<int> selected,
  ) {
    final editing = _editingRange;
    if (editing == null) return;

    final result = parseSampleInput(
      newRaw,
      laboratoryPrefixes: _labPrefixes,
      siteMatchPatterns: _sitePatterns,
      hasIncomingWorkOrder: _hasIncoming,
    );
    if (!result.ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Не удалось распознать: ${result.error}')),
      );
      return;
    }
    final parsed = result.value!;
    final allSeqs = <int>[];
    for (var i = parsed.sequenceFrom; i <= parsed.sequenceTo; i++) {
      allSeqs.add(i);
    }
    final validSkipped = skipped
        .where((s) => s >= parsed.sequenceFrom && s <= parsed.sequenceTo)
        .toList();
    final validSelected = selected
        .where((s) => s >= parsed.sequenceFrom && s <= parsed.sequenceTo)
        .toList();

    setState(() {
      _ranges = _ranges.map((r) {
        if (r.id != editing.id) return r;
        return _AddedRange(
          id: r.id,
          rawInput: newRaw,
          prefix: parsed.prefix,
          middle: parsed.middle,
          sequenceFrom: parsed.sequenceFrom,
          sequenceTo: parsed.sequenceTo,
          sequenceDigits: parsed.sequenceDigits,
          wellName: parsed.wellName,
          allSeqs: allSeqs,
          skippedSeqs: validSkipped,
          selectedSeqs: validSelected,
        );
      }).toList();
      _editingRange = null;
    });
  }

  Future<void> _handleDeleteExisting(Sample s) async {
    if (s.isOfflinePending) {
      final changed = await showDialog<bool>(
        context: context,
        builder: (_) =>
            SampleEditDialog(initial: s, containerId: widget.container.id),
      );
      if (changed == true && mounted) {
        await _loadSamples();
      }
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Удалить эту пробу?'),
        content: Text(s.sampleNumber),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Отмена'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Удалить'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      setState(() => _deletedIds = [..._deletedIds, s.id]);
    }
  }

  Future<void> _openEditSample(Sample s) async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (_) =>
          SampleEditDialog(initial: s, containerId: widget.container.id),
    );
    if (changed == true && mounted) {
      await _loadSamples();
    }
  }

  List<Map<String, dynamic>> _groupSeqs(
    _AddedRange range,
    List<int> seqs,
    String status,
  ) {
    if (seqs.isEmpty) return const [];
    final sorted = [...seqs]..sort();
    final groups = <Map<String, int>>[];
    var start = sorted[0];
    var prev = sorted[0];
    for (var i = 1; i < sorted.length; i++) {
      final v = sorted[i];
      if (v == prev + 1) {
        prev = v;
      } else {
        groups.add({'from': start, 'to': prev});
        start = v;
        prev = v;
      }
    }
    groups.add({'from': start, 'to': prev});

    return groups
        .map(
          (g) => {
            'prefix': range.prefix,
            'middle': range.middle,
            'sequence_from': g['from'],
            'sequence_to': g['to'],
            'sequence_digits': range.sequenceDigits,
            'well_name': range.wellName,
            'status': status,
          },
        )
        .toList();
  }

  String _summarizeRange(_AddedRange r) {
    final valid = r.validSeqs;
    if (valid.isEmpty) return 'все пропущены';
    final selected = valid.where(r.selectedSeqs.contains).toList();
    final normal = valid.where((s) => !r.selectedSeqs.contains(s)).toList();
    final parts = <String>[];
    if (normal.isNotEmpty) parts.add(formatIntRanges(normal));
    if (selected.isNotEmpty) parts.add('[Выб: ${formatIntRanges(selected)}]');
    return parts.join(' ');
  }

  int get _totalSamples {
    final existing = (_existingSamples ?? const <Sample>[])
        .where((s) => !_deletedIds.contains(s.id))
        .length;
    final added = _ranges.fold<int>(0, (acc, r) => acc + r.validSeqs.length);
    return existing + added;
  }

  Future<void> _handleSubmit() async {
    setState(() => _submitError = null);
    final sampleService = context.read<SampleService>();
    final trimmedNumber = _numberCtrl.text.trim();

    if (widget.container.containerNumber == null &&
        trimmedNumber.isEmpty &&
        (_existingSamples ?? const <Sample>[])
            .where((s) => !_deletedIds.contains(s.id))
            .isEmpty &&
        _ranges.isEmpty) {
      setState(() => _submitError = 'Укажите номер тары или добавьте пробы.');
      return;
    }

    final sampleGroups = <Map<String, dynamic>>[];
    var totalToCreate = 0;

    for (final r in _ranges) {
      final skipped = r.skippedSeqs.toSet();
      final selected = r.selectedSeqs.toSet();

      final normal = r.allSeqs
          .where((s) => !skipped.contains(s) && !selected.contains(s))
          .toList();
      sampleGroups.addAll(_groupSeqs(r, normal, 'NORMAL'));

      final sel = r.allSeqs
          .where((s) => selected.contains(s) && !skipped.contains(s))
          .toList();
      sampleGroups.addAll(_groupSeqs(r, sel, 'SELECTED'));

      totalToCreate += normal.length + sel.length;
    }

    setState(() => _submitting = true);

    try {
      for (final id in _deletedIds) {
        await sampleService.deleteSample(id);
      }

      FillOutcome? outcome;
      if (totalToCreate > 0) {
        final workOrderCoded = widget.container.draftWorkOrderCoded.trim();
        final researchTypeId = widget.container.draftResearchTypeId;
        if (workOrderCoded.isEmpty || researchTypeId == null) {
          if (!mounted) return;
          setState(() {
            _submitError = 'У тары нет данных для создания проб (Н/З или ТИ).';
            _submitting = false;
          });
          return;
        }

        outcome = await sampleService.fillSamples(
          widget.container.id,
          containerNumber: widget.container.containerNumber == null
              ? trimmedNumber
              : null,
          workOrderCoded: workOrderCoded,
          workOrderIncoming: widget.container.draftWorkOrderIncoming,
          researchTypeId: researchTypeId,
          siteId: widget.container.draftSiteId,
          sampleGroups: sampleGroups,
          researchTypeName: widget.container.draftResearchTypeName,
          siteName: widget.container.draftSiteName,
        );
      }

      if (!mounted) return;
      final existingCount = (_existingSamples ?? const <Sample>[])
          .where((s) => !_deletedIds.contains(s.id))
          .length;
      widget.onSuccess(widget.container.id, existingCount + totalToCreate);

      if (outcome == FillOutcome.queued) {
        _refreshSync();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Сохранено офлайн. Отправится при синхронизации.'),
          ),
        );
        await _loadSamples();
      }

      setState(() {
        _ranges = [];
        _deletedIds = [];
        _inputCtrl.clear();
        _numberCtrl.clear();
        _submitting = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitError = 'Не удалось сохранить: $e';
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final existing = (_existingSamples ?? const <Sample>[])
        .where((s) => !_deletedIds.contains(s.id))
        .toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_submitError != null) ...[
          Material(
            color: theme.colorScheme.errorContainer,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                _submitError!,
                style: TextStyle(color: theme.colorScheme.onErrorContainer),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
        if (widget.container.containerNumber == null) ...[
          TextField(
            controller: _numberCtrl,
            style: const TextStyle(fontFamily: 'monospace'),
            decoration: const InputDecoration(
              labelText: 'Номер тары',
              helperText: 'Присваивается один раз. Например: T-001',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
        ],
        Text('Добавить новые пробы', style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: TextField(
                controller: _inputCtrl,
                style: const TextStyle(fontFamily: 'monospace'),
                decoration: InputDecoration(
                  labelText: 'Диапазон проб',
                  helperText:
                      _inputError ??
                      'Например: TAA-A34076001-031 или TST124001-005',
                  errorText: _inputError,
                  border: const OutlineInputBorder(),
                ),
                onSubmitted: (_) => _handleAddRange(),
              ),
            ),
            const SizedBox(width: 8),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: OutlinedButton.icon(
                onPressed: _handleAddRange,
                icon: const Icon(Icons.add),
                label: const Text('Добавить'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_ranges.isEmpty)
          Text(
            'Новые диапазоны не добавлены.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          )
        else
          Card(
            child: Column(
              children: [
                for (var i = 0; i < _ranges.length; i++) ...[
                  _buildRangeRow(_ranges[i]),
                  if (i < _ranges.length - 1) const Divider(height: 1),
                ],
              ],
            ),
          ),
        const Divider(height: 32),
        Text(
          'Пробы в таре (${existing.length})',
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        if (_samplesLoading)
          const Center(child: CircularProgressIndicator())
        else if (_samplesError != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                _samplesError!,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ),
          )
        else if (existing.isEmpty)
          Text(
            'В таре нет проб.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          )
        else
          Card(
            child: Column(
              children: [
                for (var i = 0; i < existing.length; i++) ...[
                  _buildExistingRow(existing[i]),
                  if (i < existing.length - 1) const Divider(height: 1),
                ],
              ],
            ),
          ),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: Text(
                'Итого проб: $_totalSamples',
                style: theme.textTheme.bodyMedium,
              ),
            ),
            TextButton(
              onPressed: _submitting ? null : widget.onClose,
              child: const Text('Отмена'),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed:
                  _submitting || (_totalSamples == 0 && _deletedIds.isEmpty)
                  ? null
                  : _handleSubmit,
              child: Text(_submitting ? 'Сохранение...' : 'Сохранить'),
            ),
          ],
        ),
        if (_editingRange != null)
          RangeEditDialog(
            initialRaw: _editingRange!.rawInput,
            initialSkipped: _editingRange!.skippedSeqs.join(' '),
            initialSelected: _editingRange!.selectedSeqs.join(' '),
            onClose: () => setState(() => _editingRange = null),
            onSave: _handleSaveRangeEdit,
          ),
      ],
    );
  }

  Widget _buildRangeRow(_AddedRange r) {
    final theme = Theme.of(context);
    final valid = r.validSeqs;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  r.rawInput,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${_summarizeRange(r)} · проб: ${valid.length}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Редактировать диапазон',
            icon: const Icon(Icons.edit),
            onPressed: () => setState(() => _editingRange = r),
          ),
          IconButton(
            tooltip: 'Убрать из списка',
            icon: Icon(Icons.delete, color: theme.colorScheme.error),
            onPressed: () => _handleRemoveRange(r.id),
          ),
        ],
      ),
    );
  }

  Widget _buildExistingRow(Sample s) {
    final theme = Theme.of(context);
    final offline = s.isOfflinePending;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  s.sampleNumber,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    SampleStatusChip(status: s.status),
                    if (offline)
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: theme.colorScheme.tertiaryContainer,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.cloud_off,
                                size: 12,
                                color: theme.colorScheme.onTertiaryContainer,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'офлайн',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: theme.colorScheme.onTertiaryContainer,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: offline
                ? 'Редактировать (офлайн — только статус)'
                : 'Редактировать',
            icon: const Icon(Icons.edit),
            onPressed: () => _openEditSample(s),
          ),
          IconButton(
            tooltip: offline ? 'Удалить (локально)' : 'Удалить',
            icon: Icon(Icons.delete, color: theme.colorScheme.error),
            onPressed: () => _handleDeleteExisting(s),
          ),
        ],
      ),
    );
  }
}
