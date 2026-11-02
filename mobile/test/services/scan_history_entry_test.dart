/// Тесты модели `ScanHistoryEntry` (c-7h, c-7h-fix).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/container.dart';
import 'package:wms_geology_mobile/models/scan_history_entry.dart';

Container _makeContainer({
  int id = 42,
  String? number = 'T-001',
  String workOrder = 'TST0001',
  String? researchType = 'Шлифы',
}) {
  return Container(
    id: id,
    containerNumber: number,
    containerType: 1,
    containerTypeName: 'Коробка',
    qrCode: null,
    pallet: null,
    cellId: null,
    cellFullAddress: null,
    floorRoom: null,
    floorRoomName: null,
    positionOnPallet: null,
    status: ContainerStatus.active,
    comment: '',
    commentTemplateText: null,
    draftSiteId: null,
    draftSiteName: null,
    draftResearchTypeId: null,
    draftResearchTypeName: researchType,
    draftWorkOrderCoded: workOrder,
    draftWorkOrderIncoming: '',
    printBatchStatus: null,
    labelPrintedAt: null,
    createdAt: null,
    updatedAt: null,
  );
}

void main() {
  group('ScanHistoryEntry.fromContainer', () {
    test('полные данные → label «Н/З · ТИ · номер»', () {
      final e = ScanHistoryEntry.fromContainer(_makeContainer());
      expect(e.id, 42);
      expect(e.containerNumber, 'T-001');
      expect(e.workOrderCoded, 'TST0001');
      expect(e.researchTypeName, 'Шлифы');
      expect(e.label, 'TST0001 · Шлифы · T-001');
    });

    test('без номера (заготовка) → label «Н/З · ТИ»', () {
      final e = ScanHistoryEntry.fromContainer(_makeContainer(number: null));
      expect(e.containerNumber, isNull);
      expect(e.label, 'TST0001 · Шлифы');
    });

    test('без Н/З и ТИ → label «номер»', () {
      final e = ScanHistoryEntry.fromContainer(
        _makeContainer(workOrder: '', researchType: null),
      );
      expect(e.label, 'T-001');
    });

    test('пусто → fallback «Тара #ID»', () {
      final e = ScanHistoryEntry.fromContainer(
        _makeContainer(number: null, workOrder: '', researchType: null),
      );
      expect(e.label, 'Тара #42');
    });
  });

  group('ScanHistoryEntry.toJson / fromJson', () {
    test('roundtrip', () {
      const e = ScanHistoryEntry(
        id: 1,
        containerNumber: 'T-002',
        workOrderCoded: 'TST0002',
        researchTypeName: 'ХА',
      );
      final restored = ScanHistoryEntry.fromJson(e.toJson());
      expect(restored.id, 1);
      expect(restored.containerNumber, 'T-002');
      expect(restored.workOrderCoded, 'TST0002');
      expect(restored.researchTypeName, 'ХА');
      expect(restored.label, 'TST0002 · ХА · T-002');
    });

    test('null-поля', () {
      final restored = ScanHistoryEntry.fromJson({
        'id': 5,
        'container_number': null,
        'work_order_coded': '',
        'research_type_name': null,
      });
      expect(restored.label, 'Тара #5');
    });
  });
}
