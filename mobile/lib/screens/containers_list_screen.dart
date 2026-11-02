/// Реестр тары (c-9-container-list + c-9-container-list-order + c-9-overflow-fix).
///
/// Аналог `ContainersPage.tsx` в вебе (упрощённый для мобилки):
/// - 4 фильтра: статус, тип тары, Н/З draft, ТИ draft (адаптивно:
///   в узком экране — столбиком, в широком — в ряд);
/// - server-side пагинация по 50;
/// - карточки: Н/З · ТИ (крупно) + иконки статуса и печати справа,
///   затем Тип · номер (mono или chip «Заготовка»), локация, комментарий;
/// - действия (кнопки): `Wrap`, чтобы «Местоположение» + «Разместить»
///   переносились на новую строку в узком портрете;
/// - тап по карточке → `ContainerDetailScreen`;
/// - FAB «+ Создать тару» — пока заглушка «скоро».
///
/// c-9-overflow-fix: убраны RenderFlex overflow (46 px / 212 px) —
/// `isExpanded: true` у `DropdownButtonFormField`, `overflow: ellipsis`
/// у текстов, `Wrap` для кнопок, адаптивные фильтры.
///
/// ВАЖНО: `hide Container` — иначе конфликт имён с Flutter-виджетом.
library;

import 'package:flutter/material.dart' hide Container;
import 'package:provider/provider.dart';

import '../models/catalog.dart';
import '../models/container.dart';
import '../services/catalog_service.dart';
import '../services/container_service.dart';
import '../widgets/container_location_dialog.dart';
import '../widgets/place_container_dialog.dart';
import 'container_detail_screen.dart';

class ContainersListScreen extends StatefulWidget {
  const ContainersListScreen({super.key});

  @override
  State<ContainersListScreen> createState() => _ContainersListScreenState();
}

class _ContainersListScreenState extends State<ContainersListScreen> {
  static const int _pageSize = 50;

  final _woCtrl = TextEditingController();

  int _page = 1;
  ContainerStatus? _status;
  int? _containerTypeId;
  int? _draftResearchTypeId;

  ContainersPage? _pageData;
  bool _loading = true;
  String? _error;

  List<ContainerType> _containerTypes = const [];
  List<ResearchType> _researchTypes = const [];

  @override
  void initState() {
    super.initState();
    _loadLookups();
    _loadPage();
  }

  @override
  void dispose() {
    _woCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadLookups() async {
    final catalog = context.read<CatalogService>();
    try {
      final results = await Future.wait([
        catalog.fetchContainerTypes(),
        catalog.fetchResearchTypes(),
      ]);
      if (!mounted) return;
      setState(() {
        _containerTypes = results[0] as List<ContainerType>;
        _researchTypes = results[1] as List<ResearchType>;
      });
    } catch (_) {
      // Справочники не критичны для реестра.
    }
  }

  Future<void> _loadPage() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final service = context.read<ContainerService>();
    try {
      final data = await service.fetchList(
        page: _page,
        pageSize: _pageSize,
        status: _status,
        containerTypeId: _containerTypeId,
        draftWorkOrderCoded: _woCtrl.text.trim().isEmpty
            ? null
            : _woCtrl.text.trim(),
        draftResearchTypeId: _draftResearchTypeId,
      );
      if (!mounted) return;
      setState(() {
        _pageData = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось загрузить тару: $e';
        _loading = false;
      });
    }
  }

  void _resetFilters() {
    _woCtrl.clear();
    setState(() {
      _status = null;
      _containerTypeId = null;
      _draftResearchTypeId = null;
      _page = 1;
    });
    _loadPage();
  }

  void _applyFilters() {
    setState(() => _page = 1);
    _loadPage();
  }

  int get _totalPages {
    final c = _pageData?.count ?? 0;
    if (c == 0) return 1;
    return ((c + _pageSize - 1) ~/ _pageSize);
  }

