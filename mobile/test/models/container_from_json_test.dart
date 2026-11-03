/// Тесты `Container.fromJson` (c-2d-2a-fix-3).
///
/// Покрывает совместимость с локальным форматом:
/// `container_type_id`, `draft_site_id`, `draft_research_type_id`.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/container.dart';

void main() {
  group('Container.fromJson — серверный формат', () {
    test('полный ответ ContainerSerializer', () {
      final c = Container.fromJson({
        'id': 42,
        'container_number': 'T-001',
        'container_type': 5,
        'container_type_name': 'Ящик',
        'qr_code': 'WMSG:CONTAINER:42',
        'pallet': 3,
        'cell_id': 15,
        'cell_full_address': 'Ком1/A/S1/A/5',
        'floor_room': null,
        'floor_room_name': null,
        'position_on_pallet': 2,
        'status': 'ACTIVE',
        'comment': 'хрупкая',
        'comment_template_text': null,
        'draft_site': 1,
        'draft_site_name': 'Тестовый',
        'draft_research_type': 2,
        'draft_research_type_name': 'Шлифы',
        'draft_work_order_coded': 'TST0001',
        'draft_work_order_incoming': '02-Тест001',
        'print_batch_status': 'READY',
        'label_printed_at': '2026-11-02T10:00:00Z',
        'created_at': '2026-11-01T00:00:00Z',
        'updated_at': '2026-11-02T00:00:00Z',
      });

      expect(c.id, 42);
      expect(c.containerNumber, 'T-001');
      expect(c.containerType, 5);
      expect(c.containerTypeName, 'Ящик');
      expect(c.status, ContainerStatus.active);
      expect(c.draftSiteId, 1);
      expect(c.draftResearchTypeId, 2);
      expect(c.cellFullAddress, 'Ком1/A/S1/A/5');
      expect(c.printBatchStatus, 'READY');
      expect(c.pendingSync, isFalse);
    });
  });

  group('Container.fromJson — локальный формат (c-2d-2)', () {
    test('container_type_id fallback', () {
      // Минимальный локальный объект: только `id` + `container_type_id`.
      final c = Container.fromJson({
        'id': -1699000000000,
        'container_type_id': 5,
        'status': 'PENDING_FILLING',
      });

      expect(c.id, -1699000000000);
      expect(c.containerType, 5);
      expect(c.status, ContainerStatus.pendingFilling);
    });

    test('draft_site_id / draft_research_type_id fallback', () {
      final c = Container.fromJson({
        'id': -1,
        'container_type_id': 5,
        'draft_site_id': 7,
        'draft_research_type_id': 9,
        'status': 'PENDING_FILLING',
      });

      expect(c.draftSiteId, 7);
      expect(c.draftResearchTypeId, 9);
    });

    test('нет ни container_type, ни container_type_id — 0, без краша', () {
      final c = Container.fromJson({'id': -1, 'status': 'PENDING_FILLING'});

      expect(c.containerType, 0);
      expect(c.draftSiteId, isNull);
      expect(c.draftResearchTypeId, isNull);
    });

    test('нет status — unknown', () {
      final c = Container.fromJson({'id': -1, 'container_type_id': 5});
      expect(c.status, ContainerStatus.unknown);
    });

    test('_pending_sync = true', () {
      final c = Container.fromJson({
        'id': -1,
        'container_type_id': 5,
        '_pending_sync': true,
      });
      expect(c.pendingSync, isTrue);
    });
  });
}
