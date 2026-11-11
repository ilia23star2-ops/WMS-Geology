import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;

import '../db/catalog_dao.dart';
import '../db/duplicate_checker.dart';
import '../models/ocr_result.dart';
import '../services/ocr_service.dart';
import '../utils/levenshtein.dart';

enum OcrStep {
  cropping('1/6 · Выделение области'),
  preprocessing('2/6 · Подготовка фото'),
  recognizing('3/6 · Распознавание Tesseract'),
  parsing('4/6 · Поиск полей'),
  validating('5/6 · Сверка с базой'),
  done('6/6 · Готово');

  final String label;
  const OcrStep(this.label);
}

class OcrScreen extends StatefulWidget {
  const OcrScreen({super.key});
  @override
  State<OcrScreen> createState() => _OcrScreenState();
}

class _OcrScreenState extends State<OcrScreen> {
  final MlKitOcrService _ocrService = MlKitOcrService();
  final ImagePicker _picker = ImagePicker();

  File? _originalFile;
  Size? _imageSize;
  OcrParsedResult? _result;
  bool _isProcessing = false;
  OcrStep _currentStep = OcrStep.cropping;

  List<Map<String, dynamic>> _sites = [];
  List<Map<String, dynamic>> _researchTypes = [];
  bool? _isSiteValid;
  bool? _isRtValid;

