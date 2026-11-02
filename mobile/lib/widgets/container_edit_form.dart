/// Форма редактирования тары (c-7b + c-7b-full).
///
/// Поля:
/// - `container_number` — текст;
/// - `container_type` — dropdown (справочник);
/// - `comment` — текст;
/// - `position_on_pallet` — число;
/// - `draft_site` — dropdown (справочник, nullable);
/// - `draft_research_type` — dropdown (справочник, nullable);
/// - `draft_work_order_coded` — текст;
/// - `draft_work_order_incoming` — текст.
///
/// Работает только онлайн: PATCH через `ContainerService.update`.
/// Офлайн-изменения — в `c-8`.
library;

import 'package:flutter/material.dart' hide Container;
import 'package:provider/provider.dart';

import '../models/catalog.dart';
import '../models/container.dart';
import '../services/catalog_service.dart';

class ContainerEditForm extends StatefulWidget {
  const ContainerEditForm({
    super.key,
    required this.initial,
    required this.onSubmit,
  });

  final Container initial;
  final Future<void> Function(Map<String, dynamic> payload) onSubmit;

  @override
  State<ContainerEditForm> createState() => _ContainerEditFormState();
}

class _ContainerEditFormState extends State<ContainerEditForm> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _numberCtrl;
  late final TextEditingController _commentCtrl;
  late final TextEditingController _positionCtrl;
  late final TextEditingController _draftCodedCtrl;
  late final TextEditingController _draftIncomingCtrl;

  late int _selectedContainerTypeId;
  int? _selectedSiteId;
  int? _selectedResearchTypeId;

  // Справочники
  List<Site>? _sites;
  List<ResearchType>? _researchTypes;
  List<ContainerType>? _containerTypes;
  bool _catalogsLoading = true;
  String? _catalogsError;

  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _numberCtrl = TextEditingController(
      text: widget.initial.containerNumber ?? '',
    );
    _commentCtrl = TextEditingController(text: widget.initial.comment);
    _positionCtrl = TextEditingController(
      text: widget.initial.positionOnPallet?.toString() ?? '',
    );
    _draftCodedCtrl = TextEditingController(
      text: widget.initial.draftWorkOrderCoded,
    );
    _draftIncomingCtrl = TextEditingController(
      text: widget.initial.draftWorkOrderIncoming,
    );

    _selectedContainerTypeId = widget.initial.containerType;
    _selectedSiteId = widget.initial.draftSiteId;
    _selectedResearchTypeId = widget.initial.draftResearchTypeId;

    _loadCatalogs();
  }

  @override
  void dispose() {
    _numberCtrl.dispose();
    _commentCtrl.dispose();
    _positionCtrl.dispose();
    _draftCodedCtrl.dispose();
    _draftIncomingCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCatalogs() async {
    setState(() {
      _catalogsLoading = true;
      _catalogsError = null;
    });
    try {
      final catalog = context.read<CatalogService>();
      final results = await Future.wait<dynamic>([
        catalog.fetchSites(),
        catalog.fetchResearchTypes(),
        catalog.fetchContainerTypes(),
      ]);
      if (!mounted) return;
      setState(() {
        _sites = results[0] as List<Site>;
        _researchTypes = results[1] as List<ResearchType>;
        _containerTypes = results[2] as List<ContainerType>;
        _catalogsLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _catalogsError = 'Не удалось загрузить справочники: $e';
        _catalogsLoading = false;
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_catalogsLoading || _catalogsError != null) return;
    setState(() => _saving = true);

    final number = _numberCtrl.text.trim();
    final posText = _positionCtrl.text.trim();
    final payload = <String, dynamic>{
      'container_number': number.isEmpty ? null : number,
      'container_type': _selectedContainerTypeId,
      'comment': _commentCtrl.text.trim(),
      'position_on_pallet': posText.isEmpty ? null : int.tryParse(posText),
      'draft_site': _selectedSiteId,
      'draft_research_type': _selectedResearchTypeId,
      'draft_work_order_coded': _draftCodedCtrl.text.trim(),
      'draft_work_order_incoming': _draftIncomingCtrl.text.trim(),
    };

    try {
      await widget.onSubmit(payload);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_catalogsLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_catalogsError != null) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(
                    _catalogsError!,
                    style: TextStyle(color: theme.colorScheme.error),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _loadCatalogs,
                    child: const Text('Повторить'),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    final disabled = _saving;
    final sites = _sites ?? const <Site>[];
    final researchTypes = _researchTypes ?? const <ResearchType>[];
    final containerTypes = _containerTypes ?? const <ContainerType>[];

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextFormField(
            controller: _numberCtrl,
            enabled: !disabled,
            style: const TextStyle(fontFamily: 'monospace'),
            decoration: const InputDecoration(
              labelText: 'Номер тары',
              helperText: 'Пусто = заготовка без номера',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          _buildContainerTypeDropdown(containerTypes, disabled),
          const SizedBox(height: 16),
          TextFormField(
            controller: _commentCtrl,
            enabled: !disabled,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Комментарий',
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _positionCtrl,
            enabled: !disabled,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Позиция на поддоне',
              helperText: 'Пусто = не указана',
              border: OutlineInputBorder(),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return null;
              final n = int.tryParse(v.trim());
              if (n == null) return 'Введите целое число';
              if (n < 0) return 'Число должно быть >= 0';
              return null;
            },
          ),
          const SizedBox(height: 24),
          Text(
            'Черновик (заполняется при создании, обновляется здесь)',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          _buildSiteDropdown(sites, disabled),
          const SizedBox(height: 16),
          _buildResearchTypeDropdown(researchTypes, disabled),
          const SizedBox(height: 16),
          TextFormField(
            controller: _draftCodedCtrl,
            enabled: !disabled,
            style: const TextStyle(fontFamily: 'monospace'),
            decoration: const InputDecoration(
              labelText: 'Н/З (черновик, тек.)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _draftIncomingCtrl,
            enabled: !disabled,
            style: const TextStyle(fontFamily: 'monospace'),
            decoration: const InputDecoration(
              labelText: 'Н/З (черновик, вх.)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: disabled ? null : _save,
            icon: _saving
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save),
            label: Text(_saving ? 'Сохранение...' : 'Сохранить'),
          ),
        ],
      ),
    );
  }

  Widget _buildContainerTypeDropdown(List<ContainerType> types, bool disabled) {
    // Если текущий тип отсутствует в справочнике — добавляем как fallback.
    final hasCurrent = types.any((t) => t.id == _selectedContainerTypeId);
    final items = <DropdownMenuItem<int>>[
      if (!hasCurrent)
        DropdownMenuItem<int>(
          value: _selectedContainerTypeId,
          child: Text('ID $_selectedContainerTypeId (не в справочнике)'),
        ),
      ...types.map(
        (t) => DropdownMenuItem<int>(value: t.id, child: Text(t.label)),
      ),
    ];

    return DropdownButtonFormField<int>(
      key: ValueKey('container_type_$_selectedContainerTypeId'),
      initialValue: _selectedContainerTypeId,
      decoration: const InputDecoration(
        labelText: 'Тип тары',
        border: OutlineInputBorder(),
      ),
      items: items,
      onChanged: disabled
          ? null
          : (v) {
              if (v != null) {
                setState(() => _selectedContainerTypeId = v);
              }
            },
    );
  }

  Widget _buildSiteDropdown(List<Site> sites, bool disabled) {
    return DropdownButtonFormField<int?>(
      key: ValueKey('draft_site_$_selectedSiteId'),
      initialValue: _selectedSiteId,
      decoration: const InputDecoration(
        labelText: 'Участок (черновик)',
        border: OutlineInputBorder(),
      ),
      items: [
        const DropdownMenuItem<int?>(value: null, child: Text('— не указан —')),
        ...sites.map(
          (s) => DropdownMenuItem<int?>(value: s.id, child: Text(s.label)),
        ),
      ],
      onChanged: disabled ? null : (v) => setState(() => _selectedSiteId = v),
    );
  }

  Widget _buildResearchTypeDropdown(List<ResearchType> types, bool disabled) {
    return DropdownButtonFormField<int?>(
      key: ValueKey('draft_research_type_$_selectedResearchTypeId'),
      initialValue: _selectedResearchTypeId,
      decoration: const InputDecoration(
        labelText: 'Тип исследования (черновик)',
        border: OutlineInputBorder(),
      ),
      items: [
        const DropdownMenuItem<int?>(value: null, child: Text('— не указан —')),
        ...types.map(
          (t) => DropdownMenuItem<int?>(value: t.id, child: Text(t.label)),
        ),
      ],
      onChanged: disabled
          ? null
          : (v) => setState(() => _selectedResearchTypeId = v),
    );
  }
}
