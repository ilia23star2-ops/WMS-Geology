/// Экран разметки зон на фото (6e-2c, 6e-2-fix…fix4).
///
/// Жесты как в телефоне: один палец — рисование зоны; щипок двумя —
/// zoom; два пальца вместе (без изменения расстояния) — pan.
/// Трансформация хранится как scale + offset (без Matrix4), поэтому
/// пересчёт координат прост: scene = (viewport - offset) / scale.
/// Новые зоны авторазграничиваются с существующими (зазор adaptive).
/// Подписи на фото убраны; легенда — чипы в цвет зоны.
library;

import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../models/ocr_session.dart';
import '../models/ocr_zone.dart';

class OcrZoneMarkingScreen extends StatefulWidget {
  final CellPhotos cell;
  final XFile photo;

  const OcrZoneMarkingScreen({
    super.key,
    required this.cell,
    required this.photo,
  });

  @override
  State<OcrZoneMarkingScreen> createState() => _OcrZoneMarkingScreenState();
}

class _OcrZoneMarkingScreenState extends State<OcrZoneMarkingScreen> {
  static const Map<String, Color> _colors = {
    OcrZoneTypes.workOrderCoded: Color(0xFF1E88E5),
    OcrZoneTypes.workOrderIncoming: Color(0xFF00897B),
    OcrZoneTypes.containerNumber: Color(0xFFFB8C00),
    OcrZoneTypes.researchType: Color(0xFF8E24AA),
    OcrZoneTypes.sample: Color(0xFF43A047),
    OcrZoneTypes.well: Color(0xFF6D4C41),
  };

  late List<OcrZoneMark> _zones;
  double _scale = 1;
  Offset _offset = Offset.zero;
  double _scaleStart = 1;
  Offset _focalSceneStart = Offset.zero;
  int _imageWidth = 0;
  int _imageHeight = 0;
  bool _error = false;
  bool _drawing = false;
  Offset? _dragStart;
  Offset? _dragCurrent;
  ImageStream? _stream;
  ImageStreamListener? _listener;

  @override
  void initState() {
    super.initState();
    _zones = List.of(widget.cell.zonesFor(widget.photo.path));
    _resolveSize();
  }

  @override
  void dispose() {
    if (_stream != null && _listener != null) {
      _stream!.removeListener(_listener!);
    }
    super.dispose();
  }

  /// Натуральный размер фото — без него пиксели оригинала не посчитать.
  void _resolveSize() {
    final stream = FileImage(File(widget.photo.path))
        .resolve(ImageConfiguration.empty);
    final listener = ImageStreamListener(
      (info, _) {
        if (!mounted) return;
        setState(() {
          _imageWidth = info.image.width;
          _imageHeight = info.image.height;
        });
      },
      onError: (e, st) {
        if (mounted) setState(() => _error = true);
      },
    );
    stream.addListener(listener);
    _stream = stream;
    _listener = listener;
  }

  Color _color(String type) => _colors[type] ?? Colors.blueGrey;

  /// Координаты viewport → координаты сцены (с учётом zoom/pan).
  Offset _toScene(Offset viewportPoint) => (viewportPoint - _offset) / _scale;

  void _dragTo(Offset viewportPoint, {bool start = false}) {
    final p = _toScene(viewportPoint);
    setState(() {
      if (start) _dragStart = p;
      _dragCurrent = p;
    });
  }

  Rect _dragRect() {
    final s = _dragStart!;
    final c = _dragCurrent!;
    return Rect.fromLTRB(
      math.min(s.dx, c.dx),
      math.min(s.dy, c.dy),
      math.max(s.dx, c.dx),
      math.max(s.dy, c.dy),
    );
  }

  /// Два пальца: zoom вокруг focal + pan. Порог 2% гасит дрожание
  /// расстояния между пальцами, чтобы pan не дёргал zoom.
  void _zoomPan(ScaleUpdateDetails d) {
    final raw = (d.scale - 1).abs() < 0.02
        ? _scaleStart
        : _scaleStart * d.scale;
    final newScale = raw.clamp(1.0, 6.0);
    setState(() {
      _scale = newScale;
      _offset = d.localFocalPoint - _focalSceneStart * newScale;
    });
  }

