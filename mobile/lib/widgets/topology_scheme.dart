/// Интерактивная схема стеллажа/секции (topology-scheme-mobile).
///
/// Паритет с веб TopologyScheme: группы=секции, строки=ярусы,
/// квадраты=ячейки с цветом заполненности и рамкой текущей;
/// тап по квадрату = onPickCell.
library;

import 'package:flutter/material.dart';

import '../models/catalog.dart';
import '../utils/scheme_rows.dart';

/// Палитра (паритет с веб OCCUPANCY_COLORS).
const Map<String, Color> kOccupancyColors = {
  'empty': Color(0xFFBDBDBD),
  'filled': Color(0xFF2EB84C),
  'near': Color(0xFFF2E500),
  'full': Color(0xFFE8112D),
};

class SchemeGroup {
  const SchemeGroup({required this.label, required this.rows});

  final String label;
  final List<SchemeRow> rows;
}

class TopologyScheme extends StatelessWidget {
  const TopologyScheme({
    super.key,
    required this.groups,
    required this.currentCellId,
    required this.onPickCell,
  });

  final List<SchemeGroup> groups;
  final int? currentCellId;
  final void Function(CellInfo cell) onPickCell;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: groups.map((g) {
        return Padding(
        padding: const EdgeInsets.only(right: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (g.label.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(g.label, style: theme.textTheme.titleSmall),
              ),
            ...g.rows.map(
              (row) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    SizedBox(
                      width: 24,
                      child: Text(row.label, style: theme.textTheme.bodySmall),
                    ),
                    ...row.cells.map(
                      (c) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: GestureDetector(
                          onTap: () => onPickCell(c),
                          child: Container(
                            width: 26,
                            height: 26,
                            decoration: BoxDecoration(
                              color:
                                  kOccupancyColors[occupancyKey(
                                    c.containersCount,
                                    c.capacityLimit,
                                  )],
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color: c.id == currentCellId
                                    ? theme.colorScheme.primary
                                    : Colors.transparent,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        );
      }).toList(),
    );
  }
}
