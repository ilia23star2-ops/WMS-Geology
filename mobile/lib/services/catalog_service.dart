/// Сервис справочников (c-7b-full, c-7f, c-7c, c-7-offline-catalog).
///
/// Онлайн: запрос к API (с пагинацией), сохраняем страницы в кэш,
/// возвращаем результат.
/// Офлайн (`ApiException.isNetworkError == true`): читаем из кэша
/// (`CatalogDao`), возвращаем.
///
/// `*Named` — topology (`Room`, `Rack`, `Section`, `Tier`, `Cell`) как
/// `NamedCatalog {id, label}`.
/// Типизированные (`Site`, `ResearchType`, `Laboratory`, `ContainerType`) —
/// как раньше.
///
/// `parentId` (для `fetchRacks` / `fetchSections` / `fetchTiers` /
/// `fetchCells`) — при онлайн-фетче сохраняем его явно, чтобы офлайн
/// `getByParent` работал даже если в JSON сервер не вернул поле-родителя.
library;

import '../db/catalog_dao.dart';
import '../models/catalog.dart';
import 'api_client.dart';

typedef SaveCatalog = Future<void> Function(
  String kind,
  List<Map<String, dynamic>> items, {
  int? parentId,
});
typedef GetCatalog = Future<List<Map<String, dynamic>>> Function(String kind);
typedef GetCatalogByParent = Future<List<Map<String, dynamic>>> Function(
  String kind,
  int parentId,
);

class CatalogService {
  CatalogService(
    this._client, {
    SaveCatalog? saveCatalog,
    GetCatalog? getCatalog,
    GetCatalogByParent? getCatalogByParent,
  }) : _saveCatalog = saveCatalog ?? _defaultSave,
       _getCatalog = getCatalog ?? CatalogDao.getAll,
       _getByParent = getCatalogByParent ?? CatalogDao.getByParent;

  final ApiClient _client;
  final SaveCatalog _saveCatalog;
  final GetCatalog _getCatalog;
  final GetCatalogByParent _getByParent;

  static Future<void> _defaultSave(
    String kind,
    List<Map<String, dynamic>> items, {
    int? parentId,
  }) {
    return CatalogDao.saveAll(kind, items, parentId: parentId);
  }

  // ----- Типизированные справочники -----

  Future<List<Site>> fetchSites() {
    return _fetchTypedWithCache('/sites/', 'site', Site.fromJson);
  }

  Future<List<ResearchType>> fetchResearchTypes() {
    return _fetchTypedWithCache(
      '/research-types/',
      'research_type',
      ResearchType.fromJson,
    );
  }

  Future<List<ContainerType>> fetchContainerTypes() {
    return _fetchTypedWithCache(
      '/storage/container-types/',
      'container_type',
      ContainerType.fromJson,
    );
  }

  Future<List<Laboratory>> fetchLaboratories() {
    return _fetchTypedWithCache(
      '/laboratories/',
      'laboratory',
      Laboratory.fromJson,
    );
  }

  // ----- Каскад размещения (c-7c) -----

  Future<List<NamedCatalog>> fetchRooms() {
    return _fetchNamedWithCache('/storage/rooms/', 'room');
  }

  Future<List<NamedCatalog>> fetchRacks(int roomId) {
    return _fetchNamedWithCache(
      '/storage/racks/',
      'rack',
      query: {'room_id': roomId},
      parentId: roomId,
    );
  }

  Future<List<NamedCatalog>> fetchSections(int rackId) {
    return _fetchNamedWithCache(
      '/storage/sections/',
      'section',
      query: {'rack_id': rackId},
      parentId: rackId,
    );
  }

  Future<List<NamedCatalog>> fetchTiers(int sectionId) {
    return _fetchNamedWithCache(
      '/storage/tiers/',
      'tier',
      query: {'section_id': sectionId},
      parentId: sectionId,
    );
  }

  Future<List<NamedCatalog>> fetchCells(int tierId) {
    return _fetchNamedWithCache(
      '/storage/cells/',
      'cell',
      query: {'tier_id': tierId},
      parentId: tierId,
    );
  }

  // ----- Внутреннее: онлайн + кэш + fallback -----

  Future<List<NamedCatalog>> _fetchNamedWithCache(
    String path,
    String kind, {
    Map<String, dynamic>? query,
    int? parentId,
  }) async {
    try {
      final items = await _fetchAllPages(path, query);
      await _saveCatalog(kind, items, parentId: parentId);
      return items.map(NamedCatalog.fromJson).toList(growable: false);
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      final cached = parentId != null
          ? await _getByParent(kind, parentId)
          : await _getCatalog(kind);
      return cached.map(NamedCatalog.fromJson).toList(growable: false);
    }
  }

  Future<List<T>> _fetchTypedWithCache<T>(
    String path,
    String kind,
    T Function(Map<String, dynamic>) fromJson,
  ) async {
    try {
      final items = await _fetchAllPages(path, null);
      await _saveCatalog(kind, items);
      return items.map(fromJson).toList(growable: false);
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      final cached = await _getCatalog(kind);
      return cached.map(fromJson).toList(growable: false);
    }
  }

  /// Все страницы по `?page=N`, пока `next != null`.
  Future<List<Map<String, dynamic>>> _fetchAllPages(
    String path,
    Map<String, dynamic>? query,
  ) async {
    final all = <Map<String, dynamic>>[];
    int page = 1;
    while (true) {
      final res = await _client.get<Map<String, dynamic>>(
        path,
        queryParameters: {...?query, 'page': page},
      );
      final data = res.data;
      if (data == null) break;
      final results =
          (data['results'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
          const <Map<String, dynamic>>[];
      if (results.isEmpty) break;
      all.addAll(results);
      if (data['next'] == null) break;
      page++;
    }
    return all;
  }
}
