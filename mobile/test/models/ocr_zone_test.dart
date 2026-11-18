import 'package:flutter_test/flutter_test.dart';
import 'package:wms_geology_mobile/models/ocr_zone.dart';

void main() {
  test('zoneFromNormalized: нормализованный rect → пиксели оригинала', () {
    final z = zoneFromNormalized(
      type: OcrZoneTypes.sample,
      left: 0.1,
      top: 0.2,
      width: 0.5,
      height: 0.4,
      imageWidth: 1000,
      imageHeight: 500,
    );
    expect(z, isNotNull);
    expect(z!.x, closeTo(100, 1e-6));
    expect(z.y, closeTo(100, 1e-6));
    expect(z.w, closeTo(500, 1e-6));
    expect(z.h, closeTo(200, 1e-6));
  });

  test('zoneFromNormalized: выход за границы обрезается', () {
    final z = zoneFromNormalized(
      type: OcrZoneTypes.workOrderCoded,
      left: -0.2,
      top: 0.9,
      width: 1.5,
      height: 0.5,
      imageWidth: 100,
      imageHeight: 100,
    );
    expect(z, isNotNull);
    expect(z!.x, closeTo(0, 1e-6));
    expect(z.y, closeTo(90, 1e-6));
    expect(z.w, closeTo(100, 1e-6));
    expect(z.h, closeTo(10, 1e-6));
  });

  test('zoneFromNormalized: вырожденный rect → null', () {
    final z = zoneFromNormalized(
      type: OcrZoneTypes.sample,
      left: 0.5,
      top: 0.5,
      width: 0,
      height: 0.2,
      imageWidth: 100,
      imageHeight: 100,
    );
    expect(z, isNull);
  });

  test('zoneFromNormalized: нулевой размер картинки → null', () {
    final z = zoneFromNormalized(
      type: OcrZoneTypes.sample,
      left: 0.1,
      top: 0.1,
      width: 0.5,
      height: 0.5,
      imageWidth: 0,
      imageHeight: 100,
    );
    expect(z, isNull);
  });

  test('toPayload: type + rect(4 числа) + source manual', () {
    const z = OcrZoneMark(
      type: OcrZoneTypes.containerNumber,
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    );
    final p = z.toPayload();
    expect(p['type'], 'container_number');
    expect(p['source'], 'manual');
    final rect = p['rect'] as List;
    expect(rect.length, 4);
    expect(rect[0], closeTo(10, 1e-6));
    expect(rect[1], closeTo(20, 1e-6));
    expect(rect[2], closeTo(30, 1e-6));
    expect(rect[3], closeTo(40, 1e-6));
  });

  test('labels покрывают все 6 типов зон', () {
    expect(OcrZoneTypes.order.length, 6);
    for (final t in OcrZoneTypes.order) {
      expect(OcrZoneTypes.labels[t], isNotNull);
    }
  });

  test('ImageFrame.contain: landscape фото в квадратной области', () {
    final f = ImageFrame.contain(
      imageWidth: 1000,
      imageHeight: 500,
      areaWidth: 400,
      areaHeight: 400,
    );
    expect(f.scale, closeTo(0.4, 1e-9));
    expect(f.displayWidth, closeTo(400, 1e-6));
    expect(f.displayHeight, closeTo(200, 1e-6));
    expect(f.offsetX, closeTo(0, 1e-6));
    expect(f.offsetY, closeTo(100, 1e-6));
  });

  test('ImageFrame.contain: portrait фото в landscape области', () {
    final f = ImageFrame.contain(
      imageWidth: 500,
      imageHeight: 1000,
      areaWidth: 400,
      areaHeight: 200,
    );
    expect(f.scale, closeTo(0.2, 1e-9));
    expect(f.displayWidth, closeTo(100, 1e-6));
    expect(f.displayHeight, closeTo(200, 1e-6));
    expect(f.offsetX, closeTo(150, 1e-6));
    expect(f.offsetY, closeTo(0, 1e-6));
  });

  test('ImageFrame: пиксели → область → нормализованные (roundtrip)', () {
    final f = ImageFrame.contain(
      imageWidth: 1000,
      imageHeight: 500,
      areaWidth: 400,
      areaHeight: 400,
    );
    expect(f.toAreaX(100), closeTo(40, 1e-6));
    expect(f.toAreaY(100), closeTo(140, 1e-6));
    expect(f.toNormalizedX(40), closeTo(0.1, 1e-6));
    expect(f.toNormalizedY(140), closeTo(0.2, 1e-6));
  });

  test('ImageFrame: координаты вне фото clamp в 0..1', () {
    final f = ImageFrame.contain(
      imageWidth: 1000,
      imageHeight: 500,
      areaWidth: 400,
      areaHeight: 400,
    );
    expect(f.toNormalizedX(-50), 0);
    expect(f.toNormalizedX(10000), 1);
    expect(f.toNormalizedY(-50), 0);
    expect(f.toNormalizedY(10000), 1);
  });

  test('ImageFrame: вырожденные размеры → нулевая рамка', () {
    final f = ImageFrame.contain(
      imageWidth: 0,
      imageHeight: 500,
      areaWidth: 400,
      areaHeight: 400,
    );
    expect(f.scale, 0);
    expect(f.displayWidth, 0);
    expect(f.toNormalizedX(123), 0);
    expect(f.toNormalizedY(123), 0);
  });
}
