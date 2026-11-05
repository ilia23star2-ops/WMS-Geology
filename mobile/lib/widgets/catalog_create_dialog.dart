/// Диалог создания справочника (c-8-catalog-create, c-8-catalog-create-offline).
///
/// Поля — по `kind`:
/// - `site` → `code`, `name`, `match_patterns` (через запятую);
/// - `research_type` → `code`, `name`;
/// - `laboratory` → `code`, `name`, `prefixes` (через запятую);
/// - `container_type` → `name`, `size_class`, `max_on_standard_pallet`,
///   `is_core`, `laboratory`.
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
  });

  /// `site` / `research_type` / `laboratory` / `container_type`.
  final String kind;

  /// Для `container_type` — список лабораторий (dropdown `laboratory`).
  final List<Laboratory> laboratories;

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
  bool _isCore = false;
  bool _submitting = false;
  String? _error;

  bool get _isSite => widget.kind == 'site';
  bool get _isResearchType => widget.kind == 'research_type';
  bool get _isLaboratory => widget.kind == 'laboratory';
  bool get _isContainerType => widget.kind == 'container_type';

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
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Название обязательно');
      return;
    }
    final code = _codeCtrl.text.trim();
    if ((_isSite || _isResearchType || _isLaboratory) && code.isEmpty) {
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
                : 'Создано: ${created.raw['name'] ?? created.id}',
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
            if (_isSite || _isResearchType || _isLaboratory) ...[
              TextField(
                controller: _codeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Код *',
                  hintText: 'TST / ШЛ / ЛАБ-1',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 8),
            ],
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
