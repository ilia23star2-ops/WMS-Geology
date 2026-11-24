/// Тесты названий операций для списка проблем (пачка sync-problems-2).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/screens/sync_problems_card.dart';

void main() {
  group('describeSyncOperation', () {
    test('создание тары и размещение', () {
      expect(
        describeSyncOperation('/storage/containers/bulk-create/'),
        'Создание тары',
      );
      expect(
        describeSyncOperation('/storage/containers/bulk-place/'),
        'Размещение тары',
      );
    });

    test('справочники', () {
      expect(describeSyncOperation('/sites/'), 'Создание участка');
      expect(
        describeSyncOperation('/research-types/'),
        'Создание типа исследования',
      );
      expect(describeSyncOperation('/laboratories/'), 'Создание лаборатории');
      expect(
        describeSyncOperation('/storage/container-types/'),
        'Создание типа тары',
      );
    });

    test('заполнение и правка тары', () {
      expect(
        describeSyncOperation('/storage/containers/12/fill-samples/'),
        'Заполнение тары пробами',
      );
      expect(
        describeSyncOperation('/storage/containers/12/'),
        'Изменение шапки тары',
      );
    });

    test('операции с пробами: списание, восстановление, правка', () {
      expect(describeSyncOperation('/samples/5/dispose/'), 'Списание пробы');
      expect(
        describeSyncOperation('/samples/5/restore/'),
        'Восстановление пробы',
      );
      expect(describeSyncOperation('/samples/5/'), 'Изменение пробы');
    });

    test('офлайн-записи с отрицательным ID узнаются', () {
      expect(
        describeSyncOperation('/storage/containers/-7/fill-samples/'),
        'Заполнение тары пробами',
      );
      expect(describeSyncOperation('/samples/-5/'), 'Изменение пробы');
      expect(
        describeSyncOperation('/storage/containers/-8/'),
        'Изменение шапки тары',
      );
    });

    test('неизвестный endpoint — общий текст, без падения', () {
      expect(describeSyncOperation('/unknown/'), 'Операция с данными');
      expect(describeSyncOperation(''), 'Операция с данными');
    });
  });
}
