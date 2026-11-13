# Module: auto_detector.py
# Version: 1.0.5
# Description: Автодетектор зон на этикетках по ключевым словам

import json
import re
import sys
from pathlib import Path
from typing import List, Dict
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# === LOGIC_START ===
# === LOGIC_START ===
class AutoDetector:
    """
    Автодетектор зон на этикетках по ключевым словам и паттернам.
    """
    
    def __init__(self, synonyms_path: str = "config/synonyms.json"):
        self.synonyms = self._load_synonyms(synonyms_path)
    
    def _load_synonyms(self, path: str) -> Dict:
        synonyms_file = Path(path)
        if not synonyms_file.exists():
            logger.warning(f"Файл синонимов не найден: {path}")
            return {}
        with open(synonyms_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def detect_zones(self, ocr_words: List[Dict]) -> List[Dict]:
        zones = []
        for category, config in self.synonyms.items():
            synonyms = config.get("synonyms", [])
            pattern = config.get("pattern")
            position = config.get("position")
            sample_patterns = config.get("sample_patterns", [])
            marker_found = False
            
            # 1. Поиск по ключевым словам и паттерну маркера
            for word in ocr_words:
                text = word.get("text", "").strip()
                bbox = word.get("bbox")
                if not bbox:
                    continue
                
                is_marker = False
                for synonym in synonyms:
                    if synonym.lower() in text.lower():
                        is_marker = True
                        break
                
                if pattern and re.search(pattern, text):
                    if position == "top":
                        y_center = sum(p[1] for p in bbox) / 4
                        if y_center < 300:
                            is_marker = True
                    else:
                        is_marker = True
                
                if is_marker:
                    expanded_bbox = self._expand_bbox_to_data(bbox, ocr_words, category)
                    zones.append({
                        "category": category,
                        "bbox": expanded_bbox,
                        "marker_text": text
                    })
                    logger.info(f"Найден маркер '{text}' для категории '{category}'")
                    marker_found = True
                    break  # Переходим к следующей категории
            
            # Если маркер найден, не ищем по паттернам номеров проб отдельно
            if marker_found:
                continue
            
            # 2. Поиск номеров проб по паттернам (fallback, если маркер не найден)
            if category == "samples_list" and sample_patterns:
                sample_words = []
                for word in ocr_words:
                    text = word.get("text", "").strip()
                    for sample_pattern in sample_patterns:
                        if re.fullmatch(sample_pattern, text):
                            sample_words.append(word)
                            break
                
                if sample_words:
                    grouped_bbox = self._group_sample_words(sample_words)
                    if grouped_bbox:
                        zones.append({
                            "category": category,
                            "bbox": grouped_bbox,
                            "marker_text": f"Найдено {len(sample_words)} номеров проб"
                        })
                        logger.info(f"Найдено {len(sample_words)} номеров проб для категории '{category}' (по паттерну)")
        
        logger.info(f"Автодетекция завершена. Найдено зон: {len(zones)}")
        return zones
    
    def _group_sample_words(self, sample_words: List[Dict]) -> List[float]:
        if not sample_words:
            return None
        all_x = []
        all_y = []
        for word in sample_words:
            bbox = word.get("bbox")
            if bbox:
                all_x.extend([p[0] for p in bbox])
                all_y.extend([p[1] for p in bbox])
        if not all_x or not all_y:
            return None
        return [min(all_x), min(all_y), max(all_x), max(all_y)]
    
    def _expand_bbox_to_data(self, marker_bbox: List[List[float]], ocr_words: List[Dict], category: str) -> List[float]:
        """
        Возвращает точные координаты маркера без автоматического расширения.
        Для samples_list расширяем вниз до конца таблицы.
        """
        x_coords = [p[0] for p in marker_bbox]
        y_coords = [p[1] for p in marker_bbox]
        x1, x2 = min(x_coords), max(x_coords)
        y1, y2 = min(y_coords), max(y_coords)
        
        if category == "samples_list":
            # Для списка проб расширяем вниз, захватывая все номера
            for word in ocr_words:
                word_bbox = word.get("bbox")
                if not word_bbox:
                    continue
                word_x = sum(p[0] for p in word_bbox) / 4
                word_y = sum(p[1] for p in word_bbox) / 4
                
                # Если слово ниже маркера и примерно по центру по X
                if word_y > y2 and abs(word_x - (x1 + x2) / 2) < (x2 - x1):
                    y2 = max(y2, max(p[1] for p in word_bbox))
        
        # Для остальных категорий возвращаем ТОЧНЫЕ координаты маркера
        # БЕЗ автоматического расширения на 200px
        return [x1, y1, x2, y2]
# === LOGIC_END ===
# === LOGIC_END ===
# === LOGIC_END ===
# === LOGIC_END ===

# === TEST_START ===
if __name__ == "__main__":
    # Добавляем корень проекта в sys.path для корректных импортов
    sys.path.insert(0, str(Path(__file__).parent.parent))
    
    from src.ocr_engine import OCREngine
    
    if len(sys.argv) < 2:
        print("Использование: python src/auto_detector.py <path_to_image>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    print(f"Загрузка изображения: {image_path}")
    
    # Инициализация OCR
    engine = OCREngine(lang_list=['ru', 'en'])
    image = engine.load_image(image_path)
    
    # Распознавание всего изображения
    full_bbox = [0.0, 0.0, 1.0, 1.0]
    result = engine.recognize_zone(image, full_bbox)
    
    print(f"\nРаспознано слов: {len(result.get('words', []))}")
    for i, word in enumerate(result.get('words', []), 1):
        print(f"  {i}. '{word['text']}' (уверенность: {word['confidence']:.2f})")
    
    # Автодетекция зон
    detector = AutoDetector()
    zones = detector.detect_zones(result.get('words', []))
    
    print(f"\nНайдено зон: {len(zones)}")
    for i, zone in enumerate(zones, 1):
        print(f"  {i}. Категория: {zone['category']}")
        print(f"     Маркер: {zone['marker_text']}")
        print(f"     Bbox: {zone['bbox']}")
    
    print("\n" + "="*60)
    print("Тестирование завершено!")
    print("="*60)
# === TEST_END ===