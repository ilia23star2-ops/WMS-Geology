/// Диалог создания справочника (c-8-catalog-create, c-8-catalog-create-offline,
/// topology-offline-2).
///
/// Поля — по `kind`:
/// - `site` → `code`, `name`, `match_patterns` (через запятую);
/// - `research_type` → `code`, `name`;
/// - `laboratory` → `code`, `name`, `prefixes` (через запятую);
/// - `container_type` → `name`, `size_class`, `max_on_standard_pallet`,
///   `is_core`, `laboratory`;
/// - топология: `room` → `name`; `rack`/`section`/`tier`/`cell` →
///   родитель из `parents` + `code`. Родитель обязателен, кроме комнаты.
///   Ключи родителя — голые FK, как в сериализаторах (`room`, `rack`,
///   `section`, `tier`). `cell_type` и `level_number` не шлём: у них
///   серверные дефолты / опциональность.
///
/// c-8-catalog-create-offline: при офлайне создаётся локально (negative ID),
/// SnackBar «Создано офлайн. Отправится при синхронизации.».
/// В `sync_queue` уходит POST с `localRef = negativeId`; `SyncPusher`
/// во втором заходе маппит ID и обновляет зависимые операции.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/catalog.dart';
import '../services/api_client.dart';
import '../services/catalog_service.dart';

class CatalogCreateDialog extends StatefulWidget {
  const CatalogCreateDialog({
    super.key,
    required this.kind,
    this.laboratories = const [],
    this.parents = const [],
  });

  /// `site` / `research_type` / `laboratory` / `container_type` /
  /// `room` / `rack` / `section` / `tier` / `cell`.
  final String kind;

  /// Для `container_type` — список лабораторий (дропдаун `laboratory`).
  final List<Laboratory> laboratories;

  /// Для топологии (кроме `room`) — варианты родителя
  /// (комнаты для стеллажа, стеллажи для секции и т.д.).
  final List<NamedCatalog> parents;

  @override
  State<CatalogCreateDialog> createState() => _CatalogCreateDialogState();
}

class _CatalogCreateDialogState extends State<CatalogCreateDialog> {
  final _codeCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _patternsCtrl = TextEditingController();
  final _prefixesCtrl = TextEditingController();
  final _sizeClassCtrl = TextEditingController(text: 'M');
  final _maxCtrl = TextEditingController(text: '10');

  int? _laboratoryId;
  int? _parentId;
  bool _isCore = false;
  bool _submitting = false;
  String? _error;

  bool get _isSite => widget.kind == 'site';
  bool get _isResearchType => widget.kind == 'research_type';
  bool get _isLaboratory => widget.kind == 'laboratory';
  bool get _isContainerType => widget.kind == 'container_type';
  bool get _isRoom => widget.kind == 'room';
  bool get _isRack => widget.kind == 'rack';
  bool get _isSection => widget.kind == 'section';
  bool get _isTier => widget.kind == 'tier';
  bool get _isCell => widget.kind == 'cell';

  /// Топология с кодом вместо имени (всё, кроме комнаты).
  bool get _isCodeTopology => _isRack || _isSection || _isTier || _isCell;

  /// Поле родителя в payload (голый FK-ключ, как в сериализаторах).
  String? get _parentField {
    switch (widget.kind) {
      case 'rack':
        return 'room';
      case 'section':
        return 'rack';
      case 'tier':
        return 'section';
      case 'cell':
        return 'tier';
      default:
        return null;
    }
  }

  /// Подпись родителя в винительном падеже («выберите комнату»).
  String get _parentLabel {
    switch (widget.kind) {
      case 'rack':
        return 'комнату';
      case 'section':
        return 'стеллаж';
      case 'tier':
        return 'секцию';
      case 'cell':
        return 'ярус';
      default:
        return 'родителя';
    }
  }

  String get _codeHint {
    if (_isTier) return 'A / B / C / D';
    if (_isCell) return '1 / 2 / 3';
    return 'TST / ШЛ / ЛАБ-1';
  }

  String get _title {
    switch (widget.kind) {
      case 'site':
        return 'Новый участок';
      case 'research_type':
        return 'Новый тип исследования';
      case 'laboratory':
        return 'Новая лаборатория';
      case 'container_type':
        return 'Новый тип тары';
      case 'room':
        return 'Новая комната';
      case 'rack':
        return 'Новый стеллаж';
      case 'section':
        return 'Новая секция';
      case 'tier':
        return 'Новый ярус';
      case 'cell':
        return 'Новая ячейка';
      default:
        return 'Новый справочник';
    }
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    _nameCtrl.dispose();
    _patternsCtrl.dispose();
    _prefixesCtrl.dispose();
    _sizeClassCtrl.dispose();
    _maxCtrl.dispose();
    super.dispose();
  }

