/// Тесты видимости ошибок маппинга (пачка sync-fix-4).
///
/// Баг: сбой связывания локальных ID с серверными глотался
/// (`catch (_) {}`), запись уже помечена отправленной — рассогласование
/// кэша происходило молча. Теперь проблема попадает в mappingErrors.
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/db/sync_queue_dao.dart';
import 'package:wms_geology_mobile/services/api_client.dart';
import 'package:wms_geology_mobile/services/sync_pusher.dart';

class _OkClient extends ApiClient {
  _OkClient() : super(dioOverride: Dio());

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: <String, dynamic>{'id': 77} as T,
    );
  }
}

SyncQueueItem _item() => SyncQueueItem(
  id: 1,
  action: 'POST',
  endpoint: '/sites/',
  payload: const <String, dynamic>{'code': 'TST'},
  createdAt: '2026-11-24T10:00:00Z',
  localRef: '-3',
);

SyncPusher _makePusher({required OnSuccess onSuccess}) {
  var reloaded = false;
  return SyncPusher(
    _OkClient(),
    getPendingItems: () async {
      if (reloaded) return <SyncQueueItem>[];
      reloaded = true;
      return <SyncQueueItem>[_item()];
    },
    markSynced: (_) async {},
    markError: (_, _) async {},
    resetErrors: () async {},
    onSuccess: onSuccess,
  );
}

void main() {
  test('сбой связывания попадает в mappingErrors, отправка counted', () async {
    final pusher = _makePusher(
      onSuccess: (_, _, _, _) async => throw StateError('пара не сошлась'),
    );

    final result = await pusher.pushAll();

    expect(result.sent, 1);
    expect(result.failed, 0);
    expect(result.mappingErrors, hasLength(1));
    expect(result.mappingErrors.first, contains('пара не сошлась'));
  });

  test('успешное связывание — mappingErrors пуст', () async {
    final pusher = _makePusher(onSuccess: (_, _, _, _) async {});

    final result = await pusher.pushAll();

    expect(result.sent, 1);
    expect(result.mappingErrors, isEmpty);
  });

  test('по умолчанию mappingErrors пустой список', () {
    const result = PushResult(sent: 0, failed: 0);
    expect(result.mappingErrors, isEmpty);
  });
}
