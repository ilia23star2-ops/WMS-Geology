"""Тест формирования markdown-отчёта CI."""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts" / "agent"))

from ci_report import build_report  # noqa: E402


def test_build_report_lists_jobs_and_failed_steps():
    payload = {
        "jobs": [
            {
                "name": "Backend (Django)",
                "conclusion": "failure",
                "steps": [
                    {"name": "Run tests", "conclusion": "failure"},
                    {"name": "Checkout", "conclusion": "success"},
                ],
            },
            {"name": "Web (React)", "conclusion": "success", "steps": []},
        ]
    }
    md = build_report(payload, "123", "fix/x")
    assert "| Backend (Django) | failure | Run tests |" in md
    assert "| Web (React) | success | — |" in md
    assert "- run: 123" in md
    assert "- ветка: fix/x" in md