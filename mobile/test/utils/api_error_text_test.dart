/// Тесты разбора ошибок API (пачка sync-errors-13).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/api_error_text.dart';

void main() {
  group('apiErrorText', () {
    test('detail используется как есть', () {
      expect(
        apiErrorText(<String, dynamic>{'detail': 'No Container matches'}),
        'No Container matches',
      );
    });

    test('ошибка поля — русское название и причина', () {
      expect(
        apiErrorText(<String, dynamic>{
          'container_number': <String>['Обязательное поле.'],
        }),
        'Номер тары: Обязательное поле.',
      );
    });

    test('несколько полей перечисляются через точку с запятой', () {
      expect(
        apiErrorText(<String, dynamic>{
          'status': <String>['Недопустимое значение.'],
          'comment': <String>['Слишком длинно.'],
        }),
        'Статус: Недопустимое значение.; Примечание: Слишком длинно.',
      );
    });

    test('non_field_errors — без названия поля', () {
      expect(
        apiErrorText(<String, dynamic>{
          'non_field_errors': <String>['Тара уже заполнена.'],
        }),
        'Тара уже заполнена.',
      );
    });

    test('вложенный список — путь до поля', () {
      expect(
        apiErrorText(<String, dynamic>{
          'containers': <dynamic>[
            <String, dynamic>{
              'container_type_id': <String>['Не существует.'],
            },
          ],
        }),
        'Тип тары: Не существует.',
      );
    });

    test('400 без тела — не «Ошибка сети», а отказ данных', () {
      expect(
        apiErrorText(null, statusCode: 400),
        'Сервер отклонил данные (400)',
      );
      expect(
        apiErrorText(<String, dynamic>{}, statusCode: 400),
        'Сервер отклонил данные (400)',
      );
    });

    test('нет связи — отдельный текст', () {
      expect(apiErrorText(null), 'Нет связи с сервером');
    });

    test('коды 404 и 500 понятны без тела', () {
      expect(
        apiErrorText(null, statusCode: 404),
        'Запись не найдена на сервере',
      );
      expect(apiErrorText(null, statusCode: 503), 'Ошибка на сервере (503)');
    });
    test('ключ error — текст как есть', () {
      expect(
        apiErrorText(<String, dynamic>{'error': 'Недостаточно прав'}),
        'Недостаточно прав',
      );
    });
  });
}