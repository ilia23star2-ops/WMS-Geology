/// Модели справочников (c-7b-full, c-7f, c-7c).
///
/// - `Site` — участки (`GET /sites/`). Поле `matchPatterns` — для парсера
///   диапазонов.
/// - `ResearchType` — типы исследования (`GET /research-types/`).
/// - `ContainerType` — типы тары (`GET /storage/container-types/`).
/// - `Laboratory` — лаборатории (`GET /laboratories/`). Поле `prefixes` —
///   для парсера диапазонов.
/// - `NamedCatalog` — универсальный `{id, label}` для каскада размещения
///   тары (`c-7c`): Room / Rack / Section / Tier / Cell.
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

/// Универсальный справочник `{id, label}` для каскада размещения тары (c-7c).
///
/// Используется для `Room`, `Rack`, `Section`, `Tier`, `Cell`. Все пять
/// сущностей в API различаются по полям, но для каскада нужны только
/// `id` и человекочитаемая метка. Если завтра понадобится больше (cell_type,
/// точный full_address и т.п.) — вынесем отдельный класс для Cell.
///
/// Фолбэк полей: `name` (+`code` префикс) → `code` → `full_address` →
/// `number` → `#id`.
class NamedCatalog {
  const NamedCatalog({required this.id, required this.label});

  final int id;
  final String label;

  factory NamedCatalog.fromJson(Map<String, dynamic> json) {
    final id = json['id'] as int;
    final name = json['name'] as String?;
    final code = json['code'] as String?;
    final fullAddress = json['full_address'] as String?;
    final number = json['number']?.toString();

    final String label;
    if (name != null && name.isNotEmpty && code != null && code.isNotEmpty) {
      label = '$code — $name';
    } else if (name != null && name.isNotEmpty) {
      label = name;
    } else if (code != null && code.isNotEmpty) {
      label = code;
    } else if (fullAddress != null && fullAddress.isNotEmpty) {
      label = fullAddress;
    } else if (number != null && number.isNotEmpty) {
      label = number;
    } else {
      label = '#$id';
    }
    return NamedCatalog(id: id, label: label);
  }

  @override
  bool operator ==(Object other) => other is NamedCatalog && other.id == id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'NamedCatalog(id: $id, label: $label)';
}
