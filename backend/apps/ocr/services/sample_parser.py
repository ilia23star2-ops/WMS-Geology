# Module: sample_parser.py
# Version: 1.0.6
# Description: Упрощённый парсер номеров проб с группировкой и сортировкой

import re
from typing import List, Dict
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# === LOGIC_START ===
# === LOGIC_START ===
class SampleParser:
    """
    Парсер номеров проб с алгоритмом LCP и обработкой ведущих нулей.
    """
    
    def __init__(self, default_sample_digits: int = 3):
        self.default_sample_digits = default_sample_digits
    
    def _extract_prefix(self, sample: str) -> str:
        match = re.match(r'^([A-Za-z]+)', sample)
        return match.group(1) if match else ""
    
    def _find_lcp(self, strings: List[str]) -> str:
        """
        Нахождение LCP с возвратом ведущих нулей в хвосты.
        """
        if not strings:
            return ""
        
        # 1. Находим строгий LCP
        lcp = strings[0]
        for s in strings[1:]:
            while not s.startswith(lcp):
                lcp = lcp[:-1]
                if not lcp:
                    return ""
        
        # 2. Проверяем хвосты
        tails = [s[len(lcp):] for s in strings]
        
        # Если все хвосты — цифры
        if all(t.isdigit() and len(t) > 0 for t in tails):
            min_tail_len = min(len(t) for t in tails)
            
            # Эвристика: если хвосты короче 3 цифр, и конец LCP состоит из нулей,
            # возвращаем нули в хвосты (так как 001, 002 — это валидные номера проб)
            if min_tail_len < 3 and lcp and lcp[-1].isdigit():
                chars_to_move = 3 - min_tail_len
                if len(lcp) >= chars_to_move:
                    potential_zeros = lcp[-chars_to_move:]
                    if potential_zeros == '0' * chars_to_move:
                        lcp = lcp[:-chars_to_move]
        
        return lcp
    
    def parse_samples(self, samples: List[str]) -> List[Dict]:
        if not samples:
            return []
        
        groups = {}
        for sample in samples:
            if not sample or not isinstance(sample, str):
                continue
            sample = sample.strip()
            prefix = self._extract_prefix(sample)
            if prefix not in groups:
                groups[prefix] = []
            groups[prefix].append(sample)
        
        result = []
        for prefix, group_samples in groups.items():
            if len(group_samples) == 1:
                parsed = self._parse_single_fallback(group_samples[0])
                result.append(parsed)
            else:
                lcp = self._find_lcp(group_samples)
                for sample in group_samples:
                    sample_str = sample[len(lcp):]
                    try:
                        sample_num = int(sample_str)
                    except ValueError:
                        sample_num = 0
                    result.append({
                        "full": sample,
                        "group": lcp,
                        "sample_str": sample_str,
                        "sample_num": sample_num,
                        "status": "available",
                        "auto_detected": False
                    })
        return result
    
    def _parse_single_fallback(self, sample: str) -> Dict:
        match = re.search(r'(\d+)$', sample)
        if not match:
            return {
                "full": sample, "group": sample, "sample_str": "",
                "sample_num": 0, "status": "available",
                "auto_detected": True, "error": "Нет цифр в номере"
            }
        digits = match.group(1)
        n = min(self.default_sample_digits, len(digits))
        sample_str = digits[-n:]
        group = sample[:len(sample)-n]
        return {
            "full": sample, "group": group, "sample_str": sample_str,
            "sample_num": int(sample_str), "status": "available",
            "auto_detected": True, "error": None
        }
    
    def group_samples(self, samples: List[Dict]) -> Dict[str, List[Dict]]:
        grouped = {}
        for sample in samples:
            group = sample.get("group", "unknown")
            if group not in grouped:
                grouped[group] = []
            grouped[group].append(sample)
        return grouped
    
    def sort_samples(self, samples: List[Dict]) -> List[Dict]:
        return sorted(samples, key=lambda x: x.get("sample_num", 0))
    
    def sort_grouped(self, grouped: Dict[str, List[Dict]]) -> Dict[str, List[Dict]]:
        return {g: self.sort_samples(s) for g, s in grouped.items()}
    
    def get_summary(self, samples: List[Dict]) -> Dict:
        total = len(samples)
        selected = sum(1 for s in samples if s.get("status") == "selected")
        return {"total": total, "selected": selected, "available": total - selected}
# === LOGIC_END ===
# === LOGIC_END ===
# === LOGIC_END ===
# === LOGIC_END ===

# === LOGIC_END ===
# === LOGIC_END ===
# === LOGIC_END ===

if __name__ == "__main__":
    # === TEST_START ===
    parser = SampleParser()
    
    test_samples = [
        "BRS7301149",
        "BRS7301001",
        "BRS7302001",
        "BRS7301150",
        "BRS73011000",  # Переход с 999 на 1000
        "AB12345"
    ]
    
    print("="*60)
    print("Тестирование SampleParser")
    print("="*60)
    
    parsed = parser.parse_samples(test_samples)
    
    print("\nРазобранные пробы:")
    for sample in parsed:
        print(f"  {sample['full']}: группа={sample['group']}, хвост={sample['sort_key']}")
    
    grouped = parser.group_samples(parsed)
    grouped_sorted = parser.sort_grouped(grouped)
    
    print("\nГруппировка и сортировка:")
    for group, samples in sorted(grouped_sorted.items()):
        print(f"\n  Группа {group}:")
        for sample in samples:
            print(f"    - {sample['full']} (хвост: {sample['sort_key']})")
    
    summary = parser.get_summary(parsed)
    print(f"\nСтатистика: всего {summary['total']}, выбрано {summary['selected']}, в наличии {summary['available']}")
    
    print("\n" + "="*60)
    print("Тестирование завершено!")
    print("="*60)
    # === TEST_END ===
