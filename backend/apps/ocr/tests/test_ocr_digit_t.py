"""6e-2-site-fix2: OCR читает 1 как T — коррекция в trailing-части."""
from django.test import SimpleTestCase

from apps.ocr.services.mapping import extract_fields

VP = {"TST"}


class OcrDigitTTests(SimpleTestCase):
    def test_sample_tstt_fixed_to_tst1(self):
        ocr = {"text": "TSTT234501", "words": []}
        res = extract_fields([], ocr, valid_prefixes=VP)
        self.assertEqual(res["samples"], ["TST1234501"])

    def test_sample_correct_unchanged(self):
        ocr = {"text": "TST1234501", "words": []}
        res = extract_fields([], ocr, valid_prefixes=VP)
        self.assertEqual(res["samples"], ["TST1234501"])

    def test_work_order_fallback_tstt_fixed(self):
        ocr = {"text": "TSTT234", "words": []}
        res = extract_fields([], ocr, valid_prefixes=VP)
        self.assertEqual(res["work_order_coded"], "TST1234")