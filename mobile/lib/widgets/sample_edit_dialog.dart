/// Диалог редактирования пробы (c-7g + c-9-fill-offline-2c-2).
///
/// Порт `web/src/components/SampleEditDialog.tsx` + офлайн-режим.
///
/// Онлайн: `sample_number`, `research_type`, `site`, `status` — всё
/// редактируется, `PATCH /samples/{id}/`.
///
/// Офлайн-проба (`initial.isOfflinePending`): номер и справочники read-only,
/// правится только `status`. `dispose` / `restore` / `delete` — локально
/// через `SampleService.updateLocalOffline` / `deleteLocalOffline`,
/// `_rebuildFillPayload` обновит `sample_groups` в очереди.
///
/// Возвращает `true` через `Navigator.pop(true)`, если что-то изменилось —
/// родитель перезагружает список проб и историю.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/catalog.dart';
import '../models/sample.dart';
import '../services/catalog_service.dart';
import '../services/sample_service.dart';

class SampleEditDialog extends StatefulWidget {
  const SampleEditDialog({
    super.key,
    required this.initial,
    required this.containerId,
  });

  final Sample initial;
  final int containerId;

  @override
  State<SampleEditDialog> createState() => _SampleEditDialogState();
}

class _SampleEditDialogState extends State<SampleEditDialog> {
  late final TextEditingController _numberCtrl;
  late SampleStatus _status;
  int? _researchTypeId;
  int? _siteId;

  List<ResearchType>? _researchTypes;
  List<Site>? _sites;
  bool _catalogsLoading = true;
  String? _error;
  bool _busy = false;

  bool get _isOffline => widget.initial.isOfflinePending;

  @override
  void initState() {
    super.initState();
    _numberCtrl = TextEditingController(text: widget.initial.sampleNumber);
    _status = widget.initial.status;
    _researchTypeId = widget.initial.researchTypeId;
    _siteId = widget.initial.siteId;
    _loadCatalogs();
  }

