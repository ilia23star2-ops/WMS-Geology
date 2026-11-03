/// Диалог создания тары-заготовок (c-9-container-create + c-8-catalog-create + c-2d-2).
///
/// Рядом с dropdown'ами `site`, `research_type`, `container_type` — кнопка «+».
/// Открывает `CatalogCreateDialog`, после успеха — перезагружает справочники
/// и выбирает созданный элемент.
///
/// c-2d-2: поддержка офлайн-создания (SnackBar зависит от `queued`).
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/catalog.dart';
import '../services/catalog_service.dart';
import '../services/container_service.dart';
import 'catalog_create_dialog.dart';

class CreateContainersDialog extends StatefulWidget {
  const CreateContainersDialog({super.key});

  @override
  State<CreateContainersDialog> createState() => _CreateContainersDialogState();
}

class _CreateContainersDialogState extends State<CreateContainersDialog> {
  static const int _maxCount = 100;

  int? _siteId;
  int? _researchTypeId;
  int? _containerTypeId;
  final _woCtrl = TextEditingController();
  final _woIncomingCtrl = TextEditingController();
  final _countCtrl = TextEditingController(text: '1');
  bool _hasIncoming = false;
  bool _submitting = false;
  String? _error;

  List<Site> _sites = const [];
  List<ResearchType> _researchTypes = const [];
  List<ContainerType> _containerTypes = const [];
  bool _loadingLookups = true;

  @override
  void initState() {
    super.initState();
    _loadLookups();
  }