  Rect? _selectionRect;
  Offset? _dragStart;

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
      if (mounted)
        setState(() {
          _sites = sites;
          _researchTypes = rts;
        });
    } catch (e) {
      debugPrint('Ошибка загрузки справочников: $e');
    }
  }

  @override
  void dispose() {
    _siteCtrl.dispose();
    _woCtrl.dispose();
    _incomingCtrl.dispose();
    _researchCtrl.dispose();
    _containerCtrl.dispose();
    _ocrService.dispose();
    _ocrService.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final pickedFile = await _picker.pickImage(source: source);
    if (pickedFile == null) return;
    final bytes = await pickedFile.readAsBytes();
    final image = await decodeImageFromList(bytes);
    setState(() {
      _originalFile = File(pickedFile.path);
      _result = null;
      _imageSize = Size(image.width.toDouble(), image.height.toDouble());
      _selectionRect = null;
      _isSiteValid = null;
      _isRtValid = null;
      _siteCtrl.clear();
      _woCtrl.clear();
      _incomingCtrl.clear();
      _researchCtrl.clear();
      _containerCtrl.clear();
    });
  }

  Future<void> _processSelectedArea() async {
    if (_originalFile == null || _selectionRect == null || _imageSize == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Выделите область с текстом!')),
      );
      return;
    }

    final RenderBox? box = context.findRenderObject() as RenderBox?;
    if (box == null) return;
    final Size widgetSize = box.size;

    setState(() {
      _isProcessing = true;
      _currentStep = OcrStep.cropping;
    });
    await _delay(100);
    if (!mounted) return;

    final imageAspect = _imageSize!.width / _imageSize!.height;
    final widgetAspect = widgetSize.width / widgetSize.height;
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

    final cropLeft = ((_selectionRect!.left - offsetX) * scaleX)
        .clamp(0, _imageSize!.width)
        .toInt();
    final cropTop = ((_selectionRect!.top - offsetY) * scaleY)
        .clamp(0, _imageSize!.height)
        .toInt();
    final cropWidth = (_selectionRect!.width * scaleX)
        .clamp(1, _imageSize!.width)
        .toInt();
    final cropHeight = (_selectionRect!.height * scaleY)
        .clamp(1, _imageSize!.height)
        .toInt();

    setState(() => _currentStep = OcrStep.preprocessing);
    await _delay(100);
    if (!mounted) return;

    final bytes = await _originalFile!.readAsBytes();
    final fullImage = img.decodeImage(bytes)!;
    final cropped = img.copyCrop(
      fullImage,
      x: cropLeft,
      y: cropTop,
      width: cropWidth,
      height: cropHeight,
    );
    final resized = img.copyResize(
      cropped,
      width: cropped.width * 3,
      interpolation: img.Interpolation.cubic,
    );
    final grayscale = img.grayscale(resized);
    final contrastAdjusted = img.adjustColor(
      grayscale,
      contrast: 1.5,
      brightness: 1.0,
    );
    final sharpened = img.convolution(
      contrastAdjusted,
      filter: [0, -1, 0, -1, 5, -1, 0, -1, 0],
      div: 1,
    );

    final tempDir = Directory.systemTemp;
    final tempFile = File(
      '${tempDir.path}/ocr_crop_${DateTime.now().millisecondsSinceEpoch}.jpg',
    );
    await tempFile.writeAsBytes(img.encodeJpg(sharpened));

    setState(() => _currentStep = OcrStep.recognizing);
    await _delay(100);
    if (!mounted) return;

    final res = await _ocrService.processImage(tempFile.path);
    res.scaleBoxes(1 / 3);
    res.shiftBoxes(Offset(cropLeft.toDouble(), cropTop.toDouble()));

    setState(() => _currentStep = OcrStep.parsing);
    await _delay(100);
    if (!mounted) return;

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

    setState(() => _currentStep = OcrStep.validating);
    await _delay(100);
    if (!mounted) return;

    if (res.samples.isNotEmpty) {
      final duplicates = await DuplicateChecker.findDuplicates(
        res.samples.map((s) => s.sampleNumber).toList(),
      );
      for (final s in res.samples) {
        s.isDuplicate = duplicates.contains(s.sampleNumber);
      }
    }

    setState(() {
      _currentStep = OcrStep.done;
      _isProcessing = false;
      _result = res;
    });
  }

  Future<void> _delay(int ms) => Future.delayed(Duration(milliseconds: ms));

  void _addSample() {
    setState(() {
      _result?.samples.add(
        OcrSampleRow(
          sequenceNumber: (_result?.samples.length ?? 0) + 1,
          sampleNumber: '',
          boundingBox: Rect.zero,
        ),
      );
    });
  }

  void _removeSample(int index) {
    setState(() {
      _result?.samples.removeAt(index);
    });
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
              Navigator.pop(context);
            },
            child: const Text('Сохранить'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Сканирование (OCR)')),
      body: _originalFile == null ? _buildEmptyState() : _buildLayout(),
      floatingActionButton:
          _originalFile != null && _result == null && !_isProcessing
          ? FloatingActionButton.extended(
              onPressed: _processSelectedArea,
              icon: const Icon(Icons.search),
              label: const Text('Распознать'),
            )
          : null,
    );
  }

  Widget _buildEmptyState() => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.document_scanner, size: 64, color: Colors.grey),
        const SizedBox(height: 16),
        const Text('Сделайте фото или выберите из галереи', style: TextStyle(fontSize: 18)),
        const SizedBox(height: 24),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          ElevatedButton.icon(onPressed: () => _pickImage(ImageSource.camera), icon: const Icon(Icons.camera_alt), label: const Text('Сделать фото')),
          const SizedBox(width: 16),
          OutlinedButton.icon(onPressed: () => _pickImage(ImageSource.gallery), icon: const Icon(Icons.photo_library), label: const Text('Из галереи')),
        ]),
      ],
    ),
  );

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
                  child: LayoutBuilder(
                    builder: (context, constraints) => GestureDetector(
                      onPanStart: (_result == null && !_isProcessing)
                          ? (details) {
                              setState(() {
                                _dragStart = details.localPosition;
                                _selectionRect = Rect.fromPoints(
                                  _dragStart!,
                                  _dragStart!,
                                );
                              });
                            }
                          : null,
                      onPanUpdate: (_result == null && !_isProcessing)
                          ? (details) {
                              if (_dragStart != null)
                                setState(() {
                                  _selectionRect = Rect.fromPoints(
                                    _dragStart!,
                                    details.localPosition,
                                  );
                                });
                            }
                          : null,
                      onPanEnd: (_result == null && !_isProcessing)
                          ? (_) {
                              setState(() => _dragStart = null);
                            }
                          : null,
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: Image.file(
                              _originalFile!,
                              fit: BoxFit.contain,
                            ),
                          ),
                          if (_selectionRect != null && _result == null)
                            Positioned.fill(
                              child: CustomPaint(
                                painter: _CropOverlayPainter(
                                  selectionRect: _selectionRect!,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
                if (_isProcessing)
                  Container(
                    color: Colors.black54,
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const CircularProgressIndicator(color: Colors.white),
                          const SizedBox(height: 16),
                          Text(
                            _currentStep.label,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
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
              child: _result == null
                  ? const Center(
                      child: Text('Выделите область и нажмите "Распознать"'),
                    )
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
                              _buildField(
                                'Тип исследования',
                                _researchCtrl,
                                _isRtValid,
                              ),
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
                                    ? const Center(
                                        child: Text('Пробы не найдены'),
                                      )
                                    : ListView.builder(
                                        itemCount: _result!.samples.length,
                                        itemBuilder: (context, index) {
                                          final s = _result!.samples[index];
                                          return Card(
                                            margin: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 4,
                                            ),
                                            color: s.isDuplicate
                                                ? Colors.red[50]
                                                : null,
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
                                                onChanged: (val) =>
                                                    s.sampleNumber = val,
                                              ),
                                              trailing: IconButton(
                                                icon: const Icon(
                                                  Icons.delete,
                                                  color: Colors.red,
                                                ),
                                                onPressed: () =>
                                                    _removeSample(index),
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
                                        onPressed: _addSample,
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
                    ),
            ),
          ),
        ),
      ],
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
          focusedBorder: borderColor != null
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
  _CropOverlayPainter({required this.selectionRect});
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.black54;
    final fullRect = Rect.fromLTWH(0, 0, size.width, size.height);
    final path = Path()
      ..addRect(fullRect)
      ..addRect(selectionRect)
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(path, paint);
    final borderPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = Colors.blue;
    canvas.drawRect(selectionRect, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
