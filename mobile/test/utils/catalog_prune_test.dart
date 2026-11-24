/// Тесты отбора устаревших записей справочника (catalog-prune-15a).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/utils/catalog_prune.dart';

void main() {
  group('staleCatalogIds', () {
    test('исчезнувшие с сервера ID отбираются', () {
      final stale = staleCatalogIds(
        localIds: <int>[6, 2, 5, 4, 13, 3, 1, 7, 9, 8],
        serverIds: <int>[13, 3, 1, 7, 9, 8],
      );
      expect(stale, <int>{6, 2, 5, 4});
    });

    test('актуальные записи не трогаются', () {
      final stale = staleCatalogIds(
        localIds: <int>[1, 3],
        serverIds: <int>[1, 3, 7],
      );
      expect(stale, isEmpty);
    });

    test('офлайн-созданные (отрицательные) сохраняются всегда', () {
      final stale = staleCatalogIds(
        localIds: <int>[-1794460864455, -5, 2],
        serverIds: <int>[1, 3],
      );
      expect(stale, <int>{2});
    });

    test('пустой ответ сервера — ничего не удаляем', () {
      final stale = staleCatalogIds(
        localIds: <int>[1, 2, 3],
        serverIds: <int>[],
      );
      expect(stale, isEmpty);
    });

    test('пустой кэш — удалять нечего', () {
      final stale = staleCatalogIds(localIds: <int>[], serverIds: <int>[1, 3]);
      expect(stale, isEmpty);
    });

    test('дубли в кэше не плодят дублей в результате', () {
      final stale = staleCatalogIds(
        localIds: <int>[2, 2, 4, 4],
        serverIds: <int>[1],
      );
      expect(stale, <int>{2, 4});
    });
  });
}