  List<String> _parseCommaList(String raw) {
    return raw
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> _submit() async {
    // Топология с родителем: родитель обязателен до остальных проверок.
    if (_isCodeTopology && _parentId == null) {
      setState(() => _error = 'Выберите $_parentLabel');
      return;
    }

    final name = _nameCtrl.text.trim();
    final nameRequired =
        _isSite ||
        _isResearchType ||
        _isLaboratory ||
        _isContainerType ||
        _isRoom;
    if (nameRequired && name.isEmpty) {
      setState(() => _error = 'Название обязательно');
      return;
    }
    final code = _codeCtrl.text.trim();
    final codeRequired =
        _isSite || _isResearchType || _isLaboratory || _isCodeTopology;
    if (codeRequired && code.isEmpty) {
      setState(() => _error = 'Код обязателен');
      return;
    }

    final Map<String, dynamic> payload;
    if (_isSite) {
      payload = {
        'code': code,
        'name': name,
        'match_patterns': _parseCommaList(_patternsCtrl.text),
      };
    } else if (_isResearchType) {
      payload = {'code': code, 'name': name};
    } else if (_isLaboratory) {
      payload = {
        'code': code,
        'name': name,
        'prefixes': _parseCommaList(_prefixesCtrl.text),
      };
    } else if (_isContainerType) {
      final max = int.tryParse(_maxCtrl.text.trim()) ?? 10;
      if (max < 1) {
        setState(() => _error = 'Вместимость должна быть ≥ 1');
        return;
      }
      payload = {
        'name': name,
        if (_laboratoryId != null) 'laboratory': _laboratoryId,
        'size_class': _sizeClassCtrl.text.trim(),
        'max_on_standard_pallet': max,
        'is_core': _isCore,
      };
    } else if (_isRoom) {
      payload = {'name': name};
    } else if (_isCodeTopology) {
      payload = {'code': code, _parentField!: _parentId};
    } else {
      setState(() => _error = 'Неизвестный тип справочника');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    final service = context.read<CatalogService>();
    try {
      final created = await service.create(widget.kind, payload);
      if (!mounted) return;

      // c-8-catalog-create-offline: SnackBar по результату.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            created.queued
                ? 'Создано офлайн. Отправится при синхронизации.'
                : 'Создано: ${created.raw['name'] ?? created.raw['code'] ?? created.id}',
          ),
        ),
      );

      Navigator.of(context).pop(created);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Не удалось создать: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: Text(_title),
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
            if (_isCodeTopology) ...[
              if (widget.parents.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Сначала создайте $_parentLabel — пока выбирать не из чего.',
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
                ),
              DropdownButtonFormField<int?>(
                initialValue: _parentId,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Родитель *',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                items: widget.parents
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
                onChanged: (v) => setState(() => _parentId = v),
              ),
              const SizedBox(height: 8),
            ],
            if (_isSite ||
                _isResearchType ||
                _isLaboratory ||
                _isCodeTopology) ...[
              TextField(
                controller: _codeCtrl,
                decoration: InputDecoration(
                  labelText: 'Код *',
                  hintText: _codeHint,
                  border: const OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 8),
            ],
            if (!_isCodeTopology)
              TextField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Название *',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            if (_isSite) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _patternsCtrl,
                decoration: const InputDecoration(
                  labelText: 'Паттерны распознавания (через запятую)',
                  hintText: 'TST, Тест',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ],
            if (_isLaboratory) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _prefixesCtrl,
                decoration: const InputDecoration(
                  labelText: 'Префиксы (через запятую)',
                  hintText: 'TAA-A, TAA-B',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ],
            if (_isContainerType) ...[
              const SizedBox(height: 8),
              DropdownButtonFormField<int?>(
                initialValue: _laboratoryId,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Лаборатория',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                items: [
                  const DropdownMenuItem<int?>(
                    value: null,
                    child: Text(
                      '— общий тип —',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  ...widget.laboratories.map(
                    (l) => DropdownMenuItem<int?>(
                      value: l.id,
                      child: Text(
                        l.label,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                  ),
                ],
                onChanged: (v) => setState(() => _laboratoryId = v),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _sizeClassCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Размер',
                        hintText: 'S / M / L / XL',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _maxCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Вместимость',
                        hintText: '10',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                ],
              ),
              CheckboxListTile(
                value: _isCore,
                onChanged: (v) => setState(() => _isCore = v ?? false),
                title: const Text('Керновый тип'),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                dense: true,
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Отмена'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
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
}
