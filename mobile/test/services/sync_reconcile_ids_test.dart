/// Тесты reconcile: отрицательные ID и PATCH тары (пачка sync-fix-2).
///
/// Баг: regex `(\d+)` не матчил negative ID офлайн-созданных сущностей,
/// а ветки для PATCH `/storage/containers/{id}/` не было вовсе. Итог —
/// `pending_sync` снимался, хотя операция ещё лежала в очереди.
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sync_queue_dao.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/sync_service.dart';

class _EmptyClient extends ApiClient {
  _EmptyClient() : super(dioOverride: Dio());

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: <String, dynamic>{'next': null, 'results': <dynamic>[]} as T,
    );
  }
}

SyncQueueItem _item(int id, String action, String endpoint) => SyncQueueItem(
  id: id,
  action: action,
  endpoint: endpoint,
  payload: const <String, dynamic>{},
  createdAt: '2026-11-24T10:00:0${id}Z',
);

void main() {
  test('reconcile: negative ID проб и тары остаются в keep', () async {
    Set<int>? keptSamples;
    Set<int>? keptContainers;

    final service = SyncService(
      _EmptyClient(),
      saveContainers: (_) async {},
      saveSamples: (_) async {},
      saveCatalog: (_, __) async {},
      saveHistory: (_, __) async {},
      appendHistory: (_, __) async {},
      getQueueItems: () async => <SyncQueueItem>[
        _item(1, 'PATCH', '/samples/-5/'),
        _item(2, 'POST', '/samples/9/dispose/'),
        _item(3, 'POST', '/storage/containers/-7/fill-samples/'),
      ],
      reconcileSamples: (ids) async {
        keptSamples = ids;
        return 0;
      },
      reconcileContainers: (ids) async {
        keptContainers = ids;
        return 0;
      },
    );

    await service.pullAll();

    expect(keptSamples, <int>{-5, 9});
    expect(keptContainers, <int>{-7});
  });

  test('reconcile: PATCH шапки тары keeps container id', () async {
    Set<int>? keptContainers;

    final service = SyncService(
      _EmptyClient(),
      saveContainers: (_) async {},
      saveSamples: (_) async {},
      saveCatalog: (_, __) async {},
      saveHistory: (_, __) async {},
      appendHistory: (_, __) async {},
      getQueueItems: () async => <SyncQueueItem>[
        _item(1, 'PATCH', '/storage/containers/12/'),
        _item(2, 'PATCH', '/storage/containers/-8/'),
      ],
      reconcileSamples: (_) async => 0,
      reconcileContainers: (ids) async {
        keptContainers = ids;
        return 0;
      },
    );

    await service.pullAll();

    expect(keptContainers, <int>{12, -8});
  });
}