  @override
  void dispose() {
    _numberCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCatalogs() async {
    final catalog = context.read<CatalogService>();
    try {
      final results = await Future.wait<dynamic>([
        catalog.fetchResearchTypes(),
        catalog.fetchSites(),
      ]);
      if (!mounted) return;
      setState(() {
        _researchTypes = results[0] as List<ResearchType>;
        _sites = results[1] as List<Site>;
        _catalogsLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось загрузить справочники: $e';
        _catalogsLoading = false;
      });
    }
  }

  bool get _isDisposed => widget.initial.status == SampleStatus.disposed;

  Future<void> _save() async {
    final service = context.read<SampleService>();

    if (_isOffline) {
      setState(() {
        _busy = true;
        _error = null;
      });
      try {
        await service.updateLocalOffline(
          widget.initial.id,
          containerId: widget.containerId,
          status: _status,
        );
        if (!mounted) return;
        Navigator.of(context).pop(true);
      } catch (e) {
        if (!mounted) return;
        setState(() {
          _error = 'Не удалось сохранить локально: $e';
          _busy = false;
        });
      }
      return;
    }

    final number = _numberCtrl.text.trim();
    if (number.isEmpty) {
      setState(() => _error = 'Номер пробы обязателен');
      return;
    }
    if (_researchTypeId == null) {
      setState(() => _error = 'Выберите тип исследования');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await service.update(widget.initial.id, {
        'sample_number': number,
        'research_type': _researchTypeId,
        'site': _siteId,
        'status': sampleStatusToApi(_status),
      });
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось сохранить: $e';
        _busy = false;
      });
    }
  }

  Future<void> _dispose() async {
    final service = context.read<SampleService>();

    // Офлайн: статус → DISPOSED, причина не пишется (у локальной её нет).
    if (_isOffline) {
      setState(() {
        _busy = true;
        _error = null;
      });
      try {
        await service.updateLocalOffline(
          widget.initial.id,
          containerId: widget.containerId,
          status: SampleStatus.disposed,
        );
        if (!mounted) return;
        Navigator.of(context).pop(true);
      } catch (e) {
        if (!mounted) return;
        setState(() {
          _error = 'Не удалось утилизировать локально: $e';
          _busy = false;
        });
      }
      return;
    }

    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final ctrl = TextEditingController();
        return AlertDialog(
          title: const Text('Утилизировать пробу?'),
          content: TextField(
            controller: ctrl,
            decoration: const InputDecoration(
              labelText: 'Причина (необязательно)',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(null),
              child: const Text('Отмена'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(ctrl.text),
              child: const Text('Утилизировать'),
            ),
          ],
        );
      },
    );
    if (reason == null) return;
    if (!mounted) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await service.dispose(widget.initial.id, reason: reason);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось утилизировать: $e';
        _busy = false;
      });
    }
  }

  Future<void> _restore() async {
    final service = context.read<SampleService>();

    if (_isOffline) {
      setState(() {
        _busy = true;
        _error = null;
      });
      try {
        // Локальная проба ещё не размещена → возвращаем в PENDING_PLACEMENT.
        await service.updateLocalOffline(
          widget.initial.id,
          containerId: widget.containerId,
          status: SampleStatus.pendingPlacement,
        );
        if (!mounted) return;
        Navigator.of(context).pop(true);
      } catch (e) {
        if (!mounted) return;
        setState(() {
          _error = 'Не удалось вернуть локально: $e';
          _busy = false;
        });
      }
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await service.restore(widget.initial.id);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось вернуть: $e';
        _busy = false;
      });
    }
  }

  Future<void> _delete() async {
    final service = context.read<SampleService>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Удалить пробу?'),
        content: Text(
          '${widget.initial.sampleNumber}\n\n'
          '${_isOffline ? 'Локальная проба будет удалена из очереди.' : 'Действие необратимо.'}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Отмена'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Удалить'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    if (!mounted) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_isOffline) {
        await service.deleteLocalOffline(
          widget.initial.id,
          containerId: widget.containerId,
        );
      } else {
        await service.deleteSample(widget.initial.id);
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось удалить: $e';
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final disabled = _busy || _catalogsLoading;

    return AlertDialog(
      title: Text('Проба «${widget.initial.sampleNumber}»'),
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                [
                  if (widget.initial.containerNumber != null)
                    'Тара: ${widget.initial.containerNumber}',
                  if (widget.initial.currentWorkOrderNumber != null)
                    'Н/З: ${widget.initial.currentWorkOrderNumber}',
                ].join(' · '),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              if (_isOffline) ...[
                const SizedBox(height: 12),
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: theme.colorScheme.tertiaryContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Row(
                      children: [
                        Icon(
                          Icons.cloud_off,
                          size: 16,
                          color: theme.colorScheme.onTertiaryContainer,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Офлайн-проба. Номер и справочники — read-only. '
                            'Изменения уйдут на сервер при синхронизации.',
                            style: TextStyle(
                              fontSize: 12,
                              color: theme.colorScheme.onTertiaryContainer,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _error!,
                    style: TextStyle(color: theme.colorScheme.onErrorContainer),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              TextField(
                controller: _numberCtrl,
                enabled: !disabled && !_isOffline,
                style: const TextStyle(fontFamily: 'monospace'),
                decoration: const InputDecoration(
                  labelText: 'Номер пробы',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              if (_catalogsLoading)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(child: CircularProgressIndicator()),
                )
              else ...[
                _buildResearchTypeDropdown(disabled || _isOffline),
                const SizedBox(height: 12),
                _buildSiteDropdown(disabled || _isOffline),
                const SizedBox(height: 12),
                _buildStatusDropdown(disabled),
              ],
              const SizedBox(height: 16),
              if (_isDisposed &&
                  widget.initial.disposalReason != null &&
                  widget.initial.disposalReason!.isNotEmpty)
                Text(
                  'Причина утилизации: ${widget.initial.disposalReason}',
                  style: theme.textTheme.bodySmall,
                ),
              if (widget.initial.disposedAt != null)
                Text(
                  'Утилизирована: '
                  '${widget.initial.disposedAt!.toLocal().toString().split('.').first}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              const SizedBox(height: 16),
              if (!_isDisposed)
                OutlinedButton.icon(
                  onPressed: disabled ? null : _dispose,
                  icon: const Icon(Icons.delete_sweep, color: Colors.orange),
                  label: const Text('Утилизировать'),
                )
              else
                OutlinedButton.icon(
                  onPressed: disabled ? null : _restore,
                  icon: const Icon(Icons.restore, color: Colors.green),
                  label: const Text('Вернуть из утилизации'),
                ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: disabled ? null : _delete,
                icon: Icon(
                  Icons.delete_forever,
                  color: theme.colorScheme.error,
                ),
                label: const Text('Удалить пробу'),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          child: const Text('Отмена'),
        ),
        FilledButton(
          onPressed: disabled ? null : _save,
          child: Text(_busy ? 'Сохранение...' : 'Сохранить'),
        ),
      ],
    );
  }

  Widget _buildResearchTypeDropdown(bool disabled) {
    final types = _researchTypes ?? const <ResearchType>[];
    final hasCurrent =
        _researchTypeId != null && types.any((t) => t.id == _researchTypeId);
    return DropdownButtonFormField<int>(
      key: ValueKey('rt_$_researchTypeId'),
      initialValue: hasCurrent ? _researchTypeId : null,
      isExpanded: true,
      decoration: const InputDecoration(
        labelText: 'Тип исследования',
        border: OutlineInputBorder(),
      ),
      items: [
        if (_researchTypeId != null && !hasCurrent)
          DropdownMenuItem<int>(
            value: _researchTypeId,
            child: Text(
              'ID $_researchTypeId (не в справочнике)',
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
        ...types.map(
          (t) => DropdownMenuItem<int>(
            value: t.id,
            child: Text(t.label, overflow: TextOverflow.ellipsis, maxLines: 1),
          ),
        ),
      ],
      onChanged: disabled ? null : (v) => setState(() => _researchTypeId = v),
    );
  }

  Widget _buildSiteDropdown(bool disabled) {
    final sites = _sites ?? const <Site>[];
    return DropdownButtonFormField<int?>(
      key: ValueKey('site_$_siteId'),
      initialValue: _siteId,
      isExpanded: true,
      decoration: const InputDecoration(
        labelText: 'Участок',
        border: OutlineInputBorder(),
      ),
      items: [
        const DropdownMenuItem<int?>(
          value: null,
          child: Text('— не указан —', overflow: TextOverflow.ellipsis),
        ),
        ...sites.map(
          (s) => DropdownMenuItem<int?>(
            value: s.id,
            child: Text(s.label, overflow: TextOverflow.ellipsis, maxLines: 1),
          ),
        ),
      ],
      onChanged: disabled ? null : (v) => setState(() => _siteId = v),
    );
  }

  Widget _buildStatusDropdown(bool disabled) {
    return DropdownButtonFormField<SampleStatus>(
      key: ValueKey('status_$_status'),
      initialValue: _status,
      isExpanded: true,
      decoration: const InputDecoration(
        labelText: 'Статус',
        border: OutlineInputBorder(),
      ),
      items: SampleStatus.values.map((s) {
        return DropdownMenuItem<SampleStatus>(
          value: s,
          child: Text(
            sampleStatusLabels[s] ?? s.name,
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
          ),
        );
      }).toList(),
      onChanged: disabled ? null : (v) => setState(() => _status = v!),
    );
  }
}
