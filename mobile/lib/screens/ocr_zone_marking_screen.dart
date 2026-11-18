/// Экран разметки зон на фото (6e-2c).
///
/// Drag по фото → прямоугольник → выбор типа → зона в пикселях оригинала.
/// Список зон с удалением; сохранение в CellPhotos (per-photo).
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
  int _imageWidth = 0;
  int _imageHeight = 0;
  bool _error = false;
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
          for (final t in OcrZoneTypes.order)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(ctx, t),
              child: Text(OcrZoneTypes.labels[t] ?? t),
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
                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onPanStart: (d) => setState(() {
                    _dragStart = d.localPosition;
                    _dragCurrent = d.localPosition;
                  }),
                  onPanUpdate: (d) =>
                      setState(() => _dragCurrent = d.localPosition),
                  onPanEnd: (d) => _finishDrag(frame),
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
                              color: _color(z.type).withValues(alpha: 0.15),
                            ),
                            child: Align(
                              alignment: Alignment.topLeft,
                              child: Container(
                                color: _color(z.type),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                  vertical: 1,
                                ),
                                child: Text(
                                  OcrZoneTypes.labels[z.type] ?? z.type,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
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
                      if (_zones.isEmpty)
                        Positioned(
                          left: 8,
                          right: 8,
                          bottom: 8,
                          child: Container(
                            color: Colors.black54,
                            padding: const EdgeInsets.all(6),
                            child: const Text(
                              'Проведи пальцем по области этикетки, чтобы выделить зону',
                              style: TextStyle(
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
              },
            ),
          ),
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
                        ),
                        onDeleted: () => setState(() => _zones.removeAt(i)),
                        deleteIconColor: Colors.red,
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
