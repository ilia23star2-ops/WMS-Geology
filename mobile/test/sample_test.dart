// Тесты модели Sample — парсинг JSON.
//
// SampleService — I/O (Dio), юнит-тестами не покрываем (RULES.md §12.3).

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/sample.dart';

void main() {
  group('Sample.fromJson', () {
    test('полный ответ', () {
      final s = Sample.fromJson({
        'id': 42,
        'sample_number': 'TAA-A34076001-001',
        'research_type_name': 'Шлифы',
        'current_work_order_number': 'TST0001',
        'status': 'IN_STORAGE',
      });
      expect(s.id, 42);
      expect(s.sampleNumber, 'TAA-A34076001-001');
      expect(s.researchTypeName, 'Шлифы');
      expect(s.currentWorkOrderNumber, 'TST0001');
      expect(s.status, SampleStatus.inStorage);
      expect(s.statusLabel, 'В хранении');
    });

    test('без Н/З', () {
      final s = Sample.fromJson({
        'id': 1,
        'sample_number': 'X',
        'research_type_name': 'ШЛ',
        'status': 'DISPOSED',
      });
      expect(s.currentWorkOrderNumber, isNull);
      expect(s.status, SampleStatus.disposed);
    });

    test('без research_type_name — пустая строка', () {
      final s = Sample.fromJson({
        'id': 1,
        'sample_number': 'X',
        'status': 'CONSUMED',
      });
      expect(s.researchTypeName, '');
      expect(s.status, SampleStatus.consumed);
    });

    test('неизвестный статус — unknown', () {
      final s = Sample.fromJson({
        'id': 1,
        'sample_number': 'X',
        'status': 'FOO',
      });
      expect(s.status, SampleStatus.unknown);
    });

    test('PENDING_DECRYPTION', () {
      final s = Sample.fromJson({
        'id': 1,
        'sample_number': 'X',
        'status': 'PENDING_DECRYPTION',
      });
      expect(s.status, SampleStatus.pendingDecryption);
    });
  });
}