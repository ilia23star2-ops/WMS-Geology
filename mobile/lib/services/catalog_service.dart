/// Сервис справочников (c-7b-full, c-7f, c-7c, c-7-offline-catalog,
/// c-8-catalog-create, c-8-catalog-create-offline).
///
/// Онлайн: запрос к API (с пагинацией), сохраняем страницы в кэш.
/// Офлайн (`isNetworkError`): читаем из кэша.
///
/// c-8-catalog-create-offline: `create` при `isNetworkError` создаёт
/// локально (negative ID) + `sync_queue` + возвращает
/// `CreatedCatalogItem(queued: true)`. `SyncPusher` во втором заходе
/// (`c-8-catalog-create-offline-b`) перемапит negative → server и
/// обновит зависимые операции.
library;

import '../db/catalog_dao.dart';
import '../db/sync_queue_dao.dart';
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
typedef SaveLocalOffline = Future<int> Function(
  String kind,
  Map<String, dynamic> payload,
);
typedef Enqueue = Future<void> Function({
  required String action,
  required String endpoint,
  required Map<String, dynamic> payload,
  String? localRef,
});

/// Результат `create`.
///
/// `queued = false` — серверный ID, `raw` — ответ сервера.
/// `queued = true` — negative ID, `raw` — локальный payload + `id`.
class CreatedCatalogItem {
  const CreatedCatalogItem({
    required this.id,
    required this.raw,
    this.queued = false,
  });

  final int id;
  final Map<String, dynamic> raw;
  final bool queued;
}

class CatalogService {
  CatalogService(
    this._client, {
    SaveCatalog? saveCatalog,
    GetCatalog? getCatalog,
    GetCatalogByParent? getCatalogByParent,
    SaveLocalOffline? saveLocalOffline,
    Enqueue? enqueue,
  }) : _saveCatalog = saveCatalog ?? _defaultSave,
       _getCatalog = getCatalog ?? CatalogDao.getAll,
       _getByParent = getCatalogByParent ?? CatalogDao.getByParent,
       _saveLocalOffline = saveLocalOffline ?? CatalogDao.saveLocalOffline,
       _enqueue = enqueue ?? _defaultEnqueue;

  final ApiClient _client;
  final SaveCatalog _saveCatalog;
  final GetCatalog _getCatalog;
  final GetCatalogByParent _getByParent;
  final SaveLocalOffline _saveLocalOffline;
  final Enqueue _enqueue;

  static Future<void> _defaultSave(
    String kind,
    List<Map<String, dynamic>> items, {
    int? parentId,
  }) {
    return CatalogDao.saveAll(kind, items, parentId: parentId);
  }

  static Future<void> _defaultEnqueue({
    required String action,
    required String endpoint,
    required Map<String, dynamic> payload,
    String? localRef,
  }) {
    return SyncQueueDao.enqueue(
      action: action,
      endpoint: endpoint,
      payload: payload,
      localRef: localRef,
    );
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

  // ----- Создание справочника (c-8-catalog-create + offline) -----

  /// POST в справочник.
  ///
  /// `kind` — `site` / `research_type` / `laboratory` / `container_type`
  /// (топология — отдельный заход).
  ///
  /// Онлайн — POST, сохраняем ответ в кэш, `CreatedCatalogItem(queued: false)`.
  /// Офлайн (`isNetworkError`) — `CatalogDao.saveLocalOffline` (negative ID)
  /// + `sync_queue` (POST, `localRef: negativeId`),
  /// `CreatedCatalogItem(queued: true)`.
  Future<CreatedCatalogItem> create(
    String kind,
    Map<String, dynamic> payload,
  ) async {
    final (path, saveKind) = _kindToEndpoint(kind);
    try {
      final response = await _client.post<Map<String, dynamic>>(
        path,
        data: payload,
      );
      final data = response.data;
      if (data == null || data['id'] is! int) {
        throw ApiException(
          message: 'Пустой ответ при создании справочника.',
          statusCode: response.statusCode,
        );
      }
      try {
        await _saveCatalog(saveKind, [data]);
      } catch (_) {
        // Кэш не критичен.
      }
      return CreatedCatalogItem(id: data['id'] as int, raw: data);
    } on ApiException catch (e) {
      if (!e.isNetworkError) rethrow;
      return _createOffline(path, saveKind, payload);
    } catch (_) {
      // DioException/Timeout — всё, что не ApiException, считаем сетью.
      return _createOffline(path, saveKind, payload);
    }
  }

  Future<CreatedCatalogItem> _createOffline(
    String path,
    String saveKind,
    Map<String, dynamic> payload,
  ) async {
    final negativeId = await _saveLocalOffline(saveKind, payload);
    await _enqueue(
      action: 'POST',
      endpoint: path,
      payload: payload,
      localRef: '$negativeId',
    );
    return CreatedCatalogItem(
      id: negativeId,
      raw: {...payload, 'id': negativeId, '_pending_sync': true},
      queued: true,
    );
  }

  /// `kind` → `(POST endpoint, kind для CatalogDao.saveAll)`.
  (String, String) _kindToEndpoint(String kind) {
    switch (kind) {
      case 'site':
        return ('/sites/', 'site');
      case 'research_type':
        return ('/research-types/', 'research_type');
      case 'laboratory':
        return ('/laboratories/', 'laboratory');
      case 'container_type':
        return ('/storage/container-types/', 'container_type');
      default:
        throw ArgumentError(
          'create: kind "$kind" не поддерживается (только site/research_type/'
          'laboratory/container_type)',
        );
    }
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
