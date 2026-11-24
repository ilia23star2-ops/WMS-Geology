/// Тесты перемаппинга parent-ссылок топологии (topology-offline-1).
///
/// Стеллаж, созданный офлайн со ссылкой на отрицательную комнату,
/// обязан уехать на сервер с серверным ID комнаты — иначе 400/404,
/// ровно класс бага «тип тары #2 не найден».
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sync_queue_dao.dart';
import 'package:wms_geology_mobile/services/sync_pusher.dart';

void main() {
  group('remapInPlace: топология', () {
    test('переписывает parent-ссылки room/rack/section/tier', () {
      final payload = <String, dynamic>{
        'room': -1000,
        'rack': -1001,
        'section': -1002,
        'tier': -1003,
        'code': 'K1',
      };
      SyncQueueDao.remapInPlace(payload, {
        -1000: 10,
        -1001: 20,
        -1002: 30,
        -1003: 40,
      });
      expect(payload['room'], 10);
      expect(payload['rack'], 20);
      expect(payload['section'], 30);
      expect(payload['tier'], 40);
      expect(payload['code'], 'K1');
    });

    test('не трогает значения вне mapping', () {
      final payload = <String, dynamic>{'room': 5, 'tier': -7};
      SyncQueueDao.remapInPlace(payload, {-7: 77});
      expect(payload['room'], 5);
      expect(payload['tier'], 77);
    });
  });

  group('catalogKindForEndpoint: топология', () {
    test('распознаёт создание топологии как справочник', () {
      expect(SyncPusher.catalogKindForEndpoint('/storage/rooms/'), 'room');
      expect(SyncPusher.catalogKindForEndpoint('/storage/racks/'), 'rack');
      expect(
        SyncPusher.catalogKindForEndpoint('/storage/sections/'),
        'section',
      );
      expect(SyncPusher.catalogKindForEndpoint('/storage/tiers/'), 'tier');
      expect(SyncPusher.catalogKindForEndpoint('/storage/cells/'), 'cell');
    });

    test('не-справочник возвращает null', () {
      expect(SyncPusher.catalogKindForEndpoint('/storage/containers/'), isNull);
    });
  });
}
