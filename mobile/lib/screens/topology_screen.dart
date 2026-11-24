/// Экран «Топология» (topology-offline-3).
///
/// Каскад комната → стеллаж → секция → ярус: выбор существующих мест
/// хранения и кнопка «+» для создания на каждом уровне. Создание
/// работает офлайн: диалог пишет в `sync_queue` (negative ID), parent-ссылки
/// перемапливаются при синхронизации (пачка topology-offline-1).
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/catalog.dart';
import '../services/catalog_service.dart';
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

  int? _roomId;
  int? _rackId;
  int? _sectionId;
  int? _tierId;

  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRooms();
  }

  CatalogService get _catalog => context.read<CatalogService>();

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
      });
      return;
    }
    await _run(() async {
      _sections = await _catalog.fetchSections(rackId);
      _sectionId = null;
      _tiers = const [];
      _tierId = null;
    });
  }

  Future<void> _loadTiers() async {
    final sectionId = _sectionId;
    if (sectionId == null) {
      setState(() {
        _tiers = const [];
        _tierId = null;
      });
      return;
    }
    await _run(() async {
      _tiers = await _catalog.fetchTiers(sectionId);
      _tierId = null;
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
      default:
        break; // ячейка: список ячеек на экране не показывается
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
            onChanged: (v) => setState(() => _tierId = v),
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
          if (_tierId == null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Чтобы создать ячейку, сначала выберите ярус.',
                style: theme.textTheme.bodySmall,
              ),
            ),
        ],
      ),
    );
  }
}
