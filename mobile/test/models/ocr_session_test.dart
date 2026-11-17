/// Тесты `OcrSession` / `CellPhotos` (6e-a1).
///
/// Покрывает состояние сессии оцифровки в памяти: ячейки, фото,
/// счётчики и уведомление слушателей через `onChanged`.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:wms_geology_mobile/models/ocr_session.dart';

void main() {
  group('OcrSession (6e-a1)', () {
    test('addCell добавляет ячейку без фото', () {
      final session = OcrSession();
      session.addCell(5, 'В4/1/1/B/2');
      expect(session.cells.length, 1);
      expect(session.cells.first.photos, isEmpty);
    });

    test('addCell не дублирует ячейку с тем же cellId', () {
      final session = OcrSession();
      session.addCell(5, 'В4/1/1/B/2');
      session.addCell(5, 'В4/1/1/B/2');
      expect(session.cells.length, 1);
    });

    test('removeCell удаляет ячейку', () {
      final session = OcrSession();
      session.addCell(5, 'В4/1/1/B/2');
      session.removeCell(5);
      expect(session.cells, isEmpty);
    });

    test('getCell возвращает null для неизвестной ячейки', () {
      final session = OcrSession();
      session.addCell(5, 'В4/1/1/B/2');
      expect(session.getCell(99), isNull);
    });

    test('clear очищает сессию', () {
      final session = OcrSession();
      session.addCell(5, 'В4/1/1/B/2');
      session.addCell(6, 'В4/1/1/C/1');
      session.clear();
      expect(session.cells, isEmpty);
    });

    test('totalPhotos суммирует фото по всем ячейкам', () {
      final session = OcrSession();
      session.addCell(5, 'В4/1/1/B/2');
      session.addCell(6, 'В4/1/1/C/1');
      session.getCell(5)!.addPhoto(XFile('a.jpg'));
      session.getCell(5)!.addPhoto(XFile('b.jpg'));
      session.getCell(6)!.addPhoto(XFile('c.jpg'));
      expect(session.totalPhotos, 3);
    });

    test('addPhoto добавляет фото в ячейку', () {
      final cell = CellPhotos(cellId: 5, fullAddress: 'В4/1/1/B/2');
      cell.addPhoto(XFile('a.jpg'));
      expect(cell.photos.length, 1);
    });

    test('removePhoto удаляет фото по индексу', () {
      final cell = CellPhotos(cellId: 5, fullAddress: 'В4/1/1/B/2');
      cell.addPhoto(XFile('a.jpg'));
      cell.addPhoto(XFile('b.jpg'));
      cell.removePhoto(0);
      expect(cell.photos.single.path, 'b.jpg');
    });

    test('removePhoto с индексом вне диапазона не меняет список', () {
      final cell = CellPhotos(cellId: 5, fullAddress: 'В4/1/1/B/2');
      cell.addPhoto(XFile('a.jpg'));
      cell.removePhoto(7);
      expect(cell.photos.length, 1);
    });

    test('addCell уведомляет слушателей', () {
      final session = OcrSession();
      var notified = 0;
      session.addListener(() => notified++);
      session.addCell(5, 'В4/1/1/B/2');
      expect(notified, 1);
    });

    test('addPhoto уведомляет слушателей сессии', () {
      final session = OcrSession();
      session.addCell(5, 'В4/1/1/B/2');
      var notified = 0;
      session.addListener(() => notified++);
      session.getCell(5)!.addPhoto(XFile('a.jpg'));
      expect(notified, 1);
    });

    test('removePhoto уведомляет слушателей сессии', () {
      final session = OcrSession();
      session.addCell(5, 'В4/1/1/B/2');
      session.getCell(5)!.addPhoto(XFile('a.jpg'));
      var notified = 0;
      session.addListener(() => notified++);
      session.getCell(5)!.removePhoto(0);
      expect(notified, 1);
    });

    test('cells отдаёт неизменяемый список', () {
      final session = OcrSession();
      session.addCell(5, 'В4/1/1/B/2');
      expect(
        () => session.cells.add(CellPhotos(cellId: 6, fullAddress: 'В4/1/1/C/1')),
        throwsUnsupportedError,
      );
    });
  });
}
