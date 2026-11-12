import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;

import '../db/catalog_dao.dart';
import '../db/duplicate_checker.dart';
import '../models/ocr_result.dart';
import '../services/tesseract_ocr_service.dart';
import '../utils/levenshtein.dart';
import '../utils/tesseract_parser.dart';

enum ScreenState { pick, crop, adjust, result }

enum ZoneType { site, workOrder, researchType, containerNumber, samples }

class OcrZone {
  final Rect rect;
  final ZoneType type;
  OcrZone(this.rect, this.type);
}

// Фоновый изолят для реальной обработки фото
Future<String> _processImageInIsolate(Map<String, dynamic> params) async {
  final String imagePath = params['imagePath'];
  final double uiBrightness = params['brightness'];
  final double uiContrast = params['contrast'];
  final double uiZoom = params['zoom'];
  final bool binarize = params['binarize'];

  final bytes = await File(imagePath).readAsBytes();
  img.Image processed = img.decodeImage(bytes)!;

  if (uiZoom != 1.0) {
    final newWidth = (processed.width * uiZoom).toInt();
    final newHeight = (processed.height * uiZoom).toInt();
    processed = img.copyResize(
      processed,
      width: newWidth,
      height: newHeight,
      interpolation: img.Interpolation.cubic,
    );
  }

  processed = img.grayscale(processed);
  final double dartBrightness = 1.0 + (uiBrightness / 100.0);
  processed = img.adjustColor(
    processed,
    contrast: uiContrast,
    brightness: dartBrightness,
  );

  if (binarize) {
    processed = img.gaussianBlur(processed, radius: 2);
    processed = img.luminanceThreshold(processed, threshold: 0.55);
  }

  final tempDir = Directory.systemTemp;
  final tempFile = File(
    '${tempDir.path}/preview_${DateTime.now().millisecondsSinceEpoch}.jpg',
  );
  await tempFile.writeAsBytes(img.encodeJpg(processed, quality: 95));
  return tempFile.path;
}

// Вырезает зону. Теперь он сам определяет размер картинки и делает отступы!
Future<String> _cropZoneInIsolate(Map<String, dynamic> params) async {
  final String imagePath = params['imagePath'];
  final Rect rect = params['rect'];
  final Size widgetSize = params['widgetSize'];

  final bytes = await File(imagePath).readAsBytes();
  final fullImage = img.decodeImage(bytes)!;
  final imageSize = Size(
    fullImage.width.toDouble(),
    fullImage.height.toDouble(),
  );

  final double imageAspect = imageSize.width / imageSize.height;
  final double widgetAspect = widgetSize.width / widgetSize.height;

  double displayWidth, displayHeight, offsetX, offsetY;
  if (imageAspect > widgetAspect) {
    displayWidth = widgetSize.width;
    displayHeight = displayWidth / imageAspect;
    offsetX = 0;
    offsetY = (widgetSize.height - displayHeight) / 2;
  } else {
    displayHeight = widgetSize.height;
    displayWidth = displayHeight * imageAspect;
    offsetX = (widgetSize.width - displayWidth) / 2;
    offsetY = 0;
  }

  final scaleX = imageSize.width / displayWidth;
  final scaleY = imageSize.height / displayHeight;

  // Добавляем 15 пикселей отступа, чтобы Tesseract видел фон вокруг букв
  final padding = 15.0;
  final cropLeft = (((rect.left - offsetX) * scaleX) - padding)
      .clamp(0, imageSize.width)
      .toInt();
  final cropTop = (((rect.top - offsetY) * scaleY) - padding)
      .clamp(0, imageSize.height)
      .toInt();
  final cropWidth = ((rect.width * scaleX) + padding * 2)
      .clamp(1, imageSize.width - cropLeft)
      .toInt();
  final cropHeight = ((rect.height * scaleY) + padding * 2)
      .clamp(1, imageSize.height - cropTop)
      .toInt();

  final cropped = img.copyCrop(
    fullImage,
    x: cropLeft,
    y: cropTop,
    width: cropWidth,
    height: cropHeight,
  );

  final tempDir = Directory.systemTemp;
  final tempFile = File(
    '${tempDir.path}/zone_${DateTime.now().millisecondsSinceEpoch}.jpg',
  );
  await tempFile.writeAsBytes(img.encodeJpg(cropped));
  return tempFile.path;
}