  @override
  void dispose() {
    _woCtrl.dispose();
    _woIncomingCtrl.dispose();
    _countCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadLookups() async {
    final catalog = context.read<CatalogService>();
    try {
      final results = await Future.wait([
        catalog.fetchSites(),
        catalog.fetchResearchTypes(),
        catalog.fetchContainerTypes(),
      ]);
      if (!mounted) return;
      setState(() {
        _sites = results[0] as List<Site>;
        _researchTypes = results[1] as List<ResearchType>;
        _containerTypes = results[2] as List<ContainerType>;
        _loadingLookups = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingLookups = false);
    }
  }

  /// Открыть `CatalogCreateDialog`, после успеха — перезагрузить справочники
  /// и выбрать созданный элемент в dropdown.
  Future<void> _onCreateCatalog(String kind) async {
    final catalog = context.read<CatalogService>();
    List<Laboratory> laboratories = const [];
    if (kind == 'container_type') {
      try {
        laboratories = await catalog.fetchLaboratories();
      } catch (_) {
        laboratories = const [];
      }
    }
    if (!mounted) return;
    final created = await showDialog<CreatedCatalogItem>(
      context: context,
      builder: (_) =>
          CatalogCreateDialog(kind: kind, laboratories: laboratories),
    );
    if (created == null || !mounted) return;
    await _loadLookups();
    if (!mounted) return;
    switch (kind) {
      case 'site':
        setState(() => _siteId = created.id);
        break;
      case 'research_type':
        setState(() => _researchTypeId = created.id);
        break;
      case 'container_type':
        setState(() => _containerTypeId = created.id);
        break;
    }
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _submitting = true;
    });

    final containerTypeId = _containerTypeId;
    if (containerTypeId == null) {
      setState(() {
        _submitting = false;
        _error = 'Выберите тип тары.';
      });
      return;
    }
    final n = int.tryParse(_countCtrl.text.trim()) ?? 0;
    if (n < 1 || n > _maxCount) {
      setState(() {
        _submitting = false;
        _error = 'Количество тары — от 1 до $_maxCount.';
      });
      return;
    }
    final coded = _woCtrl.text.trim();
    if (coded.isEmpty) {
      setState(() {
        _submitting = false;
        _error = 'Укажите текущий Н/З.';
      });
      return;
    }
    final incoming = _hasIncoming ? _woIncomingCtrl.text.trim() : '';

    final service = context.read<ContainerService>();
    try {
      final containers = List<Map<String, dynamic>>.generate(
        n,
        (_) => {'container_type_id': containerTypeId},
      );
      final result = await service.bulkCreate(
        containers: containers,
        draftSiteId: _siteId,
        draftResearchTypeId: _researchTypeId,
        draftWorkOrderCoded: coded,
        draftWorkOrderIncoming: incoming,
      );
      if (!mounted) return;

      final msg = result.queued
          ? 'Создано тар: ${result.count} (офлайн, синхронизация при '
                'наличии связи)'
          : 'Создано тар: ${result.count}';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

      Navigator.of(context).pop(result.count);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Не удалось создать тару: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: const Text('Создать тару'),
      scrollable: true,
      content: SizedBox(
        width: 460,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              DecoratedBox(
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Text(
                    _error!,
                    style: TextStyle(color: theme.colorScheme.onErrorContainer),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            _dropdownWithAdd<int?>(
              label: 'Участок',
              value: _siteId,
              items: [
                const DropdownMenuItem(
                  value: null,
                  child: Text('— не указан —', overflow: TextOverflow.ellipsis),
                ),
                ..._sites.map(
                  (s) => DropdownMenuItem(
                    value: s.id,
                    child: Text(
                      s.label,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                ),
              ],
              onChanged: (v) => setState(() => _siteId = v),
              onAdd: () => _onCreateCatalog('site'),
            ),
            const SizedBox(height: 8),
            _dropdownWithAdd<int?>(
              label: 'Тип исследования',
              value: _researchTypeId,
              items: [
                const DropdownMenuItem(
                  value: null,
                  child: Text('— не указан —', overflow: TextOverflow.ellipsis),
                ),
                ..._researchTypes.map(
                  (rt) => DropdownMenuItem(
                    value: rt.id,
                    child: Text(
                      rt.label,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                ),
              ],
              onChanged: (v) => setState(() => _researchTypeId = v),
              onAdd: () => _onCreateCatalog('research_type'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _woCtrl,
              decoration: const InputDecoration(
                labelText: 'Н/З (текущий) *',
                hintText: 'TST0001',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              value: _hasIncoming,
              onChanged: (v) => setState(() => _hasIncoming = v ?? false),
              title: const Text('Есть входящий Н/З'),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
            ),
            if (_hasIncoming) ...[
              TextField(
                controller: _woIncomingCtrl,
                decoration: const InputDecoration(
                  labelText: 'Н/З (входящий)',
                  hintText: '02-Тест001',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 8),
            ],
            _dropdownWithAdd<int?>(
              label: 'Тип тары *',
              value: _containerTypeId,
              items: [
                const DropdownMenuItem(
                  value: null,
                  child: Text('— выберите —', overflow: TextOverflow.ellipsis),
                ),
                ..._containerTypes.map(
                  (t) => DropdownMenuItem(
                    value: t.id,
                    child: Text(
                      t.label,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                ),
              ],
              onChanged: (v) => setState(() => _containerTypeId = v),
              onAdd: () => _onCreateCatalog('container_type'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _countCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Количество тары *',
                hintText: '1',
                helperText: 'От 1 до 100',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Тара создаётся без номера. Номера присваиваются на шаге '
              'заполнения пробами.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Отмена'),
        ),
        FilledButton(
          onPressed: _submitting || _loadingLookups ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Создать'),
        ),
      ],
    );
  }

  Widget _dropdownWithAdd<T>({
    required String label,
    required T? value,
    required List<DropdownMenuItem<T?>> items,
    required ValueChanged<T?>? onChanged,
    required VoidCallback onAdd,
  }) {
    return Row(
      children: [
        Expanded(
          child: DropdownButtonFormField<T?>(
            initialValue: value,
            isExpanded: true,
            isDense: true,
            decoration: InputDecoration(
              labelText: label,
              border: const OutlineInputBorder(),
            ),
            items: items,
            onChanged: onChanged,
          ),
        ),
        IconButton(
          tooltip: 'Добавить новый',
          icon: const Icon(Icons.add_circle_outline),
          onPressed: onAdd,
        ),
      ],
    );
  }
}
