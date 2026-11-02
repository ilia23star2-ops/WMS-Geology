/// Диалог редактирования диапазона (c-7f).
///
/// Порт `web/src/components/RangeEditDialog.tsx`.
/// Позволяет задать:
/// - «Отсутствуют» — sequence numbers, которых нет физически;
/// - «Выбраны» — sequence numbers, помеченные SELECTED.
///
/// Формат ввода: "2, 4-7, 9". См. `parseIntRanges`.
library;

import 'package:flutter/material.dart';

import '../utils/int_ranges.dart';

class RangeEditDialog extends StatefulWidget {
  const RangeEditDialog({
    super.key,
    required this.initialRaw,
    required this.initialSkipped,
    required this.initialSelected,
    required this.onClose,
    required this.onSave,
  });

  final String initialRaw;
  final String initialSkipped;
  final String initialSelected;
  final VoidCallback onClose;
  final void Function(String raw, List<int> skipped, List<int> selected) onSave;

  @override
  State<RangeEditDialog> createState() => _RangeEditDialogState();
}

class _RangeEditDialogState extends State<RangeEditDialog> {
  late final TextEditingController _rawCtrl;
  late final TextEditingController _skippedCtrl;
  late final TextEditingController _selectedCtrl;

  @override
  void initState() {
    super.initState();
    _rawCtrl = TextEditingController(text: widget.initialRaw);
    _skippedCtrl = TextEditingController(text: widget.initialSkipped);
    _selectedCtrl = TextEditingController(text: widget.initialSelected);
  }

  @override
  void dispose() {
    _rawCtrl.dispose();
    _skippedCtrl.dispose();
    _selectedCtrl.dispose();
    super.dispose();
  }

  void _save() {
    final raw = _rawCtrl.text.trim();
    if (raw.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Введите диапазон.')));
      return;
    }
    widget.onSave(
      raw,
      parseIntRanges(_skippedCtrl.text),
      parseIntRanges(_selectedCtrl.text),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Редактировать диапазон'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _rawCtrl,
              style: const TextStyle(fontFamily: 'monospace'),
              decoration: const InputDecoration(
                labelText: 'Диапазон',
                helperText: 'Например: TAA-A34076001-031',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _skippedCtrl,
              style: const TextStyle(fontFamily: 'monospace'),
              decoration: const InputDecoration(
                labelText: 'Отсутствуют (нет физически)',
                helperText: 'Например: 2, 4-7',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _selectedCtrl,
              style: const TextStyle(fontFamily: 'monospace'),
              decoration: const InputDecoration(
                labelText: 'Выбраны (нет физически, но в списках)',
                helperText: 'Например: 1, 8-9',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: widget.onClose, child: const Text('Отмена')),
        FilledButton(onPressed: _save, child: const Text('Применить')),
      ],
    );
  }
}
