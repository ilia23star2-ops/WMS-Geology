/// Тесты записи снимков при Pull (пачка conflict-detect-3).
///
/// Снимок — точка отсчёта для слияния: без него нельзя понять, кто менял
/// поле, и любой разнобой пришлось бы отдавать человеку.
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/sync_service.dart';

class _FakeClient extends ApiClient {
  _FakeClient({this.empty = false}) : super(dioOverride: Dio());

  final bool empty;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    final req = RequestOptions(path: path);
    var results = <dynamic>[];
    if (!empty) {
      if (path == '/storage/containers/') {
        results = <dynamic>[
          <String, dynamic>{
            'id': 42,
            'updated_at': '2026-11-24T10:00:00Z',
            'status': 'ACTIVE',
          },
        ];
      } else if (path == '/samples/') {
        results = <dynamic>[
          <String, dynamic>{'id': 7, 'container_id': 42},
        ];
      } else if (path == '/sites/') {
        results = <dynamic>[
          <String, dynamic>{'id': 3, 'code': 'TST'},
        ];
      }
    }
    return Response<T>(
      requestOptions: req,
      statusCode: 200,
      data: <String, dynamic>{'next': null, 'results': results} as T,
    );
  }
}

SyncService _make({required List<String> baseCalls, bool empty = false}) {
  return SyncService(
    _FakeClient(empty: empty),
    saveContainers: (_) async {},
    saveSamples: (_) async {},
    saveCatalog: (_, __) async {},
    pruneCatalog: (_, __) async => 0,
    saveHistory: (_, __) async {},
    appendHistory: (_, __) async {},
    saveBase: (entity, items) async => baseCalls.add(entity),
    getQueueItems: () async => [],
    reconcileSamples: (_) async => 0,
    reconcileContainers: (_) async => 0,
  );
}

void main() {
  test('снимки тары пишутся при Pull', () async {
    final calls = <String>[];
    await _make(baseCalls: calls).pullAll();
    expect(calls, contains('container'));
  });

  test('снимки проб пишутся при Pull', () async {
    final calls = <String>[];
    await _make(baseCalls: calls).pullAll();
    expect(calls, contains('sample'));
  });

  test('снимки справочников пишутся по kind', () async {
    final calls = <String>[];
    await _make(baseCalls: calls).pullAll();
    expect(calls, contains('site'));
  });

  test('пустой ответ — снимки не пишутся', () async {
    final calls = <String>[];
    await _make(baseCalls: calls, empty: true).pullAll();
    expect(calls, isEmpty);
  });
test('prune получает ID всех страниц справочника', () async {
  final pruned = <String, List<int>>{};
  final service = SyncService(
    _FakeClient(),
    saveContainers: (_) async {},
    saveSamples: (_) async {},
    saveCatalog: (_, __) async {},
    saveHistory: (_, __) async {},
    appendHistory: (_, __) async {},
    saveBase: (_, __) async {},
    getQueueItems: () async => [],
    reconcileSamples: (_) async => 0,
    reconcileContainers: (_) async => 0,
    pruneCatalog: (kind, ids) async {
      pruned[kind] = ids.toList();
      return 0;
    },
  );
  await service.pullAll();
  expect(pruned['site'], <int>[3]);
});

test('пустой справочник — prune не вызывается', () async {
  final pruned = <String>[];
  final service = SyncService(
    _FakeClient(empty: true),
    saveContainers: (_) async {},
    saveSamples: (_) async {},
    saveCatalog: (_, __) async {},
    saveHistory: (_, __) async {},
    appendHistory: (_, __) async {},
    saveBase: (_, __) async {},
    getQueueItems: () async => [],
    reconcileSamples: (_) async => 0,
    reconcileContainers: (_) async => 0,
    pruneCatalog: (kind, ids) async {
      pruned.add(kind);
      return 0;
    },
  );
  await service.pullAll();
  expect(pruned, isEmpty);
});

}
