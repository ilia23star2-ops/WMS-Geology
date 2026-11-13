# Module: mark_detector.py
# Version: 1.0.2
# Description: Детектор маркеров "выбрано" (точки, зачёркивания, галочки)

import cv2
import numpy as np
from typing import List, Dict, Tuple
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# === LOGIC_START ===
# === LOGIC_START ===
class MarkDetector:
    """
    Детектор маркеров "выбрано" на изображениях.
    
    Поддерживаемые типы маркеров:
    - Точки (кружки)
    - Зачёркивания (горизонтальные линии)
    - Галочки (✓)
    """
    
    def __init__(
        self,
        dot_radius_range: Tuple[int, int] = (3, 10),
        line_min_length: int = 30,
        line_max_angle: int = 15,
        match_radius: int = 30
    ):
        self.dot_radius_range = dot_radius_range
        self.line_min_length = line_min_length
        self.line_max_angle = line_max_angle
        self.match_radius = match_radius
    
    def detect_marks(self, zone_image: np.ndarray) -> List[Dict]:
        """Детекция маркеров на изображении зоны."""
        if zone_image is None or zone_image.size == 0:
            logger.warning("Пустое изображение")
            return []
        
        marks = []
        gray = cv2.cvtColor(zone_image, cv2.COLOR_BGR2GRAY) if len(zone_image.shape) == 3 else zone_image
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        dots = self._detect_dots(blurred)
        marks.extend(dots)
        
        strikethroughs = self._detect_strikethroughs(blurred)
        marks.extend(strikethroughs)
        
        checkmarks = self._detect_checkmarks(blurred)
        marks.extend(checkmarks)
        
        logger.info(f"Обнаружено маркеров: {len(marks)} (точки: {len(dots)}, зачёркивания: {len(strikethroughs)}, галочки: {len(checkmarks)})")
        
        return marks
    
    def _detect_dots(self, gray: np.ndarray) -> List[Dict]:
        """Детекция точек (кружков)."""
        circles = cv2.HoughCircles(
            gray, cv2.HOUGH_GRADIENT, dp=1, minDist=10,
            param1=50, param2=30,
            minRadius=self.dot_radius_range[0],
            maxRadius=self.dot_radius_range[1]
        )
        
        if circles is None:
            return []
        
        circles = np.round(circles[0, :]).astype("int")
        return [
            {"type": "dot", "center": (int(x), int(y)), "radius": int(r)}
            for x, y, r in circles
        ]
    
    def _detect_strikethroughs(self, gray: np.ndarray) -> List[Dict]:
        """Детекция зачёркиваний (горизонтальных линий)."""
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=50, minLineLength=self.line_min_length, maxLineGap=10)
        
        if lines is None:
            return []
        
        strikethroughs = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)
            if angle < self.line_max_angle or angle > 180 - self.line_max_angle:
                strikethroughs.append({
                    "type": "strikethrough",
                    "start": (int(x1), int(y1)),
                    "end": (int(x2), int(y2))
                })
        
        return strikethroughs
    
    def _detect_checkmarks(self, gray: np.ndarray) -> List[Dict]:
        """Детекция галочек (упрощённая)."""
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        checkmarks = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if 50 < area < 500:
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = float(w) / h if h > 0 else 0
                if 1.5 < aspect_ratio < 3.0:
                    checkmarks.append({
                        "type": "checkmark",
                        "center": (int(x + w / 2), int(y + h / 2))
                    })
        
        return checkmarks
    
    def _bbox_to_polygon(self, bbox: List[List[float]]) -> np.ndarray:
        """Конвертация bbox в массив точек."""
        return np.array(bbox, dtype=np.float32)
    
    def _point_to_bbox_distance(self, px: float, py: float, bbox: List[List[float]]) -> float:
        """
        Вычисление расстояния от точки до ближайшей точки bbox.
        """
        poly = self._bbox_to_polygon(bbox)
        if cv2.pointPolygonTest(poly, (px, py), False) >= 0:
            return 0.0
        
        min_dist = float('inf')
        n = len(bbox)
        for i in range(n):
            x1, y1 = bbox[i]
            x2, y2 = bbox[(i + 1) % n]
            dist = self._point_to_line_distance(px, py, x1, y1, x2, y2)
            min_dist = min(min_dist, dist)
        
        return min_dist
    
    def match_marks_to_samples(
        self,
        marks: List[Dict],
        words: List[Dict]
    ) -> Dict:
        """
        Сопоставление маркеров с пробами.
        Каждый маркер привязывается только к ближайшему bbox.
        """
        samples = [{"text": w.get("text", ""), "status": "available", "bbox": w.get("bbox")} for w in words]
        selected_indices = set()
        
        for mark in marks:
            if mark["type"] in ["dot", "checkmark"]:
                mark_x, mark_y = mark["center"]
                # Находим ближайший bbox
                min_dist = float('inf')
                nearest_idx = -1
                for i, word in enumerate(words):
                    bbox = word.get("bbox")
                    if not bbox:
                        continue
                    dist = self._point_to_bbox_distance(mark_x, mark_y, bbox)
                    if dist < min_dist:
                        min_dist = dist
                        nearest_idx = i
                
                # Привязываем маркер только к ближайшему bbox, если расстояние в пределах радиуса
                if nearest_idx >= 0 and min_dist < self.match_radius:
                    selected_indices.add(nearest_idx)
            
            elif mark["type"] == "strikethrough":
                x1, y1 = mark["start"]
                x2, y2 = mark["end"]
                # Находим ближайший bbox к центру линии
                line_center_x = (x1 + x2) / 2
                line_center_y = (y1 + y2) / 2
                min_dist = float('inf')
                nearest_idx = -1
                for i, word in enumerate(words):
                    bbox = word.get("bbox")
                    if not bbox:
                        continue
                    center_x = sum(p[0] for p in bbox) / 4
                    center_y = sum(p[1] for p in bbox) / 4
                    dist = self._point_to_line_distance(center_x, center_y, x1, y1, x2, y2)
                    if dist < min_dist:
                        min_dist = dist
                        nearest_idx = i
                
                if nearest_idx >= 0 and min_dist < self.match_radius:
                    selected_indices.add(nearest_idx)
        
        # Обновляем статусы
        for idx in selected_indices:
            samples[idx]["status"] = "selected"
        
        annotated_image = self._annotate_image(words, marks, samples)
        
        return {
            "samples": samples,
            "selected_indices": sorted(list(selected_indices)),
            "annotated_image": annotated_image
        }
    
    def _point_to_line_distance(self, px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
        """Расстояние от точки до линии."""
        A = px - x1
        B = py - y1
        C = x2 - x1
        D = y2 - y1
        
        dot = A * C + B * D
        len_sq = C * C + D * D
        param = -1
        if len_sq != 0:
            param = dot / len_sq
        
        if param < 0:
            xx, yy = x1, y1
        elif param > 1:
            xx, yy = x2, y2
        else:
            xx = x1 + param * C
            yy = y1 + param * D
        
        dx = px - xx
        dy = py - yy
        return np.sqrt(dx * dx + dy * dy)
    
    def _annotate_image(self, words: List[Dict], marks: List[Dict], samples: List[Dict]) -> np.ndarray:
        """Создание аннотированного изображения для отладки."""
        return None
# === LOGIC_END ===
# === LOGIC_END ===
# === LOGIC_END ===

if __name__ == "__main__":
    # === TEST_START ===
    print("Тестирование MarkDetector")
    print("="*60)
    
    detector = MarkDetector()
    
    # Тестовые данные
    test_words = [
        {"text": "BRS7301001", "bbox": [[10, 10], [100, 10], [100, 30], [10, 30]], "confidence": 0.95},
        {"text": "BRS7301149", "bbox": [[10, 40], [100, 40], [100, 60], [10, 60]], "confidence": 0.98},
        {"text": "BRS7301150", "bbox": [[10, 70], [100, 70], [100, 90], [10, 90]], "confidence": 0.97}
    ]
    
    test_marks = [
        {"type": "dot", "center": (5, 50), "radius": 5},  # Рядом со второй пробой
        {"type": "strikethrough", "start": (10, 80), "end": (100, 80)}  # Перечёркивает третью пробу
    ]
    
    result = detector.match_marks_to_samples(test_marks, test_words)
    
    print("\nРезультаты сопоставления:")
    for i, sample in enumerate(result["samples"]):
        print(f"  {i}: {sample['text']} - {sample['status']}")
    
    print(f"\nИндексы выбранных проб: {result['selected_indices']}")
    
    print("\n" + "="*60)
    print("Тестирование завершено!")
    print("="*60)
    # === TEST_END ===
