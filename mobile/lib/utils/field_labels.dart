/// Русские названия полей и значений для списка расхождений
/// (пачка conflict-ui-10).
///
/// Кладовщик не должен видеть `draft_research_type_id` или `PENDING_FILLING`
/// — только понятные слова.
library;

const Map<String, String> _fieldLabels = <String, String>{
  'status': 'Статус',
  'container_number': 'Номер тары',
  'comment': 'Примечание',
  'container_type': 'Тип тары',
  'container_type_id': 'Тип тары',
  'position_on_pallet': 'Место на поддоне',
  'draft_site': 'Участок',
  'draft_site_id': 'Участок',
  'draft_research_type': 'Тип исследования',
  'draft_research_type_id': 'Тип исследования',
  'draft_work_order_coded': 'Н/З (кодированное)',
  'draft_work_order_incoming': 'Н/З (входящее)',
  'cell_full_address': 'Ячейка',
  'floor_room_name': 'Комната (на полу)',
  'sample_number': 'Номер пробы',
  'well_name': 'Скважина',
  'site_id': 'Участок',
  'research_type_id': 'Тип исследования',
  'disposal_reason': 'Причина списания',
};

/// Название поля на русском. Неизвестное поле показываем как есть.
String fieldLabel(String field) => _fieldLabels[field] ?? field;

const Map<String, String> _statusLabels = <String, String>{
  'PENDING_FILLING': 'Ожидает заполнения',
  'ACTIVE': 'Активна',
  'DISPOSED': 'Утилизирована',
  'PENDING_PLACEMENT': 'Ожидает размещения',
  'IN_STORAGE': 'На хранении',
  'SELECTED': 'Отобрана',
};

/// Значение поля человеческим языком.
String displayValue(String field, dynamic value) {
  if (value == null) return '—';
  if (value is String && value.isEmpty) return '—';
  if (value is bool) return value ? 'да' : 'нет';
  if (field == 'status' && value is String) {
    return _statusLabels[value] ?? value;
  }
  return value.toString();
}
