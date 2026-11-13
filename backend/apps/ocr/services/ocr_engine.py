# Module: ocr_engine.py
# Version: 1.0.0
# Description: OCR-движок на базе EasyOCR с поддержкой кириллицы и постобработкой

import cv2
import numpy as np
import json
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import easyocr
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# === LOGIC_START ===
class OCREngine:
    """
    Движок для распознавания текста из изображений на базе EasyOCR.
    """
    def __init__(self, lang_list: List[str] = None):
        """Инициализация OCR движка."""
        logger.info("Инициализация OCR Engine (EasyOCR)...")
        try:
            if lang_list is None:
                lang_list = ['ru', 'en']
            self.reader = easyocr.Reader(lang_list, gpu=False)
            self.current_image: Optional[np.ndarray] = None
            self.current_image_path: Optional[Path] = None
            logger.info(f"OCR Engine успешно инициализирован (языки: {', '.join(lang_list)})")
        except Exception as e:
            logger.error(f"Ошибка инициализации OCR Engine: {e}")
            raise

    def load_image(self, image_path: str) -> np.ndarray:
        """Загрузка изображения из файла."""
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Файл не найден: {image_path}")
        if not path.is_file():
            raise ValueError(f"Путь не является файлом: {image_path}")
        
        image_array = np.fromfile(str(path), dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError(f"Не удалось загрузить изображение: {image_path}")
        
        self.current_image = image
        self.current_image_path = path
        logger.info(f"Изображение загружено: {path.name} ({image.shape[1]}x{image.shape[0]})")
        return image

    def preprocess_image(
        self, image: np.ndarray, grayscale: bool = False, binary: bool = False,
        binary_threshold: int = 127, denoise: bool = False, denoise_strength: int = 10,
        contrast: bool = False, contrast_factor: float = 1.5
    ) -> np.ndarray:
        """Предобработка изображения."""
        processed = image.copy()
        if grayscale and len(processed.shape) == 3:
            processed = cv2.cvtColor(processed, cv2.COLOR_BGR2GRAY)
        if binary:
            if len(processed.shape) == 3: processed = cv2.cvtColor(processed, cv2.COLOR_BGR2GRAY)
            _, processed = cv2.threshold(processed, binary_threshold, 255, cv2.THRESH_BINARY)
        if denoise:
            if len(processed.shape) == 2: processed = cv2.fastNlMeansDenoising(processed, None, denoise_strength)
            else: processed = cv2.fastNlMeansDenoisingColored(processed, None, denoise_strength)
        if contrast:
            processed = cv2.convertScaleAbs(processed, alpha=contrast_factor, beta=0)
        return processed

    def _convert_relative_to_absolute(self, image_shape: Tuple[int, ...], relative_bbox: Tuple[float, float, float, float]) -> Tuple[int, int, int, int]:
        """Конвертация относительных координат в абсолютные."""
        if len(image_shape) == 2: height, width = image_shape
        elif len(image_shape) == 3: height, width, _ = image_shape
        else: raise ValueError(f"Неожиданная форма изображения: {image_shape}")
        
        x1_rel, y1_rel, x2_rel, y2_rel = relative_bbox
        x1 = int(max(0.0, min(1.0, x1_rel)) * width)
        y1 = int(max(0.0, min(1.0, y1_rel)) * height)
        x2 = int(max(0.0, min(1.0, x2_rel)) * width)
        y2 = int(max(0.0, min(1.0, y2_rel)) * height)
        
        if x1 >= x2 or y1 >= y2: raise ValueError(f"Некорректные координаты зоны")
        return (x1, y1, x2, y2)

    def _crop_zone(self, image: np.ndarray, absolute_bbox: Tuple[int, int, int, int]) -> np.ndarray:
        """Вырезание зоны из изображения."""
        x1, y1, x2, y2 = absolute_bbox
        height, width = image.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(width, x2), min(height, y2)
        cropped = image[y1:y2, x1:x2]
        if cropped.size == 0: raise ValueError(f"Вырезанная зона пуста")
        return cropped

    def _extract_text_from_zone(self, zone_image: np.ndarray) -> Dict:
        """Распознавание текста в вырезанной зоне с использованием EasyOCR."""
        try:
            results = self.reader.readtext(zone_image, detail=1, paragraph=False)
            if not results:
                logger.warning("EasyOCR не распознал текст в зоне")
                return {"text": "", "confidence": 0.0, "words": []}
            
            words, full_text_parts, total_confidence = [], [], 0.0
            for bbox, text, confidence in results:
                words.append({"text": text, "confidence": float(confidence), "bbox": bbox})
                full_text_parts.append(text)
                total_confidence += confidence
            
            return {
                "text": " ".join(full_text_parts),
                "confidence": float(total_confidence / len(results)),
                "words": words
            }
        except Exception as e:
            logger.error(f"Ошибка распознавания текста: {e}")
            return {"text": "", "confidence": 0.0, "words": [], "error": str(e)}

    def _load_postprocessing_rules(self) -> dict:
        """Загрузка правил постобработки."""
        rules_file = Path(__file__).parent.parent / "config" / "postprocessing_rules.json"
        if not rules_file.exists(): return {}
        try:
            with open(rules_file, 'r', encoding='utf-8') as f: return json.load(f).get("rules", {})
        except Exception as e:
            logger.error(f"Ошибка загрузки правил постобработки: {e}")
            return {}

    def _basic_cleanup(self, text: str) -> str:
        """Базовая очистка текста от артефактов."""
        text = re.sub(r'([а-яА-Яa-zA-Z0-9])\s+\1', r'\1', text)
        text = re.sub(r'([а-яА-Я])\s+(\d)', r'\1\2', text)
        text = re.sub(r'(\d)\s+([а-яА-Я])', r'\1\2', text)
        return text.replace("  ", " ").replace("--", "-").replace("- -", "-").strip()

    def _fix_text_order(self, text: str) -> str:
        """Исправление порядка слов (если OCR читает справа налево)."""
        parts = text.split()
        if len(parts) < 2: return text
        for i, part in enumerate(parts):
            if re.match(r'^\d', part):
                if i > 0:
                    parts = [parts[i]] + parts[:i] + parts[i+1:]
                    return ' '.join(parts)
                break
        return text

    def _postprocess_text(self, text: str, category: str = None) -> str:
        """Постобработка текста с применением правил."""
        if not text: return text
        rules = self._load_postprocessing_rules()
        if not category or category not in rules: return self._basic_cleanup(text)
        
        category_rules = rules[category]
        for wrong, correct in category_rules.get("replace_patterns", {}).items():
            text = text.replace(wrong, correct)
        if category_rules.get("fix_order", False): text = self._fix_text_order(text)
        for regex_rule in category_rules.get("regex_patterns", []):
            pattern, replacement = regex_rule.get("pattern"), regex_rule.get("replacement")
            if pattern and replacement: text = re.sub(pattern, replacement, text)
        if category_rules.get("remove_spaces", False): text = text.replace(" ", "")
        return self._basic_cleanup(text)

    def recognize_zone(self, image: np.ndarray, relative_bbox: Tuple[float, float, float, float], preprocess_settings: Optional[Dict] = None, category: str = None) -> Dict:
        """Распознавание текста в одной зоне."""
        try:
            absolute_bbox = self._convert_relative_to_absolute(image.shape, relative_bbox)
            zone_image = self._crop_zone(image, absolute_bbox)
            if preprocess_settings: zone_image = self.preprocess_image(zone_image, **preprocess_settings)
            
            result = self._extract_text_from_zone(zone_image)
            result["bbox"] = list(relative_bbox)
            if category:
                result["text"] = self._postprocess_text(result["text"], category)
                result["category"] = category
            logger.info(f"Распознан текст: '{result['text']}' (уверенность: {result['confidence']:.2f})")
            return result
        except Exception as e:
            logger.error(f"Ошибка распознавания зоны: {e}")
            return {"text": "", "confidence": 0.0, "bbox": list(relative_bbox), "words": [], "error": str(e)}

    def recognize_zones(self, image: np.ndarray, zones: List[Dict], preprocess_settings: Optional[Dict] = None) -> List[Dict]:
        """Батч-распознавание текста в нескольких зонах."""
        logger.info(f"Начало батч-обработки {len(zones)} зон")
        results = []
        for i, zone in enumerate(zones):
            category = zone.get("category", f"zone_{i}")
            relative_bbox = zone.get("bbox")
            if not relative_bbox:
                results.append({"category": category, "text": "", "confidence": 0.0, "bbox": None, "error": "Отсутствуют координаты bbox"})
                continue
            logger.info(f"Обработка зоны {i+1}/{len(zones)}: {category}")
            results.append(self.recognize_zone(image, relative_bbox, preprocess_settings, category))
        logger.info(f"Батч-обработка завершена. Распознано зон: {len(results)}")
        return results
# === LOGIC_END ===

if __name__ == "__main__":
    # === TEST_START ===
    engine = OCREngine(lang_list=['ru', 'en'])
    project_root = Path(__file__).parent.parent
    test_image_path = project_root / "data" / "input" / "test_image.jpg"
    
    if test_image_path.exists():
        image = engine.load_image(str(test_image_path))
        preprocess_settings = {"grayscale": True, "binary": True, "binary_threshold": 180, "contrast": True, "contrast_factor": 1.3}
        zones = [
            {"category": "order_number", "bbox": (0.3774, 0.0453, 0.6931, 0.1436)},
            {"category": "samples_list", "bbox": (0.1009, 0.2573, 0.4567, 0.4897)},
            {"category": "research_type", "bbox": (0.5057, 0.2735, 0.5690, 0.3778)},
            {"category": "container_number", "bbox": (0.4794, 0.6060, 0.6107, 0.7137)},
        ]
        results = engine.recognize_zones(image, zones, preprocess_settings)
        for i, res in enumerate(results, 1):
            print(f"  Зона {i} ({res['category']}): '{res['text']}' (уверенность: {res['confidence']:.2f})")
    else:
        print(f"Тестовое изображение не найдено: {test_image_path}")
    # === TEST_END ===