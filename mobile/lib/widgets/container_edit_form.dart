/// Форма редактирования тары (c-7b + c-7b-full + c-8b-fix-1 + c-8b-fix-2 + c-8b-fix-3).
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
/// c-8b-fix-1: кнопка «Сохранить» — sticky внизу (вне ListView).
///
/// c-8b-fix-2: payload с `*_name` для локального кэша; лейблы без
/// «(черновик)».
///
/// c-8b-fix-3 (ТД-66): если справочники не загружены (`_catalogsError !=
/// null`) — форма **не блокирует** сохранение. Dropdown'ы
/// `container_type` / `draft_site` / `draft_research_type` — `disabled`
/// (нельзя изменить без справочника), в payload не идут. Текстовые
/// поля редактируются и отправляются. Баннер с «Повторить» для
/// перезагрузки справочников.
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

  /// c-8b-fix-2: имя типа тары по текущему ID. Fallback — из
  /// `widget.initial`, если справочник пуст.
  String? _containerTypeName() {
    for (final t in _containerTypes ?? const <ContainerType>[]) {
      if (t.id == _selectedContainerTypeId) return t.name;
    }
    return widget.initial.containerTypeName;
  }

  /// c-8b-fix-2: имя участка по текущему ID.
  String? _siteName() {
    if (_selectedSiteId == null) return null;
    for (final s in _sites ?? const <Site>[]) {
      if (s.id == _selectedSiteId) return s.name;
    }
    return widget.initial.draftSiteName;
  }

  /// c-8b-fix-2: имя ТИ по текущему ID.
  String? _researchTypeName() {
    if (_selectedResearchTypeId == null) return null;
    for (final rt in _researchTypes ?? const <ResearchType>[]) {
      if (rt.id == _selectedResearchTypeId) return rt.name;
    }
    return widget.initial.draftResearchTypeName;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_catalogsLoading) return;
    // c-8b-fix-3 (ТД-66): если справочники не загружены, не блокируем —
    // сохраняем текстовые поля, dropdown'ы не трогаем.
    setState(() => _saving = true);

    final number = _numberCtrl.text.trim();
    final posText = _positionCtrl.text.trim();
    // Текстовые поля — всегда.
    final payload = <String, dynamic>{
      'container_number': number.isEmpty ? null : number,
      'comment': _commentCtrl.text.trim(),
      'position_on_pallet': posText.isEmpty ? null : int.tryParse(posText),
      'draft_work_order_coded': _draftCodedCtrl.text.trim(),
      'draft_work_order_incoming': _draftIncomingCtrl.text.trim(),
    };

    // c-8b-fix-3: dropdown-поля — только если справочники загружены.
    // Иначе они disabled и не должны уйти в payload (иначе перезапишем
    // старые ID на сервере — не то, что пользователь хотел, или null).
    // c-8b-fix-2: `*_name` — для локального кэша.
    if (_catalogsError == null) {
      payload['container_type'] = _selectedContainerTypeId;
      payload['container_type_name'] = _containerTypeName();
      payload['draft_site'] = _selectedSiteId;
      payload['draft_site_name'] = _siteName();
      payload['draft_research_type'] = _selectedResearchTypeId;
      payload['draft_research_type_name'] = _researchTypeName();
    }

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

    // c-8b-fix-3: при `_catalogsError` форму **не скрываем**. Баннер
    // сверху + dropdown'ы disabled.
    final catalogsBroken = _catalogsError != null;
    final textDisabled = _saving;
    final dropdownDisabled = _saving || catalogsBroken;
    final saveDisabled = _saving || _catalogsLoading;

    final sites = _sites ?? const <Site>[];
    final researchTypes = _researchTypes ?? const <ResearchType>[];
    final containerTypes = _containerTypes ?? const <ContainerType>[];

    return Form(
      key: _formKey,
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (catalogsBroken) ...[
                  Material(
                    color: theme.colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.warning_amber,
                            color: theme.colorScheme.onErrorContainer,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Справочники не загружены. Тип тары, участок и '
                              'ТИ изменить нельзя — остальные поля доступны.',
                              style: TextStyle(
                                color: theme.colorScheme.onErrorContainer,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: _loadCatalogs,
                            child: const Text('Повторить'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextFormField(
                  controller: _numberCtrl,
                  enabled: !textDisabled,
                  style: const TextStyle(fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    labelText: 'Номер тары',
                    helperText: 'Пусто = заготовка без номера',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                _buildContainerTypeDropdown(containerTypes, dropdownDisabled),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _commentCtrl,
                  enabled: !textDisabled,
                  maxLines: 3,
                  minLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Комментарий',
                    border: OutlineInputBorder(),
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _positionCtrl,
                  enabled: !textDisabled,
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
                const SizedBox(height: 16),
                _buildSiteDropdown(sites, dropdownDisabled),
                const SizedBox(height: 16),
                _buildResearchTypeDropdown(researchTypes, dropdownDisabled),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _draftCodedCtrl,
                  enabled: !textDisabled,
                  style: const TextStyle(fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    labelText: 'Н/З (тек.)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _draftIncomingCtrl,
                  enabled: !textDisabled,
                  style: const TextStyle(fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    labelText: 'Н/З (вх.)',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: saveDisabled ? null : _save,
                  icon: _saving
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save),
                  label: Text(_saving ? 'Сохранение...' : 'Сохранить'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContainerTypeDropdown(List<ContainerType> types, bool disabled) {
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
    // c-8b-fix-3: если текущий ID не в справочнике — показываем `null`,
    // иначе `DropdownButton` упадёт с assertion.
    final safeValue = sites.any((s) => s.id == _selectedSiteId)
        ? _selectedSiteId
        : null;

    return DropdownButtonFormField<int?>(
      key: ValueKey('draft_site_$safeValue'),
      initialValue: safeValue,
      decoration: const InputDecoration(
        labelText: 'Участок',
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
    // c-8b-fix-3: то же — защита от assertion.
    final safeValue = types.any((t) => t.id == _selectedResearchTypeId)
        ? _selectedResearchTypeId
        : null;

    return DropdownButtonFormField<int?>(
      key: ValueKey('draft_research_type_$safeValue'),
      initialValue: safeValue,
      decoration: const InputDecoration(
        labelText: 'Тип исследования',
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
