/// Тесты маппинга ссылок на справочники в очереди (пачка sync-fix-6).
///
/// Баг: офлайн-заполнение тары кладёт в payload `site_id` и
/// `research_type_id` (без префикса draft_), а remapInPlace их не знал.
/// Если участок/ТИ созданы офлайн (отрицательный ID), после push
/// на сервер уходил отрицательный ID → 400, пробы не создавались.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sync_queue_dao.dart';

void main() {
  group('remapInPlace: ссылки на справочники', () {
    test('site_id отрицательный → серверный', () {
      final payload = <String, dynamic>{'site_id': -3};
      SyncQueueDao.remapInPlace(payload, <int, int>{-3: 41});
      expect(payload['site_id'], 41);
    });

    test('research_type_id отрицательный → серверный', () {
      final payload = <String, dynamic>{'research_type_id': -4};
      SyncQueueDao.remapInPlace(payload, <int, int>{-4: 42});
      expect(payload['research_type_id'], 42);
    });

    test('офлайн-fill: тара, участок и ТИ маппятся вместе', () {
      final payload = <String, dynamic>{
        'container_id': -7,
        'site_id': -3,
        'research_type_id': -4,
        'sample_groups': <dynamic>[],
      };
      SyncQueueDao.remapInPlace(payload, <int, int>{-7: 70, -3: 41, -4: 42});
      expect(payload['container_id'], 70);
      expect(payload['site_id'], 41);
      expect(payload['research_type_id'], 42);
    });

    test('положительные ID не трогаем', () {
      final payload = <String, dynamic>{'site_id': 5, 'research_type_id': 6};
      SyncQueueDao.remapInPlace(payload, <int, int>{-3: 41});
      expect(payload['site_id'], 5);
      expect(payload['research_type_id'], 6);
    });

    test('draft-поля продолжают маппиться (регресс)', () {
      final payload = <String, dynamic>{
        'draft_site_id': -3,
        'draft_research_type_id': -4,
      };
      SyncQueueDao.remapInPlace(payload, <int, int>{-3: 41, -4: 42});
      expect(payload['draft_site_id'], 41);
      expect(payload['draft_research_type_id'], 42);
    });
  });
}
