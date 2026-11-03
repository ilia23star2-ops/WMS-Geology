/// Сервис справочников (c-7b-full, c-7f, c-7c, c-7-offline-catalog,
/// c-8-catalog-create).
///
/// Онлайн: запрос к API (с пагинацией), сохраняем страницы в кэш.
/// Офлайн (`isNetworkError`): читаем из кэша.
///
/// c-8-catalog-create: `create(kind, payload)` — POST в справочник,
/// сохраняет результат в кэш. Офлайн — SnackBar (в UI), сервис бросает
/// `ApiException`. Полное офлайн-создание (маппинг local→server) —
/// отдельный заход `c-8-catalog-create-offline`.
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

/// Результат `create`: серверный id и сырой JSON.
class CreatedCatalogItem {
  const CreatedCatalogItem({required this.id, required this.raw});

  final int id;
  final Map<String, dynamic> raw;
}

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

  // ----- Создание справочника (c-8-catalog-create) -----

  /// POST в справочник. Только онлайн.
  ///
  /// `kind` — `site` / `research_type` / `laboratory` / `container_type`
  /// (для topology не поддерживаем — см. `c-8-catalog-create-topology`).
  ///
  /// После успешного POST результат сохраняется в кэш (`CatalogDao.saveAll`)
  /// — следующий `fetch*` вернёт его и онлайн, и офлайн.
  ///
  /// Офлайн (`isNetworkError`) — пробрасывает `ApiException`, UI показывает
  /// SnackBar «Требуется подключение к серверу».
  Future<CreatedCatalogItem> create(
    String kind,
    Map<String, dynamic> payload,
  ) async {
    final (path, saveKind) = _kindToEndpoint(kind);
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
