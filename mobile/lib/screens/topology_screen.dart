/// Экран «Топология» (topology-ux-mobile).
///
/// Дерево комната→стеллаж→секция→ярус предзагружается при входе
/// (спиннер), раскрытие мгновенное. Ячейки выбранного яруса — плиткой
/// (код + статус-точка + поддон); тап по плитке открывает шторку с
/// деталями ячейки и тарой (цветные чипы статусов). «+» на узле дерева
/// создаёт ребёнка (офлайн через sync_queue).
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

  /// Тап по плитке: грузим тару и открываем шторку детали ячейки.
  Future<void> _openCell(CellInfo cell) async {
    setState(() => _cellId = cell.id);
    await _loadCellContainers(cell.id);
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        builder: (ctx2, scroll) {
          final t = Theme.of(ctx2);
          return ListView(
            controller: scroll,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                ['Ячейка', cell.label].join(' · '),
                style: t.textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              _cellMeta(cell, t),
              const SizedBox(height: 16),
              Text('Тара в ячейке', style: t.textTheme.titleMedium),
              const SizedBox(height: 8),
              if (_cellContainers.isEmpty)
                Text('Ячейка пуста.', style: t.textTheme.bodySmall)
              else
                ..._cellContainers.map(_containerRow),
            ],
          );
        },
      ),
    );
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

  /// Цвет точки заполненности плитки (палитра как в вебе).
  Color _occupancyColor(CellInfo cell) {
    if (cell.isActive == false) return Colors.grey;
    if (cell.containersCount <= 0) return const Color(0xFFBDBDBD);
    return const Color(0xFF2EB84C);
  }

  /// Плитка ячейки: точка заполненности + код + счётчик + поддон.
  Widget _cellTile(CellInfo cell, ThemeData theme) {
    final active = cell.isActive != false;
    final selected = _cellId == cell.id;
    return SizedBox(
      width: 116,
      child: Card(
        clipBehavior: Clip.antiAlias,
        shape: selected
            ? RoundedRectangleBorder(
                side: BorderSide(color: theme.colorScheme.primary, width: 2),
                borderRadius: BorderRadius.circular(12),
              )
            : null,
        child: InkWell(
          onTap: () => _openCell(cell),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: _occupancyColor(cell),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        cell.label,
                        style: theme.textTheme.titleMedium,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  active
                      ? [cell.containersCount.toString(), ' тар'].join('')
                      : 'Отключена',
                  style: theme.textTheme.bodySmall,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  cell.palletId == null
                      ? 'без поддона'
                      : ['подд #', cell.palletId.toString()].join(''),
                  style: theme.textTheme.bodySmall,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Метаданные ячейки: адрес + чипы тип/активность/поддон.
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
              _chip(
                cell.cellTypeLabel,
                Colors.blueGrey.shade50,
                Colors.blueGrey.shade700,
              ),
            _chip(
              cell.activeLabel,
              active ? Colors.green.shade50 : Colors.red.shade50,
              active ? Colors.green.shade700 : Colors.red.shade700,
            ),
            _chip(
              cell.palletChipLabel ?? 'без поддона',
              cell.palletId == null
                  ? Colors.grey.shade100
                  : (palletActive
                        ? Colors.green.shade50
                        : Colors.amber.shade50),
              cell.palletId == null
                  ? Colors.grey.shade600
                  : (palletActive
                        ? Colors.green.shade700
                        : Colors.amber.shade800),
            ),
          ],
        ),
      ],
    );
  }

  /// Строка тары с цветным чипом статуса.
  Widget _containerRow(model.Container c) {
    final n = c.status.name;
    final bg = n == 'active' || n == 'placed'
        ? Colors.green.shade50
        : n == 'pendingPlacement'
        ? Colors.amber.shade50
        : n == 'issued'
        ? Colors.blue.shade50
        : Colors.grey.shade100;
    final fg = n == 'active' || n == 'placed'
        ? Colors.green.shade700
        : n == 'pendingPlacement'
        ? Colors.amber.shade800
        : n == 'issued'
        ? Colors.blue.shade700
        : Colors.grey.shade700;
    return Card(
      child: ListTile(
        leading: const Icon(Icons.inventory_2_outlined),
        title: Text(c.displayName),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Align(
            alignment: Alignment.centerLeft,
            child: _chip(c.statusLabel, bg, fg),
          ),
        ),
      ),
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
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _cells.map((c) => _cellTile(c, theme)).toList(),
                    ),
                  ),
              ],
            ),
    );
  }
}
