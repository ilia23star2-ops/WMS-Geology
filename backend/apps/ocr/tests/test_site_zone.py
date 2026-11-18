"""6e-2-site: тип зоны «Участок» — ZONE_TYPES, serializer, extract_fields."""
from django.test import SimpleTestCase

from apps.ocr.models import OcrTask
from apps.ocr.serializers import OcrZonesPayloadSerializer
from apps.ocr.services.mapping import extract_fields


def _word(text, x0, y0, x1, y1):
    return {
        "text": text,
        "confidence": 0.9,
        "bbox": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
    }


SITES = [{"code": "TST", "name": "Тестовый участок", "match_patterns": []}]


class SiteZoneTests(SimpleTestCase):
    def test_zone_types_contains_site(self):
        self.assertIn("site", [c[0] for c in OcrTask.ZONE_TYPES])

    def test_serializer_accepts_site_rect(self):
        ser = OcrZonesPayloadSerializer(data={"zones": [
            {"type": "site", "rect": [0, 0, 100, 50], "source": "manual"},
        ]})
        self.assertTrue(ser.is_valid(), ser.errors)
        zone = ser.validated_data["zones"][0]
        self.assertEqual(zone["type"], "site")
        self.assertEqual(len(zone["bbox"]), 4)

    def test_site_from_zone_returns_code(self):
        zones = [{
            "type": "site",
            "bbox": [[0, 0], [200, 0], [200, 50], [0, 50]],
            "source": "manual",
        }]
        ocr = {
            "text": "Тестовый участок",
            "words": [
                _word("Тестовый", 0, 0, 90, 40),
                _word("участок", 95, 0, 190, 40),
            ],
        }
        res = extract_fields(zones, ocr, sites=SITES)
        self.assertEqual(res["site"], "TST")
        self.assertIn(res["source"], ("zones", "mixed"))

    def test_site_zone_no_match_falls_back_to_full_text(self):
        zones = [{
            "type": "site",
            "bbox": [[0, 0], [50, 0], [50, 50], [0, 50]],
            "source": "manual",
        }]
        ocr = {
            "text": "мусор TST",
            "words": [
                _word("мусор", 0, 0, 40, 40),
                _word("TST", 300, 300, 350, 340),
            ],
        }
        res = extract_fields(zones, ocr, sites=SITES)
        self.assertEqual(res["site"], "TST")
        self.assertEqual(res["source"], "fallback")