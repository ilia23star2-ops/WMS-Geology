/// Тесты русских названий полей и значений (пачка conflict-ui-10).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/field_labels.dart';

void main() {
  group('fieldLabel', () {
    test('известные поля — по-русски', () {
      expect(fieldLabel('status'), 'Статус');
      expect(fieldLabel('container_number'), 'Номер тары');
      expect(fieldLabel('comment'), 'Примечание');
    });

    test('draft-поля называются понятно, без технического вида', () {
      expect(fieldLabel('draft_research_type_id'), 'Тип исследования');
      expect(fieldLabel('draft_site'), 'Участок');
      expect(fieldLabel('draft_work_order_coded'), 'Н/З (кодированное)');
    });

    test('неизвестное поле показываем как есть', () {
      expect(fieldLabel('some_new_field'), 'some_new_field');
    });
  });

  group('displayValue', () {
    test('статусы — по-русски', () {
      expect(displayValue('status', 'PENDING_FILLING'), 'Ожидает заполнения');
      expect(displayValue('status', 'DISPOSED'), 'Утилизирована');
      expect(displayValue('status', 'IN_STORAGE'), 'На хранении');
    });

    test('неизвестный статус и обычные значения — как есть', () {
      expect(displayValue('status', 'SOMETHING_NEW'), 'SOMETHING_NEW');
      expect(displayValue('comment', 'проверено'), 'проверено');
      expect(displayValue('position_on_pallet', 3), '3');
    });

    test('пусто и null — прочерк, bool — да/нет', () {
      expect(displayValue('comment', null), '—');
      expect(displayValue('comment', ''), '—');
      expect(displayValue('flag', true), 'да');
      expect(displayValue('flag', false), 'нет');
    });
  });
}
