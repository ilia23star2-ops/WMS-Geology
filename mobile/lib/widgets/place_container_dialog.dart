/// Диалог размещения тары (c-7c).
///
/// Каскад `Room → Rack → Section → Tier → Cell` для размещения в ячейку,
/// либо одиночный `Room` для размещения на пол в комнате.
///
/// Backend: `POST /storage/containers/bulk-place/`
/// (`{"container_ids": [id], "cell_id": n}` или
/// `{"container_ids": [id], "floor_room_id": n}`).
///
/// Возвращает `PlaceOutcome?` через `Navigator.pop`:
/// - `PlaceOutcome.online` — POST ушёл на сервер;
/// - `PlaceOutcome.queued` — POST отложен в `sync_queue` (офлайн);
/// - `null` — отмена.
///
/// Родитель (`ContainerDetailScreen._onPlace`) для `online` перезагружает
/// карточку через `ContainerService.fetchById`, для `queued` — показывает
/// SnackBar «Отправится при синхронизации».
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/catalog.dart';
import '../services/catalog_service.dart';
import '../services/container_service.dart';

enum _PlaceMode { cell, floor }

class PlaceContainerDialog extends StatefulWidget {
  const PlaceContainerDialog({
    super.key,
    required this.containerId,
    this.currentLocation,
  });

  final int containerId;

  /// Текущее место (для отображения в шапке диалога). Опционально.
  final String? currentLocation;

  @override
  State<PlaceContainerDialog> createState() => _PlaceContainerDialogState();
}

class _PlaceContainerDialogState extends State<PlaceContainerDialog> {
  _PlaceMode _mode = _PlaceMode.cell;

  List<NamedCatalog> _rooms = const [];
  List<NamedCatalog> _racks = const [];
  List<NamedCatalog> _sections = const [];
  List<NamedCatalog> _tiers = const [];
  List<NamedCatalog> _cells = const [];

  int? _roomId;
  int? _rackId;
  int? _sectionId;
  int? _tierId;
  int? _cellId;

