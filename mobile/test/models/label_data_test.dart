/// Тесты `LabelData.fromContainer` (c-7f-1).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/container.dart';
import 'package:wms_geology_mobile/models/label_data.dart';
import 'package:wms_geology_mobile/models/sample.dart';

Container _container({
  int id = 42,
  String? number = 'T-001',
  String site = 'Тестовый',
  String rt = 'Шлифы',
  String woCoded = 'TST0001',
  String woIncoming = '02-Тест001',
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
    draftSiteName: site,
    draftResearchTypeId: null,
    draftResearchTypeName: rt,
    draftWorkOrderCoded: woCoded,
    draftWorkOrderIncoming: woIncoming,
    printBatchStatus: null,
    labelPrintedAt: null,
    createdAt: null,
    updatedAt: null,
  );
}

Sample _sample(
  int id,
  String number, {
  SampleStatus status = SampleStatus.inStorage,
}) {
  return Sample(
    id: id,
    sampleNumber: number,
    researchTypeName: 'Шлифы',
    currentWorkOrderNumber: 'TST0001',
    status: status,
  );
}

void main() {
  group('LabelData.fromContainer', () {
    test('полный набор: Н/З вх. + тек., 2 пробы, 1 SELECTED', () {
      final data = LabelData.fromContainer(_container(), [
        _sample(1, 'TST-001'),
        _sample(2, 'TST-002', status: SampleStatus.selected),
      ]);
      expect(data.containerId, 42);
      expect(data.containerNumber, 'T-001');
      expect(data.siteName, 'Тестовый');
      expect(data.workOrderLabel, 'Н/З (вх.):');
      expect(data.workOrderDisplay, '02-Тест001 / TST0001');
      expect(data.researchTypeLabel, 'Шлифы');
      expect(data.samples.length, 2);
      expect(data.samples[0].selected, isFalse);
      expect(data.samples[1].selected, isTrue);
    });

    test('без вх. Н/З — метка «Н/З:», без linked', () {
      final data = LabelData.fromContainer(_container(woIncoming: ''), [
        _sample(1, 'TST-001'),
      ]);
      expect(data.workOrderLabel, 'Н/З:');
      expect(data.workOrderDisplay, 'TST0001');
    });

    test('пустая тара (заготовка) — номер и Н/З пустые', () {
      final data = LabelData.fromContainer(
        _container(number: null, woCoded: '', woIncoming: ''),
        const [],
      );
      expect(data.containerNumber, '');
      expect(data.workOrderLabel, 'Н/З:');
      expect(data.workOrderDisplay, '—');
      expect(data.samples, isEmpty);
    });
  });
}
