/// Тесты модели Container (c-7a).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/container.dart';

void main() {
  group('Container.fromJson', () {
    test('полный ответ backend: денормализация + печать', () {
      final c = Container.fromJson({
        'id': 42,
        'container_number': 'T-001',
        'container_type': 3,
        'container_type_name': 'Коробка',
        'qr_code': 'WMSG:CONTAINER:42',
        'pallet': 7,
        'cell_id': 15,
        'cell_full_address': 'Комната 1 / A / S1 / A / 5',
        'floor_room': null,
        'floor_room_name': null,
        'position_on_pallet': 2,
        'status': 'ACTIVE',
        'comment': 'OK',
        'comment_template_text': null,
        'draft_site_name': 'Тестовый',
        'draft_research_type_name': 'Шлифы',
        'draft_work_order_coded': 'TST0001',
        'draft_work_order_incoming': '02-Тест001',
        'print_batch_status': 'READY',
        'label_printed_at': '2026-10-30T10:00:00Z',
        'created_at': '2026-10-30T09:00:00Z',
        'updated_at': '2026-10-30T10:00:00Z',
      });
      expect(c.id, 42);
      expect(c.containerNumber, 'T-001');
      expect(c.containerTypeName, 'Коробка');
      expect(c.cellFullAddress, 'Комната 1 / A / S1 / A / 5');
      expect(c.locationLabel, 'Комната 1 / A / S1 / A / 5');
      expect(c.status, ContainerStatus.active);
      expect(c.printBatchStatus, 'READY');
      expect(c.draftWorkOrderCoded, 'TST0001');
      expect(c.labelPrintedAt, isNotNull);
    });

    test('PENDING_FILLING — новый статус (1.62)', () {
      final c = Container.fromJson({
        'id': 1,
        'container_number': null,
        'container_type': 1,
        'container_type_name': 'Коробка',
        'status': 'PENDING_FILLING',
      });
      expect(c.status, ContainerStatus.pendingFilling);
      expect(c.statusLabel, 'Ожидает заполнения');
    });

    test('container_number = null → displayName = «Черновик #ID»', () {
      final c = Container.fromJson({
        'id': 99,
        'container_number': null,
        'container_type': 1,
        'container_type_name': 'Ящик',
        'status': 'PENDING_FILLING',
      });
      expect(c.displayName, 'Черновик #99');
    });

    test('на полу: locationLabel = «На полу: Комната 2»', () {
      final c = Container.fromJson({
        'id': 1,
        'container_number': 'T-2',
        'container_type': 1,
        'container_type_name': 'Коробка',
        'floor_room': 2,
        'floor_room_name': 'Комната 2',
        'cell_full_address': null,
        'status': 'ACTIVE',
      });
      expect(c.locationLabel, 'На полу: Комната 2');
    });

    test('без места: locationLabel = «Место не указано»', () {
      final c = Container.fromJson({
        'id': 1,
        'container_number': 'T-3',
        'container_type': 1,
        'container_type_name': 'Коробка',
        'status': 'PENDING_FILLING',
      });
      expect(c.locationLabel, 'Место не указано');
    });
  });
}
