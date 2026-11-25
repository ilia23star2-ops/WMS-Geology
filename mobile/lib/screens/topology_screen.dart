/// Экран «Топология» (topology-tree): выбор дерева, как в вебе.
///
/// Раскрывающееся дерево комната → стеллаж → секция → ярус (ленивая
/// загрузка детей). Под выбранным ярусом — список ячеек; по тапу на
/// ячейку — тара в ней. «+» на узле создаёт ребёнка (офлайн через
/// sync_queue, parent-ссылки перемапливаются при синхронизации).
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
  final Map<int, List<NamedCatalog>> _racks = {};
  final Map<int, List<NamedCatalog>> _sections = {};
  final Map<int, List<NamedCatalog>> _tiers = {};
  List<NamedCatalog> _cells = const [];
  List<model.Container> _cellContainers = const [];

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

  Future<void> _loadRacks(int roomId) async {
    await _run(() async {
      _racks[roomId] = await _catalog.fetchRacks(roomId);
    });
  }

  Future<void> _loadSections(int rackId) async {
    await _run(() async {
      _sections[rackId] = await _catalog.fetchSections(rackId);
    });
  }

  Future<void> _loadTiers(int sectionId) async {
    await _run(() async {
      _tiers[sectionId] = await _catalog.fetchTiers(sectionId);
    });
  }

  Future<void> _loadCells(int tierId) async {
    await _run(() async {
      _cells = await _catalog.fetchCells(tierId);
      _cellId = null;
      _cellContainers = const [];
    });
  }

  Future<void> _loadCellContainers(int cellId) async {
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
        if (parents.isNotEmpty) await _loadRacks(parents.first.id);
      case 'section':
        if (parents.isNotEmpty) await _loadSections(parents.first.id);
      case 'tier':
        if (parents.isNotEmpty) await _loadTiers(parents.first.id);
      case 'cell':
        if (_tierId != null) await _loadCells(_tierId!);
      default:
        break;
    }
  }

  Widget _addBtn(VoidCallback onTap) {
    return IconButton(
      tooltip: 'Создать',
      icon: const Icon(Icons.add_circle_outline),
      onPressed: onTap,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      appBar: AppBar(title: const Text('Топология')),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomInset),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Места хранения',
                  style: theme.textTheme.titleMedium,
                ),
              ),
              TextButton.icon(
                onPressed: () => _create('room', const []),
                icon: const Icon(Icons.add),
                label: const Text('Комната'),
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
          ],
          if (_loading) const LinearProgressIndicator(),
          const SizedBox(height: 8),
          ..._rooms.map(
            (room) => ExpansionTile(
              title: Text(['Комната', room.label].join(' · ')),
              trailing: _addBtn(() => _create('rack', [room])),
              onExpansionChanged: (open) {
                if (open && !_racks.containsKey(room.id)) {
                  _loadRacks(room.id);
                }
              },
              children: (_racks[room.id] ?? const [])
                  .map(
                    (rack) => ExpansionTile(
                      title: Text(['Стеллаж', rack.label].join(' · ')),
                      trailing: _addBtn(() => _create('section', [rack])),
                      onExpansionChanged: (open) {
                        if (open && !_sections.containsKey(rack.id)) {
                          _loadSections(rack.id);
                        }
                      },
                      children: (_sections[rack.id] ?? const [])
                          .map(
                            (section) => ExpansionTile(
                              title: Text(['Секция', section.label].join(' · ')),
                              trailing: _addBtn(
                                () => _create('tier', [section]),
                              ),
                              onExpansionChanged: (open) {
                                if (open && !_tiers.containsKey(section.id)) {
                                  _loadTiers(section.id);
                                }
                              },
                              children: (_tiers[section.id] ?? const [])
                                  .map(
                                    (tier) => ListTile(
                                      title: Text(['Ярус', tier.label].join(' · ')),
                                      selected: _tierId == tier.id,
                                      trailing: _addBtn(
                                        () => _create('cell', [tier]),
                                      ),
                                      onTap: () {
                                        setState(() => _tierId = tier.id);
                                        _loadCells(tier.id);
                                      },
                                    ),
                                  )
                                  .toList(),
                            ),
                          )
                          .toList(),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          const Divider(),
          const SizedBox(height: 8),
          Text('Ячейки яруса', style: theme.textTheme.titleMedium),
          if (_tierId == null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Раскройте дерево и выберите ярус, чтобы увидеть ячейки.',
                style: theme.textTheme.bodySmall,
              ),
            )
          else if (_cells.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'В этом ярусе пока нет ячеек. Создайте кнопкой «+» у яруса.',
                style: theme.textTheme.bodySmall,
              ),
            )
          else
            ..._cells.map(
              (cell) => Card(
                child: ListTile(
                  leading: const Icon(Icons.grid_view_outlined),
                  title: Text(['Ячейка', cell.label].join(' · ')),
                  subtitle: _cellId == cell.id
                      ? Text('Тары в ячейке: ${_cellContainers.length}')
                      : null,
                  selected: _cellId == cell.id,
                  onTap: () {
                    setState(() => _cellId = cell.id);
                    _loadCellContainers(cell.id);
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
