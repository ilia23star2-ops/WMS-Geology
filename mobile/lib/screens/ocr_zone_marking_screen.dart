/// Экран разметки зон на фото (6e-2c, 6e-2-fix).
///
/// Режимы: «Рисовать» (drag → прямоугольник → тип) и «Двигать»
/// (pinch-zoom + pan через InteractiveViewer). Координаты рисования
/// пересчитываются через обратную матрицу трансформации, поэтому
/// разметка точна при любом zoom.
/// 6e-2-fix: подписи на фото убраны; легенда — чипы в цвет зоны.
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
  final TransformationController _tc = TransformationController();
  int _imageWidth = 0;
  int _imageHeight = 0;
  bool _error = false;
  bool _drawMode = true;
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
    _tc.dispose();
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
  Offset? _toScene(Offset viewportPoint) {
    final inv = Matrix4.tryInvert(_tc.value);
    if (inv == null) return null;
    return MatrixUtils.transformPoint(inv, viewportPoint);
  }

  void _dragTo(Offset viewportPoint, {bool start = false}) {
    final p = _toScene(viewportPoint);
    if (p == null) return;
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
    setState(() => _zones.add(zone));
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
            tooltip: _drawMode
                ? 'Режим движения (zoom/pan)'
                : 'Режим рисования',
            icon: Icon(_drawMode ? Icons.pan_tool : Icons.edit),
            onPressed: () => setState(() => _drawMode = !_drawMode),
          ),
          IconButton(
            tooltip: 'Сбросить zoom',
            icon: const Icon(Icons.center_focus_strong),
            onPressed: () => setState(() => _tc.value = Matrix4.identity()),
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
                      // 6e-2-fix: без подписей — только цветная рамка.
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
                          child: Text(
                            _drawMode
                                ? 'Рисование: проведи по области этикетки. Кнопка руки — zoom/pan'
                                : 'Движение: щипок — zoom, палец — pan. Кнопка карандаша — рисование',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
                final viewer = InteractiveViewer(
                  transformationController: _tc,
                  scaleEnabled: !_drawMode,
                  panEnabled: !_drawMode,
                  minScale: 1,
                  maxScale: 6,
                  child: scene,
                );
                if (_drawMode) {
                  return GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onPanStart: (d) => _dragTo(d.localPosition, start: true),
                    onPanUpdate: (d) => _dragTo(d.localPosition),
                    onPanEnd: (d) => _finishDrag(frame),
                    child: viewer,
                  );
                }
                return viewer;
              },
            ),
          ),
          // 6e-2-fix: легенда — чипы в цвет зоны, крестик того же цвета.
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