  bool _loadingRooms = true;
  bool _loadingRacks = false;
  bool _loadingSections = false;
  bool _loadingTiers = false;
  bool _loadingCells = false;
  bool _submitting = false;

  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRooms();
  }

  Future<void> _loadRooms() async {
    setState(() {
      _loadingRooms = true;
      _error = null;
    });
    final catalog = context.read<CatalogService>();
    try {
      final rooms = await catalog.fetchRooms();
      if (!mounted) return;
      setState(() {
        _rooms = rooms;
        _loadingRooms = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось загрузить комнаты: $e';
        _loadingRooms = false;
      });
    }
  }

  Future<void> _onRoomChanged(int? id) async {
    setState(() {
      _roomId = id;
      _rackId = null;
      _sectionId = null;
      _tierId = null;
      _cellId = null;
      _racks = const [];
      _sections = const [];
      _tiers = const [];
      _cells = const [];
    });
    if (id == null || _mode == _PlaceMode.floor) return;

    setState(() => _loadingRacks = true);
    final catalog = context.read<CatalogService>();
    try {
      final racks = await catalog.fetchRacks(id);
      if (!mounted) return;
      setState(() {
        _racks = racks;
        _loadingRacks = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось загрузить стеллажи: $e';
        _loadingRacks = false;
      });
    }
  }

  Future<void> _onRackChanged(int? id) async {
    setState(() {
      _rackId = id;
      _sectionId = null;
      _tierId = null;
      _cellId = null;
      _sections = const [];
      _tiers = const [];
      _cells = const [];
    });
    if (id == null) return;

    setState(() => _loadingSections = true);
    final catalog = context.read<CatalogService>();
    try {
      final sections = await catalog.fetchSections(id);
      if (!mounted) return;
      setState(() {
        _sections = sections;
        _loadingSections = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось загрузить секции: $e';
        _loadingSections = false;
      });
    }
  }

  Future<void> _onSectionChanged(int? id) async {
    setState(() {
      _sectionId = id;
      _tierId = null;
      _cellId = null;
      _tiers = const [];
      _cells = const [];
    });
    if (id == null) return;

    setState(() => _loadingTiers = true);
    final catalog = context.read<CatalogService>();
    try {
      final tiers = await catalog.fetchTiers(id);
      if (!mounted) return;
      setState(() {
        _tiers = tiers;
        _loadingTiers = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось загрузить ярусы: $e';
        _loadingTiers = false;
      });
    }
  }

  Future<void> _onTierChanged(int? id) async {
    setState(() {
      _tierId = id;
      _cellId = null;
      _cells = const [];
    });
    if (id == null) return;

    setState(() => _loadingCells = true);
    final catalog = context.read<CatalogService>();
    try {
      final cells = await catalog.fetchCells(id);
      if (!mounted) return;
      setState(() {
        _cells = cells;
        _loadingCells = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось загрузить ячейки: $e';
        _loadingCells = false;
      });
    }
  }

  bool get _canSubmit {
    if (_submitting) return false;
    if (_mode == _PlaceMode.floor) return _roomId != null;
    return _cellId != null;
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);
    final service = context.read<ContainerService>();
    try {
      final outcome = await service.bulkPlace(
        containerIds: [widget.containerId],
        cellId: _mode == _PlaceMode.cell ? _cellId : null,
        floorRoomId: _mode == _PlaceMode.floor ? _roomId : null,
      );
      if (!mounted) return;
      Navigator.of(context).pop<PlaceOutcome>(outcome);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Не удалось разместить: $e';
      });
    }
  }

  void _onModeChanged(_PlaceMode newMode) {
    if (newMode == _mode) return;
    setState(() {
      _mode = newMode;
      _roomId = null;
      _rackId = null;
      _sectionId = null;
      _tierId = null;
      _cellId = null;
      _racks = const [];
      _sections = const [];
      _tiers = const [];
      _cells = const [];
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: const Text('Разместить тару'),
      scrollable: true,
      content: SizedBox(
        width: 440,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.currentLocation != null &&
                widget.currentLocation!.isNotEmpty) ...[
              Text(
                'Текущее место: ${widget.currentLocation}',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 12),
            ],
            SegmentedButton<_PlaceMode>(
              segments: const [
                ButtonSegment(
                  value: _PlaceMode.cell,
                  label: Text('В ячейку'),
                  icon: Icon(Icons.grid_on_outlined),
                ),
                ButtonSegment(
                  value: _PlaceMode.floor,
                  label: Text('На пол'),
                  icon: Icon(Icons.layers_outlined),
                ),
              ],
              selected: {_mode},
              onSelectionChanged: (s) => _onModeChanged(s.first),
            ),
            const SizedBox(height: 16),
            _dropdownField(
              label: 'Комната',
              value: _roomId,
              items: _rooms,
              loading: _loadingRooms,
              onChanged: _onRoomChanged,
            ),
            if (_mode == _PlaceMode.cell) ...[
              const SizedBox(height: 8),
              _dropdownField(
                label: 'Стеллаж',
                value: _rackId,
                items: _racks,
                loading: _loadingRacks,
                onChanged: _onRackChanged,
                enabled: _roomId != null,
              ),
              const SizedBox(height: 8),
              _dropdownField(
                label: 'Секция',
                value: _sectionId,
                items: _sections,
                loading: _loadingSections,
                onChanged: _onSectionChanged,
                enabled: _rackId != null,
              ),
              const SizedBox(height: 8),
              _dropdownField(
                label: 'Ярус',
                value: _tierId,
                items: _tiers,
                loading: _loadingTiers,
                onChanged: _onTierChanged,
                enabled: _sectionId != null,
              ),
              const SizedBox(height: 8),
              _dropdownField(
                label: 'Ячейка',
                value: _cellId,
                items: _cells,
                loading: _loadingCells,
                onChanged: (v) => setState(() => _cellId = v),
                enabled: _tierId != null,
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Отмена'),
        ),
        FilledButton(
          onPressed: _canSubmit ? _submit : null,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Разместить'),
        ),
      ],
    );
  }

  Widget _dropdownField({
    required String label,
    required int? value,
    required List<NamedCatalog> items,
    required ValueChanged<int?>? onChanged,
    required bool loading,
    bool enabled = true,
  }) {
    if (loading) {
      return InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          isDense: true,
        ),
        child: const LinearProgressIndicator(),
      );
    }
    final values = items.map((e) => e.id).toSet();
    final safeValue = value != null && values.contains(value) ? value : null;
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: safeValue,
          isExpanded: true,
          hint: Text(
            !enabled ? '—' : (items.isEmpty ? 'Нет данных' : 'Выберите'),
          ),
          items: items
              .map(
                (e) => DropdownMenuItem<int>(
                  value: e.id,
                  child: Text(e.label, overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(),
          onChanged: enabled ? onChanged : null,
        ),
      ),
    );
  }
}
