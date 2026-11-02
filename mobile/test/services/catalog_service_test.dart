/// Тесты `CatalogService` (c-7-offline-catalog).
///
/// Проверяем:
/// - `catalogParentId` — извлечение ID родителя из JSON (несколько имён полей);
/// - онлайн-фетч: API → save → результат;
/// - офлайн-фетч: network error → cache (типизированные и каскад);
/// - офлайн `fetchRacks(roomId)` → cache по родителю.
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/catalog_dao.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/catalog_service.dart';

class _MockApi extends Fake implements ApiClient {
  bool offline = false;
  final Map<String, List<Map<String, dynamic>>> pages = {};
  final List<String> calls = [];

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    calls.add(path);
    if (offline) {
      throw ApiException(message: 'нет сети', isNetworkError: true);
    }
    final key = pages.keys.firstWhere(
      (k) => path.startsWith(k),
      orElse: () => '',
    );
    final results = pages[key] ?? const <Map<String, dynamic>>[];
    final data = <String, dynamic>{
      'count': results.length,
      'next': null,
      'previous': null,
      'results': results,
    };
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: data as T,
    );
  }
}

class _Cache {
  final Map<String, List<Map<String, dynamic>>> byKind = {};
  final Map<String, List<Map<String, dynamic>>> byParent = {};
  final List<String> savedKinds = [];
}

void main() {
  group('catalogParentId', () {
    test('rack: поле room', () {
      expect(catalogParentId('rack', {'id': 1, 'room': 7}), 7);
    });

    test('rack: поле room_id (fallback)', () {
      expect(catalogParentId('rack', {'id': 1, 'room_id': 9}), 9);
    });

    test('cell: поле tier_id', () {
      expect(catalogParentId('cell', {'id': 5, 'tier_id': 3}), 3);
    });

    test('room: null', () {
      expect(catalogParentId('room', {'id': 1, 'name': 'Ком 1'}), isNull);
    });

    test('site: null', () {
      expect(catalogParentId('site', {'id': 1, 'code': 'TST'}), isNull);
    });
  });

  group('CatalogService', () {
    late _MockApi api;
    late _Cache cache;

    setUp(() {
      api = _MockApi();
      cache = _Cache();
    });

    CatalogService createService() {
      return CatalogService(
        api,
        saveCatalog: (kind, items, {parentId}) async {
          cache.savedKinds.add(kind);
          if (parentId != null) {
            cache.byParent['$kind:$parentId'] = items;
          } else {
            cache.byKind[kind] = items;
          }
        },
        getCatalog: (kind) async => cache.byKind[kind] ?? const [],
        getCatalogByParent: (kind, parentId) async =>
            cache.byParent['$kind:$parentId'] ?? const [],
      );
    }

    test('fetchRooms онлайн: API → save → результат', () async {
      api.pages['/storage/rooms/'] = [
        {'id': 1, 'code': 'К1', 'name': 'Комната 1'},
        {'id': 2, 'name': 'Комната 2'},
      ];
      final service = createService();
      final rooms = await service.fetchRooms();

      expect(rooms.length, 2);
      expect(rooms[0].id, 1);
      expect(rooms[0].label, 'К1 — Комната 1');
      expect(rooms[1].label, 'Комната 2');
      expect(cache.savedKinds, contains('room'));
    });

    test('fetchRooms офлайн: cache', () async {
      cache.byKind['room'] = [
        {'id': 1, 'code': 'К1', 'name': 'Комната 1'},
      ];
      api.offline = true;
      final service = createService();
      final rooms = await service.fetchRooms();

      expect(rooms.length, 1);
      expect(rooms.first.id, 1);
      expect(rooms.first.label, 'К1 — Комната 1');
    });

    test('fetchSites офлайн: cache → typed Site', () async {
      cache.byKind['site'] = [
        {
          'id': 5,
          'code': 'TST',
          'name': 'Тестовый',
          'match_patterns': ['T'],
        },
      ];
      api.offline = true;
      final service = createService();
      final sites = await service.fetchSites();

      expect(sites.length, 1);
      expect(sites.first.id, 5);
      expect(sites.first.code, 'TST');
      expect(sites.first.matchPatterns, ['T']);
    });

    test('fetchRacks офлайн: cache по родителю', () async {
      cache.byParent['rack:7'] = [
        {'id': 11, 'code': 'A', 'name': 'Стеллаж A'},
        {'id': 12, 'code': 'B', 'name': 'Стеллаж B'},
      ];
      api.offline = true;
      final service = createService();
      final racks = await service.fetchRacks(7);

      expect(racks.length, 2);
      expect(racks.map((r) => r.id).toList(), [11, 12]);
    });

    test('fetchCells офлайн: пустой cache → пусто', () async {
      api.offline = true;
      final service = createService();
      final cells = await service.fetchCells(999);
      expect(cells, isEmpty);
    });

    test('fetchRooms онлайн: сетевая ошибка → fallback на cache', () async {
      api.pages['/storage/rooms/'] = [
        {'id': 1, 'code': 'К1', 'name': 'Комната 1'},
      ];
      final service = createService();
      // Первый вызов — онлайн, кладёт в cache.
      await service.fetchRooms();
      // Теперь офлайн — должен вернуть из cache.
      api.offline = true;
      final rooms = await service.fetchRooms();
      expect(rooms.length, 1);
      expect(rooms.first.id, 1);
    });
  });
}