  Future<void> _openContainer(Container c) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ContainerDetailScreen(container: c)),
    );
    _loadPage();
  }

  Future<void> _openPlace(Container c) async {
    final outcome = await showDialog<PlaceOutcome>(
      context: context,
      builder: (_) => PlaceContainerDialog(
        containerId: c.id,
        currentLocation: c.locationLabel,
      ),
    );
    if (outcome == null || !mounted) return;
    if (outcome == PlaceOutcome.queued) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Размещение сохранено. Отправится при синхронизации.'),
        ),
      );
    } else {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Тара размещена')));
    }
    _loadPage();
  }

  Future<void> _openLocation(Container c) async {
    await showDialog<void>(
      context: context,
      builder: (_) => ContainerLocationDialog(container: c),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Тара'),
        backgroundColor: theme.colorScheme.inversePrimary,
        actions: [
          IconButton(
            tooltip: 'Обновить',
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _loadPage,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Создание тары — скоро'))),
        icon: const Icon(Icons.add),
        label: const Text('Создать тару'),
      ),
      body: Column(
        children: [
          _buildFilters(theme),
          const Divider(height: 1),
          Expanded(child: _buildList(theme)),
          _buildPager(theme),
        ],
      ),
    );
  }

  /// c-9-overflow-fix: адаптив. В узком экране (портрет на телефоне) —
  /// каждый фильтр на своей строке. В широком (планшет / ландшафт) —
  /// 2×2. `DropdownButtonFormField` — `isExpanded: true` + `ellipsis`.
  Widget _buildFilters(ThemeData theme) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 600;
        final statusDD = _statusDropdown();
        final typeDD = _containerTypeDropdown();
        final woField = _woField();
        final rtDD = _researchTypeDropdown();
        final resetBtn = IconButton(
          tooltip: 'Сбросить',
          icon: const Icon(Icons.clear),
          onPressed: _resetFilters,
        );

        if (wide) {
          return Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(child: statusDD),
                    const SizedBox(width: 8),
                    Expanded(child: typeDD),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: woField),
                    const SizedBox(width: 8),
                    Expanded(child: rtDD),
                    resetBtn,
                  ],
                ),
              ],
            ),
          );
        }

        return Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              statusDD,
              const SizedBox(height: 8),
              typeDD,
              const SizedBox(height: 8),
              woField,
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: rtDD),
                  resetBtn,
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _statusDropdown() {
    return DropdownButtonFormField<ContainerStatus?>(
      initialValue: _status,
      isExpanded: true,
      isDense: true,
      decoration: const InputDecoration(
        labelText: 'Статус',
        border: OutlineInputBorder(),
      ),
      items: [
        const DropdownMenuItem(
          value: null,
          child: Text('Все', overflow: TextOverflow.ellipsis),
        ),
        ...ContainerStatus.values
            .where((s) => s != ContainerStatus.unknown)
            .map(
              (s) => DropdownMenuItem(
                value: s,
                child: Text(
                  containerStatusLabels[s] ?? s.name,
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              ),
            ),
      ],
      onChanged: (v) {
        setState(() => _status = v);
        _applyFilters();
      },
    );
  }

  Widget _containerTypeDropdown() {
    return DropdownButtonFormField<int?>(
      initialValue: _containerTypeId,
      isExpanded: true,
      isDense: true,
      decoration: const InputDecoration(
        labelText: 'Тип',
        border: OutlineInputBorder(),
      ),
      items: [
        const DropdownMenuItem(
          value: null,
          child: Text('Все', overflow: TextOverflow.ellipsis),
        ),
        ..._containerTypes.map(
          (t) => DropdownMenuItem(
            value: t.id,
            child: Text(t.label, overflow: TextOverflow.ellipsis, maxLines: 1),
          ),
        ),
      ],
      onChanged: (v) {
        setState(() => _containerTypeId = v);
        _applyFilters();
      },
    );
  }

  Widget _researchTypeDropdown() {
    return DropdownButtonFormField<int?>(
      initialValue: _draftResearchTypeId,
      isExpanded: true,
      isDense: true,
      decoration: const InputDecoration(
        labelText: 'ТИ (draft)',
        border: OutlineInputBorder(),
      ),
      items: [
        const DropdownMenuItem(
          value: null,
          child: Text('Все', overflow: TextOverflow.ellipsis),
        ),
        ..._researchTypes.map(
          (t) => DropdownMenuItem(
            value: t.id,
            child: Text(t.label, overflow: TextOverflow.ellipsis, maxLines: 1),
          ),
        ),
      ],
      onChanged: (v) {
        setState(() => _draftResearchTypeId = v);
        _applyFilters();
      },
    );
  }

  Widget _woField() {
    return TextField(
      controller: _woCtrl,
      decoration: const InputDecoration(
        labelText: 'Н/З (draft)',
        hintText: 'TST0001…',
        border: OutlineInputBorder(),
        isDense: true,
      ),
      onSubmitted: (_) => _applyFilters(),
    );
  }

  Widget _buildList(ThemeData theme) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(
                    _error!,
                    style: TextStyle(color: theme.colorScheme.error),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _loadPage,
                    child: const Text('Повторить'),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }
    final items = _pageData?.items ?? const <Container>[];
    if (items.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('Тар не найдено.'),
            ),
          ),
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.only(top: 4, bottom: 80),
      itemCount: items.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (_, i) => _containerTile(theme, items[i]),
    );
  }

  /// c-9-overflow-fix: все тексты с `overflow: ellipsis`, кнопки в `Wrap`.
  Widget _containerTile(ThemeData theme, Container c) {
    final isPlaced = c.status == ContainerStatus.active;
    final hasCell = c.cellId != null;
    final numberText =
        (c.containerNumber != null && c.containerNumber!.isNotEmpty)
        ? c.containerNumber!
        : null;
    final woText = c.draftWorkOrderCoded.isNotEmpty
        ? c.draftWorkOrderCoded
        : '—';
    final rtText = c.draftResearchTypeName ?? '—';
    final typeText = c.containerTypeName ?? 'Тип #${c.containerType}';

    return InkWell(
      onTap: () => _openContainer(c),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Н/З · ТИ + иконки статуса и печати.
            Row(
              children: [
                Expanded(
                  child: Text(
                    '$woText · $rtText',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                ),
                _statusIcon(c.status),
                const SizedBox(width: 4),
                _printIcon(c.printBatchStatus),
              ],
            ),
            const SizedBox(height: 4),
            // 2. Тип · номер (номер mono или chip «Заготовка»).
            Row(
              children: [
                Flexible(
                  child: Text(
                    '$typeText · ',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                if (numberText != null)
                  Flexible(
                    child: Text(
                      numberText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  )
                else
                  DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border.all(color: theme.colorScheme.tertiary),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 1,
                      ),
                      child: Text(
                        'Заготовка',
                        style: TextStyle(
                          color: theme.colorScheme.tertiary,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            // 3. Локация.
            Text(
              c.locationLabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall,
            ),
            // 4. Комментарий (если есть).
            if (c.commentTemplateText != null &&
                c.commentTemplateText!.isNotEmpty)
              Text(
                c.commentTemplateText!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall,
              ),
            const SizedBox(height: 4),
            // Действия — `Wrap`, чтобы «Местоположение» и «Разместить»
            // переносились на новую строку в узком портрете.
            Wrap(
              spacing: 4,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (hasCell)
                  TextButton.icon(
                    onPressed: () => _openLocation(c),
                    icon: const Icon(Icons.place_outlined, size: 18),
                    label: const Text('Местоположение'),
                  ),
                if (!isPlaced)
                  TextButton.icon(
                    onPressed: () => _openPlace(c),
                    icon: const Icon(Icons.inventory_2_outlined, size: 18),
                    label: const Text('Разместить'),
                  ),
                IconButton(
                  tooltip: 'Открыть карточку',
                  icon: const Icon(Icons.open_in_new),
                  onPressed: () => _openContainer(c),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusIcon(ContainerStatus s) {
    switch (s) {
      case ContainerStatus.pendingFilling:
        return const Icon(Icons.edit_note, color: Colors.orange, size: 20);
      case ContainerStatus.pendingPlacement:
        return const Icon(Icons.inventory_2, color: Colors.orange, size: 20);
      case ContainerStatus.active:
        return const Icon(Icons.check_circle, color: Colors.green, size: 20);
      case ContainerStatus.inTransit:
        return const Icon(Icons.local_shipping, color: Colors.blue, size: 20);
      case ContainerStatus.issued:
        return const Icon(Icons.output, color: Colors.grey, size: 20);
      case ContainerStatus.unknown:
        return const Icon(Icons.help_outline, color: Colors.grey, size: 20);
    }
  }

  Widget _printIcon(String? status) {
    if (status == 'PRINTED') {
      return const Icon(Icons.print, color: Colors.green, size: 20);
    }
    if (status == 'READY') {
      return const Icon(Icons.print, color: Colors.blue, size: 20);
    }
    if (status == 'DRAFT') {
      return const Icon(Icons.print, color: Colors.orange, size: 20);
    }
    return const Icon(Icons.print_disabled, color: Colors.grey, size: 20);
  }

  Widget _buildPager(ThemeData theme) {
    final total = _pageData?.count ?? 0;
    return Material(
      color: theme.colorScheme.surface,
      elevation: 2,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Row(
            children: [
              Flexible(
                child: Text(
                  'Всего: $total',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall,
                ),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.chevron_left),
                onPressed: _loading || _page <= 1
                    ? null
                    : () {
                        setState(() => _page -= 1);
                        _loadPage();
                      },
              ),
              Text('$_page / $_totalPages', style: theme.textTheme.bodySmall),
              IconButton(
                icon: const Icon(Icons.chevron_right),
                onPressed: _loading || _page >= _totalPages
                    ? null
                    : () {
                        setState(() => _page += 1);
                        _loadPage();
                      },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
