/// Тесты `SyncQueueDao` (c-2d-2): `remapInPlace` / `remapLocalRef`.
///
/// Тестируются чистые функции. Полный round-trip через SQLite — в
/// device-check (нет DI на `AppDatabase`).
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sync_queue_dao.dart';

void main() {
  group('SyncQueueDao.remapInPlace', () {
    test('container_id: маппится, если ключ есть', () {
      final p = <String, dynamic>{'container_id': -1};
      SyncQueueDao.remapInPlace(p, {-1: 42});
      expect(p['container_id'], 42);
    });

    test('container_id: не трогаем, если ключа нет', () {
      final p = <String, dynamic>{'container_id': -1};
      SyncQueueDao.remapInPlace(p, {-2: 43});
      expect(p['container_id'], -1);
    });

    test('container_ids: маппится каждый', () {
      final p = <String, dynamic>{
        'container_ids': [-1, -2, 5],
      };
      SyncQueueDao.remapInPlace(p, {-1: 42, -2: 43});
      expect(p['container_ids'], [42, 43, 5]);
    });

    test('containers[].id: маппится', () {
      final p = <String, dynamic>{
        'containers': [
          {'id': -1, 'container_type_id': 1},
          {'id': -2, 'container_type_id': 1},
          {'container_type_id': 1},
        ],
      };
      SyncQueueDao.remapInPlace(p, {-1: 42, -2: 43});
      final list = p['containers'] as List;
      expect((list[0] as Map)['id'], 42);
      expect((list[1] as Map)['id'], 43);
      expect((list[2] as Map).containsKey('id'), isFalse);
    });

    test('нет полей — payload не меняется', () {
      final p = <String, dynamic>{'status': 'IN_STORAGE'};
      final before = jsonEncode(p);
      SyncQueueDao.remapInPlace(p, {-1: 42});
      expect(jsonEncode(p), before);
    });

    test('пустой mapping — no-op', () {
      final p = <String, dynamic>{'container_id': -1};
      SyncQueueDao.remapInPlace(p, {});
      expect(p['container_id'], -1);
    });
  });

  group('SyncQueueDao.remapLocalRef', () {
    test('int-строка: маппится', () {
      expect(SyncQueueDao.remapLocalRef('-1', {-1: 42}), '42');
    });

    test('int-строка: нет в mapping — без изменений', () {
      expect(SyncQueueDao.remapLocalRef('-1', {-2: 43}), '-1');
    });

    test('JSON-массив: маппится', () {
      final out = SyncQueueDao.remapLocalRef('[-1,-2]', {-1: 42, -2: 43});
      expect(jsonDecode(out!), [42, 43]);
    });

    test('JSON-массив: часть без ключа — сохраняется', () {
      final out = SyncQueueDao.remapLocalRef('[-1,5]', {-1: 42});
      expect(jsonDecode(out!), [42, 5]);
    });

    test('null — null', () {
      expect(SyncQueueDao.remapLocalRef(null, {-1: 42}), isNull);
    });

    test('невалидный JSON — без изменений', () {
      expect(SyncQueueDao.remapLocalRef('not-a-json', {-1: 42}), 'not-a-json');
    });

    test('пустой mapping — без изменений', () {
      expect(SyncQueueDao.remapLocalRef('[-1]', {}), '[-1]');
    });
  });
}
