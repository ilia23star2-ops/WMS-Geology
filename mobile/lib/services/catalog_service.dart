/// Сервис справочников (c-7b-full, c-7f).
///
/// - `fetchSites` — `GET /sites/` (с `match_patterns`);
/// - `fetchResearchTypes` — `GET /research-types/`;
/// - `fetchContainerTypes` — `GET /storage/container-types/`;
/// - `fetchLaboratories` — `GET /laboratories/` (с `prefixes`).
///
/// Только первая страница (PAGE_SIZE=50), если больше — TODO.
library;

import '../models/catalog.dart';
import 'api_client.dart';

class CatalogService {
  CatalogService(this._client);

  final ApiClient _client;

  Future<List<Site>> fetchSites() async {
    final response = await _client.get<Map<String, dynamic>>('/sites/');
    final data = response.data;
    if (data == null) return const [];
    final results = data['results'] as List<dynamic>? ?? const [];
    return results
        .whereType<Map<String, dynamic>>()
        .map(Site.fromJson)
        .toList(growable: false);
  }

  Future<List<ResearchType>> fetchResearchTypes() async {
    final response = await _client.get<Map<String, dynamic>>(
      '/research-types/',
    );
    final data = response.data;
    if (data == null) return const [];
    final results = data['results'] as List<dynamic>? ?? const [];
    return results
        .whereType<Map<String, dynamic>>()
        .map(ResearchType.fromJson)
        .toList(growable: false);
  }

  Future<List<ContainerType>> fetchContainerTypes() async {
    final response = await _client.get<Map<String, dynamic>>(
      '/storage/container-types/',
    );
    final data = response.data;
    if (data == null) return const [];
    final results = data['results'] as List<dynamic>? ?? const [];
    return results
        .whereType<Map<String, dynamic>>()
        .map(ContainerType.fromJson)
        .toList(growable: false);
  }

  Future<List<Laboratory>> fetchLaboratories() async {
    final response = await _client.get<Map<String, dynamic>>('/laboratories/');
    final data = response.data;
    if (data == null) return const [];
    final results = data['results'] as List<dynamic>? ?? const [];
    return results
        .whereType<Map<String, dynamic>>()
        .map(Laboratory.fromJson)
        .toList(growable: false);
  }
}