// Анализ фото для авто-подготовки
Future<Map<String, double>> _analyzeImageForAutoPrepare(
  String imagePath,
) async {
  final bytes = await File(imagePath).readAsBytes();
  img.Image image = img.decodeImage(bytes)!;
  image = img.copyResize(image, width: 100);
  image = img.grayscale(image);

  double totalLuminance = 0;
  double minLuminance = 255;
  double maxLuminance = 0;

  for (final pixel in image) {
    final lum = pixel.luminance.toDouble();
    totalLuminance += lum;
    if (lum < minLuminance) minLuminance = lum;
    if (lum > maxLuminance) maxLuminance = lum;
  }

  final pixelCount = image.width * image.height;
  final avgLuminance = totalLuminance / pixelCount;
  final contrastSpread = maxLuminance - minLuminance;

  double brightnessAdjust = (150 - avgLuminance) / 2.0;
  brightnessAdjust = brightnessAdjust.clamp(-50.0, 50.0);

  double contrastAdjust = 1.0 + (150.0 - contrastSpread) / 100.0;
  contrastAdjust = contrastAdjust.clamp(1.0, 3.0);

  bool shouldBinarize = contrastSpread > 80;

  return {
    'brightness': brightnessAdjust,
    'contrast': contrastAdjust,
    'binarize': shouldBinarize ? 1.0 : 0.0,
  };
}

class OcrScreen extends StatefulWidget {
  const OcrScreen({super.key});

  @override
  State<OcrScreen> createState() => _OcrScreenState();
}

class _OcrScreenState extends State<OcrScreen> {
  final TesseractOcrService _ocrService = TesseractOcrService();
  final ImagePicker _picker = ImagePicker();

  ScreenState _state = ScreenState.pick;
  File? _originalFile;
  File? _croppedFile;
  File? _realPreviewFile;
  Size? _imageSize;
  Size? _cropAreaSize;
  OcrParsedResult? _result;
  bool _isProcessing = false;
  bool _isPreviewProcessing = false;
  bool _isAnalyzing = false;

  Timer? _debounce;

  double _brightness = 0.0;
  double _contrast = 1.0;
  double _zoom = 1.0;
  bool _binarize = false;
  double _readabilityScore = 0.0;

  List<Map<String, dynamic>> _sites = [];
  List<Map<String, dynamic>> _researchTypes = [];
  bool? _isSiteValid;
  bool? _isRtValid;

  final List<OcrZone> _zones = [];
  Rect? _currentRect;
  Offset? _dragStart;
  ZoneType _activeZoneType = ZoneType.workOrder;

  late TextEditingController _siteCtrl;
  late TextEditingController _woCtrl;
  late TextEditingController _incomingCtrl;
  late TextEditingController _researchCtrl;
  late TextEditingController _containerCtrl;

  @override
  void initState() {
    super.initState();
    _siteCtrl = TextEditingController();
    _woCtrl = TextEditingController();
    _incomingCtrl = TextEditingController();
    _researchCtrl = TextEditingController();
    _containerCtrl = TextEditingController();
    _loadCatalogs();
  }

