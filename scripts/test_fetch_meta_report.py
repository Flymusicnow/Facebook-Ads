import importlib.util
from pathlib import Path
import unittest


SCRIPT_PATH = Path(__file__).with_name("fetch-meta-report.py")
SPEC = importlib.util.spec_from_file_location("fetch_meta_report", SCRIPT_PATH)
fetch_meta_report = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fetch_meta_report)


class FetchMetaReportFallbackTests(unittest.TestCase):
    def test_fallback_data_renders_status_cards_without_raw_metrics(self):
        data = fetch_meta_report.base_data(
            "The Clarity Shop",
            "Sales / Purchase test",
            "Missing secrets.",
            "Missing secrets",
        )

        html = fetch_meta_report.render_status_cards(data)

        self.assertIn("Ser folk annonsen?", html)
        self.assertIn("Visningar", html)

    def test_fallback_data_renders_full_html_without_raw_metrics(self):
        data = fetch_meta_report.base_data(
            "The Clarity Shop",
            "Sales / Purchase test",
            "Missing secrets.",
            "Missing secrets",
        )

        html = fetch_meta_report.render_html(data)

        self.assertIn("Meta Ads Kontroll", html)
        self.assertIn("Visningar", html)
        self.assertIn("Öppna Control Room", html)
        self.assertIn("/reports/the-clarity-shop-control-room/latest.html", html)


if __name__ == "__main__":
    unittest.main()
