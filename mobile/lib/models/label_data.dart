/// Снимок данных для офлайн-рендера этикетки тары (c-7f).
///
/// Порт `_header_lines` + `_load_samples` + `_is_incoming` +
/// `_get_work_order_display` из `apps/labels/services/label_service.py`.
///
/// Строится из `Container` + список `Sample`. Ничего не знает про PDF.
///
/// Шапка этикетки (как на сервере):
///   `Уч:`     — участок
///   `Н/З:`    — зашифрованный Н/З (или `Н/З (вх.):` если входящий)
///   `Исл:`    — код типа исследования
///   `№:`      — номер тары
///
/// Таблица (как на сервере): `п/п | ☐ | <sample_number>`.
/// `☑` — если проба `SELECTED` (чёрная галочка).
library;

import 'container.dart';
import 'sample.dart';

class LabelSample {
  const LabelSample({required this.sampleNumber, required this.selected});

  final String sampleNumber;

  /// `true` — статус `Sample.SELECTED` (на сервере рисуется чёрная галочка).
  final bool selected;
}

class LabelData {
  const LabelData({
    required this.containerId,
    required this.containerNumber,
    required this.siteName,
    required this.workOrderLabel,
    required this.workOrderDisplay,
    required this.researchTypeLabel,
    required this.samples,
  });

  /// ID тары — для QR `WMSG:CONTAINER:<id>`.
  final int containerId;

  /// Номер тары. Пустая строка → `—` в шапке.
  final String containerNumber;

  /// Участок. Пустая строка → `—`.
  final String siteName;

  /// Метка `Н/З:` или `Н/З (вх.):`.
  final String workOrderLabel;

  /// Значение после метки:
  ///   - `TST0001` — без linked_order;
  ///   - `TST0001 / 02-Тест001` — с linked_order (порядок зависит от типа).
  ///   - пусто → `—`.
  final String workOrderDisplay;

  /// Код типа исследования (`ШЛ`, `ХА`, `ИЗ`).
  /// Fallback на имя (`Шлифы`) — если `research_type_code` не пришёл.
  final String researchTypeLabel;

  final List<LabelSample> samples;

  /// Снимок из `Container` + список проб.
  ///
  /// `Container` берём из ответа API / кэша — там есть draft-поля
  /// (`draftSiteName`, `draftResearchTypeName`, `draftWorkOrderCoded`,
  /// `draftWorkOrderIncoming`). Их достаточно для шапки.
  ///
  /// Пробы — из `SampleService.fetchByContainerId()` (кэш SQLite).
  factory LabelData.fromContainer(Container c, List<Sample> samples) {
    final hasIncoming = c.draftWorkOrderIncoming.isNotEmpty;
    final label = hasIncoming ? 'Н/З (вх.):' : 'Н/З:';

    // Как в `_get_work_order_display`: если входящий — сначала вх, потом тек.
    // Если только один — просто номер. Если оба пусты — `—`.
    final String woDisplay;
    if (c.draftWorkOrderIncoming.isNotEmpty &&
        c.draftWorkOrderCoded.isNotEmpty) {
      woDisplay = hasIncoming
          ? '${c.draftWorkOrderIncoming} / ${c.draftWorkOrderCoded}'
          : '${c.draftWorkOrderCoded} / ${c.draftWorkOrderIncoming}';
    } else if (c.draftWorkOrderCoded.isNotEmpty) {
      woDisplay = c.draftWorkOrderCoded;
    } else if (c.draftWorkOrderIncoming.isNotEmpty) {
      woDisplay = c.draftWorkOrderIncoming;
    } else {
      woDisplay = '—';
    }

    return LabelData(
      containerId: c.id,
      containerNumber: c.containerNumber ?? '',
      siteName: c.draftSiteName ?? '',
      workOrderLabel: label,
      workOrderDisplay: woDisplay,
      researchTypeLabel: c.draftResearchTypeName ?? '',
      samples: samples
          .map(
            (s) => LabelSample(
              sampleNumber: s.sampleNumber,
              selected: s.status == SampleStatus.selected,
            ),
          )
          .toList(growable: false),
    );
  }
}
