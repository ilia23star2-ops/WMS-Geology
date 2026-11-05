/// Тесты `SyncQueueDao` (c-2d-2, c-2d-2c, c-8-catalog-create-offline).
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

    // c-8-catalog-create-offline
    test('draft_site_id: маппится', () {
      final p = <String, dynamic>{'draft_site_id': -1000};
      SyncQueueDao.remapInPlace(p, {-1000: 100});
      expect(p['draft_site_id'], 100);
    });

    test('draft_site: маппится', () {
      final p = <String, dynamic>{'draft_site': -1000};
      SyncQueueDao.remapInPlace(p, {-1000: 100});
      expect(p['draft_site'], 100);
    });

    test('draft_research_type_id: маппится', () {
      final p = <String, dynamic>{'draft_research_type_id': -2000};
      SyncQueueDao.remapInPlace(p, {-2000: 200});
      expect(p['draft_research_type_id'], 200);
    });

    test('draft_research_type: маппится', () {
      final p = <String, dynamic>{'draft_research_type': -2000};
      SyncQueueDao.remapInPlace(p, {-2000: 200});
      expect(p['draft_research_type'], 200);
    });

    test('container_type_id: маппится', () {
      final p = <String, dynamic>{'container_type_id': -500};
      SyncQueueDao.remapInPlace(p, {-500: 500});
      expect(p['container_type_id'], 500);
    });

    test('container_type: маппится', () {
      final p = <String, dynamic>{'container_type': -500};
      SyncQueueDao.remapInPlace(p, {-500: 500});
      expect(p['container_type'], 500);
    });

    test('containers[].container_type_id: маппится', () {
      final p = <String, dynamic>{
        'containers': [
          {'container_type_id': -500},
          {'container_type_id': 5},
        ],
      };
      SyncQueueDao.remapInPlace(p, {-500: 500});
      final list = p['containers'] as List;
      expect((list[0] as Map)['container_type_id'], 500);
      expect((list[1] as Map)['container_type_id'], 5);
    });

    test('bulk-create payload: все draft-поля разом', () {
      final p = <String, dynamic>{
        'containers': [
          {'container_type_id': -500},
        ],
        'draft_site_id': -1000,
        'draft_research_type_id': -2000,
      };
      SyncQueueDao.remapInPlace(p, {-1000: 100, -2000: 200, -500: 500});
      expect(p['draft_site_id'], 100);
      expect(p['draft_research_type_id'], 200);
      expect(((p['containers'] as List)[0] as Map)['container_type_id'], 500);
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

  group('SyncQueueDao.remapEndpoint', () {
    test('negative fill-samples: маппится', () {
      expect(
        SyncQueueDao.remapEndpoint('/storage/containers/-1/fill-samples/', {
          -1: 42,
        }),
        '/storage/containers/42/fill-samples/',
      );
    });

    test('negative delete-URL: маппится', () {
      expect(
        SyncQueueDao.remapEndpoint('/storage/containers/-1/', {-1: 42}),
        '/storage/containers/42/',
      );
    });

    test('positive ID: не трогаем', () {
      expect(
        SyncQueueDao.remapEndpoint('/storage/containers/42/fill-samples/', {
          -1: 42,
        }),
        '/storage/containers/42/fill-samples/',
      );
    });

    test('bulk-create (без ID): не трогаем', () {
      expect(
        SyncQueueDao.remapEndpoint('/storage/containers/bulk-create/', {
          -1: 42,
        }),
        '/storage/containers/bulk-create/',
      );
    });

    test('bulk-place (без ID): не трогаем', () {
      expect(
        SyncQueueDao.remapEndpoint('/storage/containers/bulk-place/', {-1: 42}),
        '/storage/containers/bulk-place/',
      );
    });

    test('samples endpoint: не трогаем', () {
      expect(
        SyncQueueDao.remapEndpoint('/samples/-1/', {-1: 42}),
        '/samples/-1/',
      );
    });

    test('negative без mapping: не трогаем', () {
      expect(
        SyncQueueDao.remapEndpoint('/storage/containers/-1/fill-samples/', {
          -2: 43,
        }),
        '/storage/containers/-1/fill-samples/',
      );
    });

    test('пустой mapping — no-op', () {
      expect(
        SyncQueueDao.remapEndpoint('/storage/containers/-1/fill-samples/', {}),
        '/storage/containers/-1/fill-samples/',
      );
    });
  });
}