  Future<void> _finishDrag(ImageFrame frame) async {
    final s = _dragStart;
    final c = _dragCurrent;
    setState(() {
      _dragStart = null;
      _dragCurrent = null;
    });
    if (s == null || c == null) return;

    final left = frame.toNormalizedX(math.min(s.dx, c.dx));
    final top = frame.toNormalizedY(math.min(s.dy, c.dy));
    final right = frame.toNormalizedX(math.max(s.dx, c.dx));
    final bottom = frame.toNormalizedY(math.max(s.dy, c.dy));
    final w = right - left;
    final h = bottom - top;
    // Тап / микродвижение — не зона.
    if (w < 0.01 || h < 0.01) return;

    final type = await showDialog<String>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Тип зоны'),
        children: [
          for (final t in OcrZoneTypes.uiOrder)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(ctx, t),
              child: Row(
                children: [
                  Container(width: 12, height: 12, color: _color(t)),
                  const SizedBox(width: 8),
                  Text(OcrZoneTypes.labels[t] ?? t),
                ],
              ),
            ),
        ],
      ),
    );
    if (type == null || !mounted) return;

    final zone = zoneFromNormalized(
      type: type,
      left: left,
      top: top,
      width: w,
      height: h,
      imageWidth: _imageWidth,
      imageHeight: _imageHeight,
    );
    if (zone == null) return;

    // 6e-2-fix4: авторазграничение с существующими зонами.
    final gap = math.max(4.0, math.min(_imageWidth, _imageHeight) * 0.004);
    final separated = separateZone(zone, _zones, gap: gap);
    if (separated == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Зона перекрыта существующей — выдели свободнее'),
        ),
      );
      return;
    }
    setState(() => _zones.add(separated));
  }

  void _save() {
    widget.cell.setZones(widget.photo.path, _zones);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Разметка зон'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            tooltip: 'Сбросить zoom',
            icon: const Icon(Icons.center_focus_strong),
            onPressed: () => setState(() {
              _scale = 1;
              _offset = Offset.zero;
            }),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                if (_error) {
                  return const Center(child: Text('Не удалось загрузить фото'));
                }
                if (_imageWidth == 0 || _imageHeight == 0) {
                  return const Center(child: CircularProgressIndicator());
                }
                final frame = ImageFrame.contain(
                  imageWidth: _imageWidth,
                  imageHeight: _imageHeight,
                  areaWidth: constraints.maxWidth,
                  areaHeight: constraints.maxHeight,
                );
                final scene = SizedBox(
                  width: constraints.maxWidth,
                  height: constraints.maxHeight,
                  child: Stack(
                    children: [
                      Positioned(
                        left: frame.offsetX,
                        top: frame.offsetY,
                        width: frame.displayWidth,
                        height: frame.displayHeight,
                        child: Image.file(
                          File(widget.photo.path),
                          fit: BoxFit.fill,
                        ),
                      ),
                      // Без подписей — только цветная рамка.
                      for (final z in _zones)
                        Positioned(
                          left: frame.toAreaX(z.x),
                          top: frame.toAreaY(z.y),
                          width: z.w * frame.scale,
                          height: z.h * frame.scale,
                          child: Container(
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: _color(z.type),
                                width: 2,
                              ),
                              color: _color(z.type).withValues(alpha: 0.12),
                            ),
                          ),
                        ),
                      if (_dragStart != null && _dragCurrent != null)
                        Positioned.fromRect(
                          rect: _dragRect(),
                          child: Container(
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: Colors.yellow,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                      Positioned(
                        left: 8,
                        right: 8,
                        bottom: 8,
                        child: Container(
                          color: Colors.black54,
                          padding: const EdgeInsets.all(6),
                          child: const Text(
                            'Один палец — зона; щипок — zoom; два пальца вместе — pan; прицел — сброс',
                            style: TextStyle(color: Colors.white, fontSize: 12),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onScaleStart: (d) {
                    if (d.pointerCount >= 2) {
                      _drawing = false;
                      _scaleStart = _scale;
                      _focalSceneStart = _toScene(d.localFocalPoint);
                      setState(() {
                        _dragStart = null;
                        _dragCurrent = null;
                      });
                    } else {
                      _drawing = true;
                      _dragTo(d.localFocalPoint, start: true);
                    }
                  },
                  onScaleUpdate: (d) {
                    if (d.pointerCount >= 2) {
                      _zoomPan(d);
                    } else if (_drawing) {
                      _dragTo(d.localFocalPoint);
                    }
                  },
                  onScaleEnd: (d) {
                    if (_drawing) {
                      _drawing = false;
                      _finishDrag(frame);
                    }
                  },
                  child: Transform.translate(
                    offset: _offset,
                    child: Transform.scale(
                      scale: _scale,
                      alignment: Alignment.topLeft,
                      child: scene,
                    ),
                  ),
                );
              },
            ),
          ),
          // Легенда — чипы в цвет зоны, крестик того же цвета.
          if (_zones.isNotEmpty)
            SizedBox(
              height: 56,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  for (var i = 0; i < _zones.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: InputChip(
                        label: Text(
                          OcrZoneTypes.labels[_zones[i].type] ?? _zones[i].type,
                          style: TextStyle(color: _color(_zones[i].type)),
                        ),
                        backgroundColor: _color(_zones[i].type)
                            .withValues(alpha: 0.12),
                        side: BorderSide(color: _color(_zones[i].type)),
                        onDeleted: () => setState(() => _zones.removeAt(i)),
                        deleteIconColor: _color(_zones[i].type),
                      ),
                    ),
                ],
              ),
            ),
          Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 8,
              bottom: 16 + MediaQuery.paddingOf(context).bottom,
            ),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                icon: const Icon(Icons.check),
                label: Text('Сохранить разметку (${_zones.length})'),
                onPressed: _save,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
