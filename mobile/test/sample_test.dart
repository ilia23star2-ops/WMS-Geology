// Тесты модели Sample.
//
// Покрывают `Sample.fromJson` — парсинг ответа backend
// `GET /samples/` — SampleSerializer.
//
// Статусы: `ISSUED` и `PENDING_DECRYPTION` удалены из `Sample.STATUS_CHOICES`
// в `2f-9c` (DECISIONS 1.58). В модели — только реальные статусы.

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/sample.dart';

void main() {
  group('Sample.fromJson', () {
    test('полный ответ backend', () {
      final s = Sample.fromJson({
        'id': 1,
        'sample_number': 'TAA-A34076001-001',
        'research_type_name': 'Шлифы',
        'current_work_order_number': 'TST0001',
        'status': 'IN_STORAGE',
      });
      expect(s.id, 1);
      expect(s.sampleNumber, 'TAA-A34076001-001');
      expect(s.researchTypeName, 'Шлифы');
      expect(s.currentWorkOrderNumber, 'TST0001');
      expect(s.status, SampleStatus.inStorage);
      expect(s.statusLabel, 'На хранении');
    });

    test('без Н/З', () {
      final s = Sample.fromJson({
        'id': 2,
        'sample_number': 'TST-002',
        'research_type_name': 'Шлифы',
        'current_work_order_number': null,
        'status': 'IN_STORAGE',
      });
      expect(s.currentWorkOrderNumber, isNull);
    });

    test('без research_type_name — пустая строка', () {
      final s = Sample.fromJson({
        'id': 3,
        'sample_number': 'TST-003',
        'status': 'IN_STORAGE',
      });
      expect(s.researchTypeName, '');
    });

    test('неизвестный статус — unknown', () {
      final s = Sample.fromJson({
        'id': 4,
        'sample_number': 'TST-004',
        'research_type_name': 'Шлифы',
        'status': 'SOMETHING_NEW',
      });
      expect(s.status, SampleStatus.unknown);
      expect(s.statusLabel, 'Неизвестно');
    });

    test('PENDING_PLACEMENT (2f-5c-1) — не «Неизвестно»', () {
      final s = Sample.fromJson({
        'id': 5,
        'sample_number': 'TST-005',
        'research_type_name': 'Шлифы',
        'status': 'PENDING_PLACEMENT',
      });
      expect(s.status, SampleStatus.pendingPlacement);
      expect(s.statusLabel, 'Ожидает размещения');
    });

    test('SELECTED (2f-9b) — не «Неизвестно»', () {
      final s = Sample.fromJson({
        'id': 6,
        'sample_number': 'TST-006',
        'research_type_name': 'Шлифы',
        'status': 'SELECTED',
      });
      expect(s.status, SampleStatus.selected);
      expect(s.statusLabel, 'Выбрана');
    });

    test('DISPOSED', () {
      final s = Sample.fromJson({
        'id': 7,
        'sample_number': 'TST-007',
        'research_type_name': 'Шлифы',
        'status': 'DISPOSED',
      });
      expect(s.status, SampleStatus.disposed);
      expect(s.statusLabel, 'Утилизирована');
    });
  });
}
