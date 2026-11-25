/// Экран «Топология» (topology-tree-ux + topology-parity-1).
///
/// Всё дерево (комната→стеллаж→секция→ярус) предзагружается при входе
/// со спиннером, поэтому раскрытие узлов мгновенное (без сети по клику).
/// Шеврон раскрытия сохранён; «+» в строке узла создаёт ребёнка (офлайн
/// через sync_queue). Под выбранным ярусом — ячейки с метаданными
/// (адрес, тип, активность, поддон-чип) как в вебе; по тапу — тара.
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
  List<CellInfo> _cells = const [];
  List<model.Container> _cellContainers = const [];

  int? _tierId;
  int? _cellId;
  bool _initialLoading = true;
  bool _cellsLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTree();
  }

  CatalogService get _catalog => context.read<CatalogService>();
  ContainerService get _containers => context.read<ContainerService>();

  /// Предзагрузка всего дерева: раскрытие потом мгновенное.
  Future<void> _loadTree() async {
    setState(() {
      _initialLoading = true;
      _error = null;
    });
    try {
      final rooms = await _catalog.fetchRooms();
      final racks = <int, List<NamedCatalog>>{};
      final sections = <int, List<NamedCatalog>>{};
      final tiers = <int, List<NamedCatalog>>{};
      await Future.wait(
        rooms.map((room) async {
          final rr = await _catalog.fetchRacks(room.id);
          racks[room.id] = rr;
          await Future.wait(
            rr.map((rack) async {
              final ss = await _catalog.fetchSections(rack.id);
              sections[rack.id] = ss;
              await Future.wait(
                ss.map((section) async {
                  tiers[section.id] = await _catalog.fetchTiers(section.id);
                }),
              );
            }),
          );
        }),
      );
      if (!mounted) return;
      setState(() {
        _rooms = rooms;
        _racks
          ..clear()
          ..addAll(racks);
        _sections
          ..clear()
          ..addAll(sections);
        _tiers
          ..clear()
          ..addAll(tiers);
        _initialLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Не удалось загрузить: $e';
          _initialLoading = false;
        });
      }
    }
  }

  Future<void> _loadCells(int tierId) async {
    setState(() {
      _cellsLoading = true;
      _cellId = null;
      _cellContainers = const [];
    });
    try {
      final cells = await _catalog.fetchCellsDetailed(tierId);
      if (mounted) setState(() => _cells = cells);
    } catch (e) {
      if (mounted) setState(() => _error = 'Не удалось загрузить: $e');
    } finally {
      if (mounted) setState(() => _cellsLoading = false);
    }
  }

  Future<void> _loadCellContainers(int cellId) async {
    try {
      final palletId = await _containers.fetchPalletIdByCell(cellId);
      if (palletId == null) {
        if (mounted) setState(() => _cellContainers = const []);
        return;
      }
      final page = await _containers.fetchList(
        palletId: palletId,
        pageSize: 200,
      );
      if (mounted) setState(() => _cellContainers = page.items);
    } catch (e) {
      if (mounted) setState(() => _error = 'Не удалось загрузить: $e');
    }
  }

  Future<void> _create(String kind, List<NamedCatalog> parents) async {
    final created = await showDialog<Object>(
      context: context,
      builder: (_) => CatalogCreateDialog(kind: kind, parents: parents),
    );
    if (!mounted || created == null) return;
    await _loadTree();
    if (_tierId != null) await _loadCells(_tierId!);
  }

  /// Заголовок узла: текст + «+» (шеврон раскрытия остаётся стандартным).
  Widget _nodeTitle(String label, VoidCallback onAdd) {
    return Row(
      children: [
        Expanded(child: Text(label, overflow: TextOverflow.ellipsis)),
        IconButton(
          tooltip: 'Создать',
          visualDensity: VisualDensity.compact,
          icon: const Icon(Icons.add_circle_outline),
          onPressed: onAdd,
        ),
      ],
    );
  }

  /// Метаданные ячейки: адрес + чипы тип/активность/поддон (как в вебе).
  Widget _cellMeta(CellInfo cell, ThemeData theme) {
    final active = cell.isActive != false;
    final palletActive = cell.palletStatus == 'ACTIVE';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (cell.fullAddress != null)
          Text(cell.fullAddress!, style: theme.textTheme.bodySmall),
        const SizedBox(height: 4),
        Wrap(
          spacing: 6,
          runSpacing: 4,
          children: [
            if (cell.cellType != null)
              _chip(cell.cellTypeLabel, Colors.blueGrey.shade50, Colors.blueGrey.shade700),
            _chip(
              cell.activeLabel,
              active ? Colors.green.shade50 : Colors.red.shade50,
              active ? Colors.green.shade700 : Colors.red.shade700,
            ),
            _chip(
              cell.palletChipLabel ?? 'без поддона',
              cell.palletId == null
                  ? Colors.grey.shade100
                  : (palletActive ? Colors.green.shade50 : Colors.amber.shade50),
              cell.palletId == null
                  ? Colors.grey.shade600
                  : (palletActive ? Colors.green.shade700 : Colors.amber.shade800),
            ),
          ],
        ),
      ],
    );
  }

  Widget _chip(String label, Color bg, Color fg) {
    return Chip(
      label: Text(label, style: TextStyle(color: fg, fontSize: 12)),
      backgroundColor: bg,
      side: BorderSide.none,
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 0),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      appBar: AppBar(title: const Text('Топология')),
      body: _initialLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
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
                  Text(
                    _error!,
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
                ],
                const SizedBox(height: 8),
                ..._rooms.map(
                  (room) => ExpansionTile(
                    title: _nodeTitle(
                      ['Комната', room.label].join(' · '),
                      () => _create('rack', [room]),
                    ),
                    children: (_racks[room.id] ?? const [])
                        .map(
                          (rack) => ExpansionTile(
                            title: _nodeTitle(
                              ['Стеллаж', rack.label].join(' · '),
                              () => _create('section', [rack]),
                            ),
                            children: (_sections[rack.id] ?? const [])
                                .map(
                                  (section) => ExpansionTile(
                                    title: _nodeTitle(
                                      ['Секция', section.label].join(' · '),
                                      () => _create('tier', [section]),
                                    ),
                                    children: (_tiers[section.id] ?? const [])
                                        .map(
                                          (tier) => ListTile(
                                            title: Text(
                                              ['Ярус', tier.label].join(' · '),
                                            ),
                                            selected: _tierId == tier.id,
                                            trailing: IconButton(
                                              tooltip: 'Создать ячейку',
                                              icon: const Icon(
                                                Icons.add_circle_outline,
                                              ),
                                              onPressed: () =>
                                                  _create('cell', [tier]),
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
                else if (_cellsLoading)
                  const Padding(
                    padding: EdgeInsets.only(top: 12),
                    child: LinearProgressIndicator(),
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
                        subtitle: _cellMeta(cell, theme),
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
                      child: Text(
                        'Ячейка пуста.',
                        style: theme.textTheme.bodySmall,
                      ),
                    )
                  else
                    ..._cellContainers.map(
                      (c) => Card(
                        child: ListTile(
                          leading: const Icon(Icons.inventory_2_outlined),
                          title: Text(c.displayName),
                          subtitle: Text(c.statusLabel),
                        ),
                      ),
                    ),
                ],
              ],
            ),
    );
  }
}
