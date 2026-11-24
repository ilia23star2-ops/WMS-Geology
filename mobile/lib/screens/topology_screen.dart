/// Экран «Топология» (topology-offline-3 + topology-browse).
///
/// Каскад комната → стеллаж → секция → ярус: выбор существующих мест
/// хранения и кнопка «+» для создания на каждом уровне. Ниже — список
/// ячеек выбранного яруса; по тапу на ячейку — тара в ней.
/// Создание работает офлайн (negative ID + sync_queue); parent-ссылки
/// перемапливаются при синхронизации (topology-offline-1).
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/catalog.dart';
import '../models/container.dart' as model;
import '../services/catalog_service.dart';
import '../services/container_service.dart';
import '../widgets/catalog_create_dialog.dart';

class TopologyScreen extends StatefulWidget {
  const TopologyScreen({super.key});

  @override
  State<TopologyScreen> createState() => _TopologyScreenState();
}

class _TopologyScreenState extends State<TopologyScreen> {
  List<NamedCatalog> _rooms = const [];
  List<NamedCatalog> _racks = const [];
  List<NamedCatalog> _sections = const [];
  List<NamedCatalog> _tiers = const [];
  List<NamedCatalog> _cells = const [];
  List<model.Container> _cellContainers = const [];

  int? _roomId;
  int? _rackId;
  int? _sectionId;
  int? _tierId;
  int? _cellId;

  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRooms();
  }

  CatalogService get _catalog => context.read<CatalogService>();
  ContainerService get _containers => context.read<ContainerService>();

  Future<void> _run(Future<void> Function() body) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await body();
    } catch (e) {
      if (mounted) setState(() => _error = 'Не удалось загрузить: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadRooms() async {
    await _run(() async {
      _rooms = await _catalog.fetchRooms();
    });
  }

  Future<void> _loadRacks() async {
    final roomId = _roomId;
    if (roomId == null) {
      setState(() {
        _racks = const [];
        _rackId = null;
        _sections = const [];
        _sectionId = null;
        _tiers = const [];
        _tierId = null;
        _cells = const [];
        _cellId = null;
        _cellContainers = const [];
      });
      return;
    }
    await _run(() async {
      _racks = await _catalog.fetchRacks(roomId);
      _rackId = null;
      _sections = const [];
      _sectionId = null;
      _tiers = const [];
      _tierId = null;
      _cells = const [];
      _cellId = null;
      _cellContainers = const [];
    });
  }

  Future<void> _loadSections() async {
    final rackId = _rackId;
    if (rackId == null) {
      setState(() {
        _sections = const [];
        _sectionId = null;
        _tiers = const [];
        _tierId = null;
        _cells = const [];
        _cellId = null;
        _cellContainers = const [];
      });
      return;
    }
    await _run(() async {
      _sections = await _catalog.fetchSections(rackId);
      _sectionId = null;
      _tiers = const [];
      _tierId = null;
      _cells = const [];
      _cellId = null;
      _cellContainers = const [];
    });
  }

  Future<void> _loadTiers() async {
    final sectionId = _sectionId;
    if (sectionId == null) {
      setState(() {
        _tiers = const [];
        _tierId = null;
        _cells = const [];
        _cellId = null;
        _cellContainers = const [];
      });
      return;
    }
    await _run(() async {
      _tiers = await _catalog.fetchTiers(sectionId);
      _tierId = null;
      _cells = const [];
      _cellId = null;
      _cellContainers = const [];
    });
  }

  Future<void> _loadCells() async {
    final tierId = _tierId;
    if (tierId == null) {
      setState(() {
        _cells = const [];
        _cellId = null;
        _cellContainers = const [];
      });
      return;
    }
    await _run(() async {
      _cells = await _catalog.fetchCells(tierId);
      _cellId = null;
      _cellContainers = const [];
    });
  }

  Future<void> _loadCellContainers() async {
    final cellId = _cellId;
    if (cellId == null) {
      setState(() => _cellContainers = const []);
      return;
    }
    await _run(() async {
      final page = await _containers.fetchList(cellId: cellId, pageSize: 200);
      _cellContainers = page.items;
    });
  }

  Future<void> _create(String kind, List<NamedCatalog> parents) async {
    final created = await showDialog<Object>(
      context: context,
      builder: (_) => CatalogCreateDialog(kind: kind, parents: parents),
    );
    if (!mounted || created == null) return;
    switch (kind) {
      case 'room':
        await _loadRooms();
      case 'rack':
        await _loadRacks();
      case 'section':
        await _loadSections();
      case 'tier':
        await _loadTiers();
      case 'cell':
        await _loadCells();
      default:
        break;
    }
  }

  Widget _levelRow({
    required String label,
    required List<NamedCatalog> items,
    required int? value,
    required ValueChanged<int?> onChanged,
    required VoidCallback onAdd,
    required bool addEnabled,
  }) {
    return Row(
      children: [
        Expanded(
          child: DropdownButtonFormField<int?>(
            initialValue: value,
            isExpanded: true,
            decoration: InputDecoration(
              labelText: label,
              border: const OutlineInputBorder(),
              isDense: true,
            ),
            items: items
                .map(
                  (p) => DropdownMenuItem<int?>(
                    value: p.id,
                    child: Text(
                      p.label,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                )
                .toList(),
            onChanged: onChanged,
          ),
        ),
        const SizedBox(width: 8),
        IconButton(
          tooltip: 'Создать',
          icon: const Icon(Icons.add_circle_outline),
          onPressed: addEnabled ? onAdd : null,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      appBar: AppBar(title: const Text('Топология')),
      body: ListView(
        padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + bottomInset),
        children: [
          Text('Места хранения', style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            'Выберите уровень, чтобы посмотреть содержимое, или «+», чтобы '
            'создать новый. Создание работает без сети.',
            style: theme.textTheme.bodySmall,
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
          ],
          const SizedBox(height: 16),
          if (_loading) const LinearProgressIndicator(),
          const SizedBox(height: 16),
          _levelRow(
            label: 'Комната',
            items: _rooms,
            value: _roomId,
            onChanged: (v) {
              setState(() => _roomId = v);
              _loadRacks();
            },
            onAdd: () => _create('room', const []),
            addEnabled: true,
          ),
          const SizedBox(height: 12),
          _levelRow(
            label: 'Стеллаж',
            items: _racks,
            value: _rackId,
            onChanged: (v) {
              setState(() => _rackId = v);
              _loadSections();
            },
            onAdd: () => _create('rack', _rooms),
            addEnabled: _rooms.isNotEmpty,
          ),
          const SizedBox(height: 12),
          _levelRow(
            label: 'Секция',
            items: _sections,
            value: _sectionId,
            onChanged: (v) {
              setState(() => _sectionId = v);
              _loadTiers();
            },
            onAdd: () => _create('section', _racks),
            addEnabled: _racks.isNotEmpty,
          ),
          const SizedBox(height: 12),
          _levelRow(
            label: 'Ярус',
            items: _tiers,
            value: _tierId,
            onChanged: (v) {
              setState(() => _tierId = v);
              _loadCells();
            },
            onAdd: () => _create('tier', _sections),
            addEnabled: _sections.isNotEmpty,
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _tierId == null ? null : () => _create('cell', _tiers),
            icon: const Icon(Icons.add),
            label: const Padding(
              padding: EdgeInsets.symmetric(vertical: 10),
              child: Text('Создать ячейку'),
            ),
          ),
          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 12),
          Text('Ячейки яруса', style: theme.textTheme.titleMedium),
          if (_tierId == null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Выберите ярус, чтобы увидеть его ячейки.',
                style: theme.textTheme.bodySmall,
              ),
            )
          else if (_cells.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'В этом ярусе пока нет ячеек. Создайте первую кнопкой выше.',
                style: theme.textTheme.bodySmall,
              ),
            )
          else
            ..._cells.map(
              (cell) => Card(
                child: ListTile(
                  leading: const Icon(Icons.grid_view_outlined),
                  title: Text(cell.label),
                  subtitle: _cellId == cell.id
                      ? Text('Тары в ячейке: ${_cellContainers.length}')
                      : null,
                  selected: _cellId == cell.id,
                  onTap: () {
                    setState(() => _cellId = cell.id);
                    _loadCellContainers();
                  },
                ),
              ),
            ),
          if (_cellId != null) ...[
            const SizedBox(height: 12),
            Text('Тара в ячейке', style: theme.textTheme.titleMedium),
            if (_cellContainers.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('Ячейка пуста.', style: theme.textTheme.bodySmall),
              )
            else
              ..._cellContainers.map(
                (c) => Card(
                  child: ListTile(
                    leading: const Icon(Icons.inventory_2_outlined),
                    title: Text('Тара #${c.id}'),
                    subtitle: Text(c.status.name),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
