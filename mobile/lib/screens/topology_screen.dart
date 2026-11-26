/// Экран «Топология» (topology-ux-mobile + cell-card-ui-mobile
/// + topology-cell-select-mobile).
///
/// Дерево комната→стеллаж→секция→ярус предзагружается при входе
/// (спиннер), раскрытие мгновенное. Ячейки выбранного яруса — плиткой
/// в паритете с веб-карточкой. Долгое нажатие на плитку — режим
/// выделения (галочки, шапка «Выбрано: N» + «Печать QR»/«Снять»);
/// «Печать QR» скачивает пакетный PDF (qr-batch) и открывает вьювер.
/// Тап по плитке вне режима — шторка с деталями ячейки и тарой.
/// «+» на узле дерева создаёт ребёнка (офлайн через sync_queue).
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/catalog.dart';
import '../models/container.dart' as model;
import '../services/catalog_service.dart';
import '../services/container_service.dart';
import '../widgets/catalog_create_dialog.dart';
import '../widgets/cell_widgets.dart';
import '../services/qr_parser.dart';
import '../widgets/qr_payload_scanner.dart';

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

  bool _selecting = false;
  final Set<int> _selected = {};

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
      _selecting = false;
      _selected.clear();
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

  /// Копирование адреса ячейки в буфер + SnackBar.
  Future<void> _copyAddress(String address) async {
    await Clipboard.setData(ClipboardData(text: address));
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Скопировано')));
  }

  /// Сканировать QR и перейти: ячейка → её ярус + шторка.
  Future<void> _scanAndGo() async {
    final raw = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const QrPayloadScannerPage()),
    );
    if (raw == null || !mounted) return;
    final parsed = parseQrPayload(raw);
    if (!parsed.isValid) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(parsed.error ?? 'Неверный QR.')),
      );
      return;
    }
    if (parsed.type == QrEntityType.cell) {
      final cell = await _catalog.fetchCell(parsed.id!);
      if (!mounted) return;
      setState(() => _tierId = cell.tier);
      await _loadCells(cell.tier);
      await _openCell(cell);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Пока поддерживается только QR ячейки.')),
      );
    }
  }

  /// Долгое нажатие: вход в режим выделения и выбор ячейки.
  void _startSelecting(CellInfo cell) {
    setState(() {
      _selecting = true;
      _selected.add(cell.id);
    });
  }

  /// Тап в режиме выделения: переключить выбор ячейки.
  void _toggleSelected(CellInfo cell) {
    setState(() {
      if (_selected.contains(cell.id)) {
        _selected.remove(cell.id);
      } else {
        _selected.add(cell.id);
      }
    });
  }

  void _stopSelecting() {
    setState(() {
      _selecting = false;
      _selected.clear();
    });
  }

  /// Пакетный QR выделенных ячеек: PDF через qr-batch + вьювер.
  Future<void> _printSelectedQr() async {
    if (_selected.isEmpty) return;
    final ok = await _catalog.openCellsBatchQrPdf(_selected.toList());
    if (!ok && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Не удалось открыть PDF.')));
    }
  }

  /// Тап по плитке вне режима выделения: шторка детали ячейки.
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
              cellMeta(cell, t),
              const SizedBox(height: 16),
              Text('Тара в ячейке', style: t.textTheme.titleMedium),
              const SizedBox(height: 8),
              if (_cellContainers.isEmpty)
                Text('Ячейка пуста.', style: t.textTheme.bodySmall)
              else
                ..._cellContainers.map(containerRow),
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

  /// Подпись состояния ячейки (как в вебе).
  String _stateLabel(CellInfo cell) {
    if (cell.isActive == false) return 'Отключена';
    if (cell.containersCount > 0) {
      final limit = cell.capacityLimit;
      final suffix = (limit != null && limit > 0)
          ? ['/', limit.toString()].join('')
          : '';
      return ['Занята ', cell.containersCount.toString(), suffix].join('');
    }
    return 'Свободна';
  }

  Color _stateBg(CellInfo cell) {
    if (cell.isActive == false) return Colors.red.shade50;
    if (cell.containersCount > 0) return Colors.green.shade700;
    return Colors.grey.shade100;
  }

  Color _stateFg(CellInfo cell) {
    if (cell.isActive == false) return Colors.red.shade700;
    if (cell.containersCount > 0) return Colors.white;
    return Colors.grey.shade700;
  }

  /// «Секция X · Ярус Y» из полного адреса.
  String _sectionTierLabel(CellInfo cell) {
    final parts = (cell.fullAddress ?? '').split(' / ');
    final sec = parts.length > 2 ? parts[2] : '—';
    final tier = parts.length > 3 ? parts[3] : '—';
    return ['Секция ', sec, ' · Ярус ', tier].join('');
  }

  /// Ячейки яруса в числовом порядке (слева→направо).
  List<CellInfo> _orderedCells() {
    final list = List<CellInfo>.from(_cells);
    list.sort((a, b) => _intCode(a.label).compareTo(_intCode(b.label)));
    return list;
  }

  int _intCode(String s) => int.tryParse(s) ?? 0;

  /// Цвет заливки мини-схемы (палитра как в вебе).
  Color _occupancyColor(CellInfo cell) {
    if (cell.isActive == false) return Colors.grey;
    if (cell.containersCount <= 0) return const Color(0xFFBDBDBD);
    final limit = cell.capacityLimit;
    if (limit != null && limit > 0) {
      if (cell.containersCount >= limit) return const Color(0xFFE8112D);
      if (cell.containersCount >= limit * 0.7) return const Color(0xFFF2E500);
    }
    return const Color(0xFF2EB84C);
  }

  /// Плитка ячейки в паритете с веб-карточкой + выделение.
  Widget _cellTile(CellInfo cell, ThemeData theme) {
    final selected = _cellId == cell.id;
    final checked = _selected.contains(cell.id);
    return SizedBox(
      width: 170,
      child: Card(
        clipBehavior: Clip.antiAlias,
        shape: selected || (_selecting && checked)
            ? RoundedRectangleBorder(
                side: BorderSide(color: theme.colorScheme.primary, width: 2),
                borderRadius: BorderRadius.circular(12),
              )
            : null,
        child: InkWell(
          onTap: () {
            if (_selecting) {
              _toggleSelected(cell);
            } else {
              _openCell(cell);
            }
          },
          onLongPress: () => _startSelecting(cell),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (_selecting) ...[
                      Icon(
                        checked
                            ? Icons.check_circle
                            : Icons.radio_button_unchecked,
                        size: 18,
                        color: checked
                            ? theme.colorScheme.primary
                            : Colors.grey,
                      ),
                      const SizedBox(width: 6),
                    ],
                    Expanded(
                      child: Text(
                        cell.label,
                        style: theme.textTheme.titleMedium,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    chip(_stateLabel(cell), _stateBg(cell), _stateFg(cell)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(_sectionTierLabel(cell), style: theme.textTheme.bodySmall),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: _orderedCells()
                      .map(
                        (c) => Container(
                          width: 18,
                          height: 18,
                          decoration: BoxDecoration(
                            color: _occupancyColor(c),
                            borderRadius: BorderRadius.circular(4),
                            border: c.id == cell.id
                                ? Border.all(
                                    color: theme.colorScheme.primary,
                                    width: 2,
                                  )
                                : null,
                          ),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 4),
                Text(
                  'Позиции яруса: слева→направо',
                  style: theme.textTheme.labelSmall,
                ),
                const SizedBox(height: 6),
                if (cell.fullAddress != null)
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          cell.fullAddress!,
                          style: theme.textTheme.bodySmall,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Скопировать адрес',
                        visualDensity: VisualDensity.compact,
                        iconSize: 16,
                        icon: const Icon(Icons.content_copy),
                        onPressed: () => _copyAddress(cell.fullAddress!),
                      ),
                    ],
                  ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    chip(
                      cell.cellTypeLabel,
                      Colors.blueGrey.shade50,
                      Colors.blueGrey.shade700,
                    ),
                    if (cell.palletId != null)
                      chip(
                        [
                          '#',
                          cell.palletId.toString(),
                          ' · ',
                          cell.containersCount.toString(),
                          ' тар',
                        ].join(''),
                        Colors.green.shade50,
                        Colors.green.shade700,
                      )
                    else
                      chip(
                        'без поддона',
                        Colors.grey.shade100,
                        Colors.grey.shade600,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Топология'),
        actions: [
          IconButton(
            tooltip: 'Скан QR',
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => _scanAndGo(),
          ),
        ],
      ),
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
                if (_selecting)
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          ['Выбрано: ', _selected.length.toString()].join(''),
                          style: theme.textTheme.titleMedium,
                        ),
                      ),
                      TextButton(
                        onPressed: () => _printSelectedQr(),
                        child: const Text('Печать QR'),
                      ),
                      TextButton(
                        onPressed: _stopSelecting,
                        child: const Text('Снять'),
                      ),
                    ],
                  )
                else
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
