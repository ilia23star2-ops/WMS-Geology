"""6e-2-site-fix: scalar-зона захватила соседнюю строку → берём токен формата."""
from django.test import SimpleTestCase

from apps.ocr.services.mapping import extract_fields


def _word(text, x0, y0, x1, y1):
    return {
        "text": text,
        "confidence": 0.9,
        "bbox": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
    }


SITES = [{"code": "TST", "name": "Тестовый участок", "match_patterns": []}]
RT = [{"code": "ICP", "name": "ICP"}]
CT = [{"name": "Коробка"}]
WIDE = [[0, 0], [300, 0], [300, 80], [0, 80]]


class ScalarZonePickTests(SimpleTestCase):
    def test_work_order_zone_wide_picks_token(self):
        zones = [{"type": "work_order_coded", "bbox": WIDE, "source": "manual"}]
        ocr = {
            "text": "Тестовый участок TST1234",
            "words": [
                _word("Тестовый", 0, 0, 90, 30),
                _word("участок", 95, 0, 180, 30),
                _word("TST1234", 0, 40, 120, 70),
            ],
        }
        res = extract_fields(zones, ocr, sites=SITES, research_types=RT)
        self.assertEqual(res["work_order_coded"], "TST1234")

    def test_container_zone_wide_picks_number(self):
        zones = [{"type": "container_number", "bbox": WIDE, "source": "manual"}]
        ocr = {
            "text": "Коробка T12345",
            "words": [
                _word("Коробка", 0, 0, 90, 30),
                _word("T12345", 0, 40, 120, 70),
            ],
        }
        res = extract_fields(zones, ocr, container_types=CT)
        self.assertEqual(res["container_number"], "T12345")

    def test_research_zone_wide_picks_code(self):
        zones = [{"type": "research_type", "bbox": WIDE, "source": "manual"}]
        ocr = {
            "text": "Исп: ICP",
            "words": [
                _word("Исп:", 0, 0, 60, 30),
                _word("ICP", 0, 40, 80, 70),
            ],
        }
        res = extract_fields(zones, ocr, research_types=RT)
        self.assertEqual(res["research_type"], "ICP")

    def test_tight_zone_value_unchanged(self):
        zones = [{
            "type": "work_order_coded",
            "bbox": [[0, 40], [120, 40], [120, 70], [0, 70]],
            "source": "manual",
        }]
        ocr = {"text": "TST1234", "words": [_word("TST1234", 0, 40, 120, 70)]}
        res = extract_fields(zones, ocr)
        self.assertEqual(res["work_order_coded"], "TST1234")