  Future<void> _loadCatalogs() async {
    try {
      final sites = await CatalogDao.getAll('site');
      final rts = await CatalogDao.getAll('research_type');
      if (mounted) {
        setState(() {
          _sites = sites;
          _researchTypes = rts;
        });
      }
    } catch (e) {
      debugPrint('Ошибка загрузки: $e');
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _siteCtrl.dispose();
    _woCtrl.dispose();
    _incomingCtrl.dispose();
    _researchCtrl.dispose();
    _containerCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final pickedFile = await _picker.pickImage(source: source);
    if (pickedFile == null) return;
    final bytes = await pickedFile.readAsBytes();
    final image = await decodeImageFromList(bytes);

    setState(() {
      _originalFile = File(pickedFile.path);
      _croppedFile = null;
      _realPreviewFile = null;
      _result = null;
      _imageSize = Size(image.width.toDouble(), image.height.toDouble());
      _zones.clear();
      _currentRect = null;
      _state = ScreenState.crop;
      _brightness = 0.0;
      _contrast = 1.0;
      _zoom = 1.0;
      _binarize = false;
      _siteCtrl.clear();
      _woCtrl.clear();
      _incomingCtrl.clear();
      _researchCtrl.clear();
      _containerCtrl.clear();
    });
  }

  Future<void> _cropAndAdjust() async {
    if (_currentRect == null || _imageSize == null || _cropAreaSize == null) {
      return;
    }

    final Size widgetSize = _cropAreaSize!;
    final double imageAspect = _imageSize!.width / _imageSize!.height;
    final double widgetAspect = widgetSize.width / widgetSize.height;

    double displayWidth, displayHeight, offsetX, offsetY;
    if (imageAspect > widgetAspect) {
      displayWidth = widgetSize.width;
      displayHeight = displayWidth / imageAspect;
      offsetX = 0;
      offsetY = (widgetSize.height - displayHeight) / 2;
    } else {
      displayHeight = widgetSize.height;
      displayWidth = displayHeight * imageAspect;
      offsetX = (widgetSize.width - displayWidth) / 2;
      offsetY = 0;
    }

    final scaleX = _imageSize!.width / displayWidth;
    final scaleY = _imageSize!.height / displayHeight;

    final cropLeft = ((_currentRect!.left - offsetX) * scaleX)
        .clamp(0, _imageSize!.width)
        .toInt();
    final cropTop = ((_currentRect!.top - offsetY) * scaleY)
        .clamp(0, _imageSize!.height)
        .toInt();
    final cropWidth = (_currentRect!.width * scaleX)
        .clamp(1, _imageSize!.width)
        .toInt();
    final cropHeight = (_currentRect!.height * scaleY)
        .clamp(1, _imageSize!.height)
        .toInt();

    final bytes = await _originalFile!.readAsBytes();
    var fullImage = img.decodeImage(bytes)!;
    fullImage = img.bakeOrientation(fullImage);

    final cropped = img.copyCrop(
      fullImage,
      x: cropLeft,
      y: cropTop,
      width: cropWidth,
      height: cropHeight,
    );

    final tempDir = Directory.systemTemp;
    final tempCropFile = File(
      '${tempDir.path}/crop_${DateTime.now().millisecondsSinceEpoch}.jpg',
    );
    await tempCropFile.writeAsBytes(img.encodeJpg(cropped));

    setState(() {
      _croppedFile = tempCropFile;
      _realPreviewFile = tempCropFile;
      _state = ScreenState.adjust;
      _updateReadability();
    });
  }

  void _updateReadability() {
    double score = (_contrast * 20) + (_binarize ? 40 : 0);
    if (_brightness.abs() > 40) {
      score -= 15;
    }
    _readabilityScore = score.clamp(0.0, 100.0);
  }

  void _triggerPreview() {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () async {
      if (_croppedFile == null) return;
      setState(() => _isPreviewProcessing = true);
      try {
        final path = await compute(_processImageInIsolate, {
          'imagePath': _croppedFile!.path,
          'brightness': _brightness,
          'contrast': _contrast,
          'zoom': _zoom,
          'binarize': _binarize,
        });
        if (mounted) {
          setState(() {
            _realPreviewFile = File(path);
            _isPreviewProcessing = false;
          });
        }
      } catch (e) {
        if (mounted) setState(() => _isPreviewProcessing = false);
      }
    });
  }

  Future<void> _autoPrepare() async {
    if (_croppedFile == null) return;
    setState(() => _isAnalyzing = true);
    final params = await compute(
      _analyzeImageForAutoPrepare,
      _croppedFile!.path,
    );
    setState(() {
      _brightness = params['brightness']!;
      _contrast = params['contrast']!;
      _binarize = params['binarize'] == 1.0;
      _zoom = 1.0;
      _isAnalyzing = false;
      _updateReadability();
    });
    _triggerPreview();
  }

