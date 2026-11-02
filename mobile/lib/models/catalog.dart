/// Модели справочников (c-7b-full, c-7f).
///
/// - `Site` — участки (`GET /sites/`). Поле `matchPatterns` — для парсера
///   диапазонов.
/// - `ResearchType` — типы исследования (`GET /research-types/`).
/// - `ContainerType` — типы тары (`GET /storage/container-types/`).
/// - `Laboratory` — лаборатории (`GET /laboratories/`). Поле `prefixes` —
///   для парсера диапазонов.
library;

class Site {
  const Site({
    required this.id,
    required this.code,
    required this.name,
    this.matchPatterns = const [],
  });

  final int id;
  final String code;
  final String name;
  final List<String> matchPatterns;

  String get label => code.isEmpty ? name : '$code — $name';

  factory Site.fromJson(Map<String, dynamic> json) {
    return Site(
      id: json['id'] as int,
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      matchPatterns: (json['match_patterns'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(growable: false),
    );
  }
}

class ResearchType {
  const ResearchType({
    required this.id,
    required this.code,
    required this.name,
  });

  final int id;
  final String code;
  final String name;

  String get label => code.isEmpty ? name : '$code — $name';

  factory ResearchType.fromJson(Map<String, dynamic> json) {
    return ResearchType(
      id: json['id'] as int,
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
    );
  }
}

class ContainerType {
  const ContainerType({
    required this.id,
    required this.name,
    required this.laboratoryName,
  });

  final int id;
  final String name;
  final String? laboratoryName;

  String get label => laboratoryName != null && laboratoryName!.isNotEmpty
      ? '$name ($laboratoryName)'
      : name;

  factory ContainerType.fromJson(Map<String, dynamic> json) {
    return ContainerType(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      laboratoryName: json['laboratory_name'] as String?,
    );
  }
}

class Laboratory {
  const Laboratory({
    required this.id,
    required this.code,
    required this.name,
    this.prefixes = const [],
  });

  final int id;
  final String code;
  final String name;
  final List<String> prefixes;

  String get label => code.isEmpty ? name : '$code — $name';

  factory Laboratory.fromJson(Map<String, dynamic> json) {
    return Laboratory(
      id: json['id'] as int,
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      prefixes: (json['prefixes'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(growable: false),
    );
  }
}
