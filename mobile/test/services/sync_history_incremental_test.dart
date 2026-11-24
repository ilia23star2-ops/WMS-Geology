/// Тесты инкрементального Pull истории тары (пачка sync-fix-1).
///
/// Баг: `_pullAllHistory` с `updated_since` приносил только свежие записи,
/// а `saveAll` стирал всю историю тары в кэше. Теперь при инкрементальном
/// Pull используется `appendAll` (дополнение), при полном — `saveAll`.
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/sync_service.dart';

class _FakeClient extends ApiClient {
  _FakeClient() : super(dioOverride: Dio());

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    final req = RequestOptions(path: path);
    final page = queryParameters?['page'] as int? ?? 1;
    var body = <String, dynamic>{'next': null, 'results': <dynamic>[]};
    if (path == '/audit-logs/' && page == 1) {
      body = <String, dynamic>{
        'next': null,
        'results': <dynamic>[
          <String, dynamic>{
            'id': 501,
            'entity_id': 7,
            'created_at': '2026-11-24T10:00:00Z',
          },
        ],
      };
    }
    return Response<T>(requestOptions: req, statusCode: 200, data: body as T);
  }
}

SyncService _makeService({
  required List<int> replaced,
  required List<int> appended,
}) {
  return SyncService(
    _FakeClient(),
    saveContainers: (_) async {},
    saveSamples: (_) async {},
    saveCatalog: (_, _) async {},
    saveHistory: (id, _) async => replaced.add(id),
    appendHistory: (id, _) async => appended.add(id),
    getQueueItems: () async => [],
    reconcileSamples: (_) async => 0,
    reconcileContainers: (_) async => 0,
  );
}

void main() {
  test('инкрементальный Pull истории дополняет кэш, а не заменяет', () async {
    final replaced = <int>[];
    final appended = <int>[];
    final service = _makeService(replaced: replaced, appended: appended);

    await service.pullAll(updatedSince: DateTime.utc(2026, 11, 24, 9));

    expect(appended, <int>[7]);
    expect(replaced, isEmpty);
  });

  test('полный Pull истории заменяет кэш', () async {
    final replaced = <int>[];
    final appended = <int>[];
    final service = _makeService(replaced: replaced, appended: appended);

    await service.pullAll();

    expect(replaced, <int>[7]);
    expect(appended, isEmpty);
  });
}