  Future<void> _recognize() async {
    setState(() => _isProcessing = true);
    try {
      if (_zones.isNotEmpty) {
        final res = OcrParsedResult();
        res.processedImagePath = _realPreviewFile!.path;

        for (final zone in _zones) {
          final zonePath = await compute(_cropZoneInIsolate, {
            'imagePath': _realPreviewFile!.path,
            'rect': zone.rect,
            'widgetSize': _cropAreaSize!,
          });

          final zoneResult = await _ocrService.processImage(zonePath);

          if (zone.type == ZoneType.site) {
            res.site = zoneResult.rawTexts.join(' ').trim();
          } else if (zone.type == ZoneType.workOrder) {
            res.workOrder = TesseractParser.cleanWorkOrder(
              zoneResult.rawTexts.join(' ').trim(),
            );
          } else if (zone.type == ZoneType.researchType) {
            res.researchType = zoneResult.rawTexts.join(' ').trim();
          } else if (zone.type == ZoneType.containerNumber) {
            res.containerNumber = zoneResult.rawTexts.join(' ').trim();
          } else if (zone.type == ZoneType.samples) {
            for (final text in zoneResult.rawTexts) {
              final s = TesseractParser.cleanSampleNumber(text.trim());
              if (s.length >= 6 &&
                  !res.samples.any((element) => element.sampleNumber == s)) {
                res.samples.add(
                  OcrSampleRow(
                    sequenceNumber: res.samples.length + 1,
                    sampleNumber: s,
                    boundingBox: Rect.zero,
                  ),
                );
              }
            }
          }
        }
        _validateFields(res);
      } else {
        final tempFilePath = await compute(_processImageInIsolate, {
          'imagePath': _croppedFile!.path,
          'brightness': _brightness,
          'contrast': _contrast,
          'zoom': _zoom,
          'binarize': _binarize,
        });

        final res = await _ocrService.processImage(tempFilePath);
        _validateFields(res);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Ошибка: $e')));
    }
  }

  void _validateFields(OcrParsedResult res) async {
    bool? siteValid;
    if (res.site.isNotEmpty && _sites.isNotEmpty) {
      String bestMatch = res.site;
      int minDistance = 999;
      for (final s in _sites) {
        final dbName = s['name'].toString();
        final dist = levenshtein(res.site.toLowerCase(), dbName.toLowerCase());
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = dbName;
        }
      }
      if (minDistance < (res.site.length / 2).ceil()) {
        res.site = bestMatch;
        siteValid = true;
      } else {
        siteValid = false;
      }
    }

    bool? rtValid;
    if (res.researchType.isNotEmpty && _researchTypes.isNotEmpty) {
      String bestMatch = res.researchType;
      int minDistance = 999;
      for (final rt in _researchTypes) {
        final dbCode = rt['code'].toString();
        final dist = levenshtein(
          res.researchType.toLowerCase(),
          dbCode.toLowerCase(),
        );
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = dbCode;
        }
      }
      if (minDistance < (res.researchType.length / 2).ceil()) {
        res.researchType = bestMatch;
        rtValid = true;
      } else {
        rtValid = false;
      }
    }

    setState(() {
      _result = res;
      _siteCtrl.text = res.site;
      _woCtrl.text = res.workOrder;
      _incomingCtrl.text = res.incomingWorkOrder;
      _researchCtrl.text = res.researchType;
      _containerCtrl.text = res.containerNumber;
      _isSiteValid = siteValid;
      _isRtValid = rtValid;
    });

    if (res.samples.isNotEmpty) {
      final duplicates = await DuplicateChecker.findDuplicates(
        res.samples.map((s) => s.sampleNumber).toList(),
      );
      for (final s in res.samples) {
        s.isDuplicate = duplicates.contains(s.sampleNumber);
      }
    }

