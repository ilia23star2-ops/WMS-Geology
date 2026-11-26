/// Общие виджеты карточки/шторки ячейки (topology-cell-select-mobile).
///
/// Вынесено из `topology_screen.dart`, чтобы экран не превышал
/// порог 500 строк: чип, метаданные ячейки и строка тары.
library;

import 'package:flutter/material.dart';

import '../models/catalog.dart';
import '../models/container.dart' as model;

/// Компактный цветной чип.
Widget chip(String label, Color bg, Color fg) {
  return Chip(
    label: Text(label, style: TextStyle(color: fg, fontSize: 12)),
    backgroundColor: bg,
    side: BorderSide.none,
    visualDensity: VisualDensity.compact,
    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 0),
  );
}

/// Метаданные ячейки: адрес + чипы тип/активность/поддон (шторка).
Widget cellMeta(CellInfo cell, ThemeData theme) {
  final active = cell.isActive != false;
  final palletActive = cell.palletStatus == 'ACTIVE';
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (cell.fullAddress != null)
        Text(cell.fullAddress!, style: theme.textTheme.bodySmall),
      const SizedBox(height: 4),
      Wrap(
        spacing: 6,
        runSpacing: 4,
        children: [
          if (cell.cellType != null)
            chip(
              cell.cellTypeLabel,
              Colors.blueGrey.shade50,
              Colors.blueGrey.shade700,
            ),
          chip(
            cell.activeLabel,
            active ? Colors.green.shade50 : Colors.red.shade50,
            active ? Colors.green.shade700 : Colors.red.shade700,
          ),
          chip(
            cell.palletChipLabel ?? 'без поддона',
            cell.palletId == null
                ? Colors.grey.shade100
                : (palletActive ? Colors.green.shade50 : Colors.amber.shade50),
            cell.palletId == null
                ? Colors.grey.shade600
                : (palletActive
                      ? Colors.green.shade700
                      : Colors.amber.shade800),
          ),
        ],
      ),
    ],
  );
}

/// Строка тары с цветным чипом статуса (шторка).
Widget containerRow(model.Container c) {
  final n = c.status.name;
  final bg = n == 'active' || n == 'placed'
      ? Colors.green.shade50
      : n == 'pendingPlacement'
      ? Colors.amber.shade50
      : n == 'issued'
      ? Colors.blue.shade50
      : Colors.grey.shade100;
  final fg = n == 'active' || n == 'placed'
      ? Colors.green.shade700
      : n == 'pendingPlacement'
      ? Colors.amber.shade800
      : n == 'issued'
      ? Colors.blue.shade700
      : Colors.grey.shade700;
  return Card(
    child: ListTile(
      leading: const Icon(Icons.inventory_2_outlined),
      title: Text(c.displayName),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Align(
          alignment: Alignment.centerLeft,
          child: chip(c.statusLabel, bg, fg),
        ),
      ),
    ),
  );
}
