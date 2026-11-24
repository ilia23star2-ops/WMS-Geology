/// Тесты разбора серверного времени (пачка sync-fix-5b).
///
/// `/health/` отдаёт `time` — источник времени для инкрементального Pull.
/// Берём только tz-aware ISO 8601: naive-значения backend-фильтр
/// `updated_since` отвергает, а клиентские часы могут врать.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/sync_service.dart';

void main() {
  group('SyncService.parseServerTime', () {
    test('ISO с суффиксом Z → UTC', () {
      final dt = SyncService.parseServerTime(<String, dynamic>{
        'time': '2026-11-24T10:00:00Z',
      });
      expect(dt, isNotNull);
      expect(dt!.isUtc, isTrue);
      expect(dt.hour, 10);
    });

    test('ISO с +00:00 → UTC', () {
      final dt = SyncService.parseServerTime(<String, dynamic>{
        'time': '2026-11-24T10:00:00+00:00',
      });
      expect(dt, isNotNull);
      expect(dt!.isUtc, isTrue);
      expect(dt.hour, 10);
    });

    test('смещение приводится к UTC', () {
      final dt = SyncService.parseServerTime(<String, dynamic>{
        'time': '2026-11-24T13:00:00+03:00',
      });
      expect(dt, isNotNull);
      expect(dt!.isUtc, isTrue);
      expect(dt.hour, 10);
    });

    test('naive без таймзоны → null', () {
      final dt = SyncService.parseServerTime(<String, dynamic>{
        'time': '2026-11-24T10:00:00',
      });
      expect(dt, isNull);
    });

    test('нет поля, пусто или мусор → null', () {
      expect(SyncService.parseServerTime(null), isNull);
      expect(SyncService.parseServerTime(<String, dynamic>{}), isNull);
      expect(
        SyncService.parseServerTime(<String, dynamic>{'time': ''}),
        isNull,
      );
      expect(
        SyncService.parseServerTime(<String, dynamic>{'time': 'не дата'}),
        isNull,
      );
      expect(
        SyncService.parseServerTime(<String, dynamic>{'time': 12345}),
        isNull,
      );
    });
  });
}
