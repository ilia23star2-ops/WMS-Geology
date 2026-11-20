"""Формирует markdown-отчёт о прогоне CI из ответа GitHub API.

Логи CI через браузерный raw-доступ недоступны (хост objects закрыт
прокси), поэтому итог проверок кладём файлом в репо: агент читает
agent/reports/LATEST.md по стабильной ссылке без токена.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def build_report(payload: dict, run_id: str, branch: str) -> str:
    """Собирает таблицу job / статус / упавшие шаги."""
    lines = [
        "# Отчёт CI",
        "",
        f"- run: {run_id}",
        f"- ветка: {branch}",
        "",
        "| Job | Статус | Упавшие шаги |",
        "|---|---|---|",
    ]
    for job in payload.get("jobs", []):
        name = job.get("name", "?")
        concl = job.get("conclusion") or job.get("status", "?")
        bad = [
            s.get("name", "?")
            for s in job.get("steps", [])
            if s.get("conclusion") == "failure"
        ]
        lines.append(f"| {name} | {concl} | {', '.join(bad) or '—'} |")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) != 4:
        print("использование: ci_report.py <jobs.json> <run_id> <branch>")
        return 2
    jobs_path, run_id, branch = sys.argv[1], sys.argv[2], sys.argv[3]
    payload = json.loads(Path(jobs_path).read_text(encoding="utf-8"))
    out = Path("agent/reports/LATEST.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_report(payload, run_id, branch), encoding="utf-8")
    print(f"отчёт записан: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())