    if (!mounted) return;
    setState(() {
      _isProcessing = false;
      _state = ScreenState.result;
    });
  }

  void _reset() {
    setState(() {
      _state = ScreenState.pick;
      _originalFile = null;
      _croppedFile = null;
      _realPreviewFile = null;
      _zones.clear();
      _currentRect = null;
      _result = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Сканирование (OCR)'),
        actions: [
          if (_result != null)
            IconButton(
              icon: const Icon(Icons.bug_report, color: Colors.redAccent),
              onPressed: _showRawText,
            ),
          if (_state != ScreenState.pick)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _reset,
              tooltip: 'Начать заново',
            ),
        ],
      ),
      body: _buildBody(),
      floatingActionButton: _buildFAB(),
    );
  }

  Widget? _buildFAB() {
    if (_isProcessing) return null;
    if (_state == ScreenState.crop && _currentRect != null) {
      return FloatingActionButton.extended(
        onPressed: _cropAndAdjust,
        icon: const Icon(Icons.crop),
        label: const Text('Вырезать'),
      );
    } else if (_state == ScreenState.adjust) {
      return FloatingActionButton.extended(
        backgroundColor: Colors.green,
        onPressed: _recognize,
        icon: const Icon(Icons.search),
        label: const Text('Распознать'),
      );
    }
    return null;
  }

  Widget _buildBody() {
    if (_state == ScreenState.pick) return _buildEmptyState();
    if (_state == ScreenState.crop) return _buildImageWithCropper();
    return _buildLayout();
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.document_scanner, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          const Text(
            'Сделайте фото или выберите из галереи',
            style: TextStyle(fontSize: 18),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ElevatedButton.icon(
                onPressed: () => _pickImage(ImageSource.camera),
                icon: const Icon(Icons.camera_alt),
                label: const Text('Сделать фото'),
              ),
              const SizedBox(width: 16),
              OutlinedButton.icon(
                onPressed: () => _pickImage(ImageSource.gallery),
                icon: const Icon(Icons.photo_library),
                label: const Text('Из галереи'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildImageWithCropper() {
    return Container(
      color: Colors.black,
      child: LayoutBuilder(
        builder: (context, constraints) {
          _cropAreaSize = constraints.biggest;
          return GestureDetector(
            onPanStart: (details) {
              setState(() {
                _dragStart = details.localPosition;
                _currentRect = Rect.fromPoints(_dragStart!, _dragStart!);
              });
            },
            onPanUpdate: (details) {
              if (_dragStart != null) {
                setState(() {
                  _currentRect = Rect.fromPoints(
                    _dragStart!,
                    details.localPosition,
                  );
                });
              }
            },
            onPanEnd: (_) => setState(() => _dragStart = null),
            child: Stack(
              children: [
                Positioned.fill(
                  child: Image.file(_originalFile!, fit: BoxFit.contain),
                ),
                if (_currentRect != null)
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _CropOverlayPainter(
                        selectionRect: _currentRect!,
                        color: Colors.blue,
                        drawBackground: true,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildLayout() {
    final isNarrow = MediaQuery.of(context).size.width < 700;

    return Flex(
      direction: isNarrow ? Axis.vertical : Axis.horizontal,
      children: [
        Expanded(
          flex: 2,
          child: Container(
            color: Colors.black,
            child: Stack(
              children: [
                Positioned.fill(
                  child: _realPreviewFile != null
                      ? Image.file(
                          _realPreviewFile!,
                          key: ValueKey(_realPreviewFile!.path),
                          fit: BoxFit.contain,
                        )
                      : Image.file(_croppedFile!, fit: BoxFit.contain),
                ),
                if (_state == ScreenState.adjust) ...[
                  Positioned.fill(
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        return GestureDetector(
                          onPanStart: (details) {
                            setState(() {
                              _dragStart = details.localPosition;
                              _currentRect = Rect.fromPoints(
                                _dragStart!,
                                _dragStart!,
                              );
                            });
                          },
                          onPanUpdate: (details) {
                            if (_dragStart != null) {
                              setState(() {
                                _currentRect = Rect.fromPoints(
                                  _dragStart!,
                                  details.localPosition,
                                );
                              });
                            }
                          },
                          onPanEnd: (_) {
                            if (_currentRect != null &&
                                _currentRect!.width > 10 &&
                                _currentRect!.height > 10) {
                              setState(() {
                                _zones.add(
                                  OcrZone(_currentRect!, _activeZoneType),
                                );
                                _currentRect = null;
                              });
                            } else {
                              setState(() => _currentRect = null);
                            }
                          },
                          child: Stack(
                            children: <Widget>[
                              // Сохраненные зоны (только рамки, без затемнения)
                              for (final z in _zones)
                                Positioned.fill(
                                  child: CustomPaint(
                                    painter: _CropOverlayPainter(
                                      selectionRect: z.rect,
                                      color: _getColorForType(z.type),
                                      drawBackground: false,
                                    ),
                                  ),
                                ),
                              // Текущая зона (с затемнением)
                              if (_currentRect != null)
                                Positioned.fill(
                                  child: CustomPaint(
                                    painter: _CropOverlayPainter(
                                      selectionRect: _currentRect!,
                                      color: _getColorForType(_activeZoneType),
                                      drawBackground: true,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],
                if (_isProcessing || _isPreviewProcessing || _isAnalyzing)
                  Container(
                    color: Colors.black54,
                    child: const Center(
                      child: CircularProgressIndicator(color: Colors.white),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Expanded(
          flex: isNarrow ? 3 : 1,
          child: SafeArea(
            child: Container(
              color: Colors.grey[100],
              child: _state == ScreenState.adjust
                  ? _buildSliders()
                  : _buildResultFields(),
            ),
          ),
        ),
      ],
    );
  }

  Color _getColorForType(ZoneType type) {
    switch (type) {
      case ZoneType.site:
        return Colors.blueAccent;
      case ZoneType.workOrder:
        return Colors.greenAccent;
      case ZoneType.researchType:
        return Colors.orangeAccent;
      case ZoneType.containerNumber:
        return Colors.purpleAccent;
      case ZoneType.samples:
        return Colors.redAccent;
    }
  }

  Widget _buildSliders() {
    final isGood = _readabilityScore > 50;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: ZoneType.values.map((type) {
              bool isActive = _activeZoneType == type;
              String label = "";
              if (type == ZoneType.site) label = "Участок";
              if (type == ZoneType.workOrder) label = "Н/З";
              if (type == ZoneType.researchType) label = "ТИ";
              if (type == ZoneType.containerNumber) label = "Тара";
              if (type == ZoneType.samples) label = "Пробы";

              return ChoiceChip(
                label: Text(label),
                selected: isActive,
                selectedColor: _getColorForType(type).withValues(alpha: 0.3),
                onSelected: (v) => setState(() => _activeZoneType = type),
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          const Text(
            'Выберите критерий и обведите область на фото. Для проб можно нарисовать несколько зон.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
          const Divider(),

          ElevatedButton.icon(
            onPressed: _isAnalyzing ? null : _autoPrepare,
            icon: const Icon(Icons.auto_fix_high),
            label: Text(_isAnalyzing ? 'Анализ...' : 'Авто-подготовка'),
          ),
          const SizedBox(height: 16),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Яркость:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              Text('${_brightness.toInt()}'),
            ],
          ),
          Slider(
            value: _brightness,
            min: -50,
            max: 50,
            onChanged: (v) {
              setState(() {
                _brightness = v;
                _updateReadability();
              });
            },
            onChangeEnd: (_) => _triggerPreview(),
          ),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Контрастность:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              Text(_contrast.toStringAsFixed(1)),
            ],
          ),
          Slider(
            value: _contrast,
            min: 0.5,
            max: 3.0,
            onChanged: (v) {
              setState(() {
                _contrast = v;
                _updateReadability();
              });
            },
            onChangeEnd: (_) => _triggerPreview(),
          ),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Увеличение (Зум):',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              Text(_zoom.toStringAsFixed(1)),
            ],
          ),
          Slider(
            value: _zoom,
            min: 0.5,
            max: 4.0,
            onChanged: (v) => setState(() => _zoom = v),
            onChangeEnd: (_) => _triggerPreview(),
          ),

          SwitchListTile(
            title: const Text('Ч/Б режим (Бинаризация)'),
            subtitle: const Text(
              'Убирает блики, сетку и тени, оставляя только текст',
            ),
            value: _binarize,
            onChanged: (v) {
              setState(() {
                _binarize = v;
                _updateReadability();
              });
              _triggerPreview();
            },
            contentPadding: EdgeInsets.zero,
          ),

          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isGood ? Colors.green[100] : Colors.red[100],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  isGood ? Icons.check_circle : Icons.warning,
                  color: isGood ? Colors.green : Colors.red,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isGood
                        ? 'Хорошая читаемость (${_readabilityScore.toInt()}%)'
                        : 'Плохо читаемо (${_readabilityScore.toInt()}%)',
                    style: TextStyle(
                      color: isGood ? Colors.green[800] : Colors.red[800],
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultFields() {
    return _result == null
        ? const Center(child: Text('Нажмите "Распознать"'))
        : Column(
            children: [
              Expanded(
                flex: 2,
                child: ListView(
                  padding: const EdgeInsets.all(8),
                  children: [
                    _buildField('Участок', _siteCtrl, _isSiteValid),
                    _buildField('Н/З', _woCtrl, null),
                    _buildField('Вх. Н/З', _incomingCtrl, null),
                    _buildField('Тип исследования', _researchCtrl, _isRtValid),
                    _buildField('№ тары', _containerCtrl, null),
                  ],
                ),
              ),
              const Divider(thickness: 2),
              Expanded(
                flex: 3,
                child: Column(
                  children: [
                    Expanded(
                      child: _result!.samples.isEmpty
                          ? const Center(child: Text('Пробы не найдены'))
                          : ListView.builder(
                              itemCount: _result!.samples.length,
                              itemBuilder: (context, index) {
                                final s = _result!.samples[index];
                                return Card(
                                  margin: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  color: s.isDuplicate ? Colors.red[50] : null,
                                  child: ListTile(
                                    dense: true,
                                    leading: CircleAvatar(
                                      radius: 12,
                                      backgroundColor: s.isDuplicate
                                          ? Colors.red
                                          : null,
                                      child: Text(
                                        '${index + 1}',
                                        style: TextStyle(
                                          color: s.isDuplicate
                                              ? Colors.white
                                              : null,
                                        ),
                                      ),
                                    ),
                                    title: TextFormField(
                                      initialValue: s.sampleNumber,
                                      decoration: InputDecoration(
                                        hintText: 'Номер пробы',
                                        border: InputBorder.none,
                                        suffixIcon: s.isDuplicate
                                            ? const Icon(
                                                Icons.warning,
                                                color: Colors.red,
                                                size: 18,
                                              )
                                            : null,
                                      ),
                                      onChanged: (val) => s.sampleNumber = val,
                                    ),
                                    trailing: IconButton(
                                      icon: const Icon(
                                        Icons.delete,
                                        color: Colors.red,
                                      ),
                                      onPressed: () => setState(
                                        () => _result!.samples.removeAt(index),
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => setState(
                                () => _result!.samples.add(
                                  OcrSampleRow(
                                    sequenceNumber: _result!.samples.length + 1,
                                    sampleNumber: '',
                                    boundingBox: Rect.zero,
                                  ),
                                ),
                              ),
                              icon: const Icon(Icons.add),
                              label: const Text('Добавить'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: _saveResult,
                              icon: const Icon(Icons.save),
                              label: const Text('Сохранить'),
                              style: FilledButton.styleFrom(
                                backgroundColor: Colors.green,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
  }

  void _saveResult() {
    if (_result == null) return;
    final hasDupes = _result!.samples.any((s) => s.isDuplicate);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(hasDupes ? '⚠️ Есть дубликаты!' : 'Сохранить тару?'),
        content: Text(
          'Н/З: ${_woCtrl.text}\nТип: ${_researchCtrl.text}\nПроб: ${_result!.samples.length}\n${hasDupes ? "\n⚠️ Некоторые пробы уже есть в системе!" : ""}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Отмена'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Тара сохранена (демо)!')),
              );
              _reset();
            },
            child: const Text('Сохранить'),
          ),
        ],
      ),
    );
  }

  void _showRawText() {
    if (_result == null || _result!.processedImagePath == null) return;
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Итоговое фото для OCR и сырой текст',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
            ),
            Expanded(
              flex: 1,
              child: Container(
                width: double.infinity,
                color: Colors.black,
                child: Image.file(
                  File(_result!.processedImagePath!),
                  key: ValueKey(_result!.processedImagePath!),
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const Divider(),
            Expanded(
              flex: 1,
              child: ListView.builder(
                itemCount: _result!.rawTexts.length,
                itemBuilder: (context, i) => ListTile(
                  dense: true,
                  title: Text(
                    _result!.rawTexts[i],
                    style: const TextStyle(fontFamily: 'monospace'),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(
    String label,
    TextEditingController controller,
    bool? isValid,
  ) {
    Color? borderColor;
    IconData? icon;
    if (controller.text.isNotEmpty) {
      if (isValid == true) {
        borderColor = Colors.green;
        icon = Icons.check_circle;
      } else if (isValid == false) {
        borderColor = Colors.orange;
        icon = Icons.warning;
      }
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
          border: const OutlineInputBorder(),
          enabledBorder: borderColor != null
              ? OutlineInputBorder(
                  borderSide: BorderSide(color: borderColor, width: 2),
                )
              : null,
          suffixIcon: icon != null ? Icon(icon, color: borderColor) : null,
        ),
      ),
    );
  }
}

class _CropOverlayPainter extends CustomPainter {
  final Rect selectionRect;
  final Color color;
  final bool drawBackground; // <-- Добавлен флаг

  _CropOverlayPainter({
    required this.selectionRect,
    required this.color,
    this.drawBackground = true,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (drawBackground) {
      final paint = Paint()..color = Colors.black54;
      final path = Path()
        ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
        ..addRect(selectionRect)
        ..fillType = PathFillType.evenOdd;
      canvas.drawPath(path, paint);
    }

    canvas.drawRect(
      selectionRect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
