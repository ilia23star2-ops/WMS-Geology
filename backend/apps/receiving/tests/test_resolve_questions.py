"""
Тесты сервиса `resolve_import_questions` и эндпоинта
`POST /import-sessions/{id}/resolve-questions/`.

Покрывают:
- успешный разбор одного вопроса (2 даты);
- успех при 3 датах;
- переход ImportSession PARSED → APPLIED (все вопросы разобраны);
- ошибки валидации: сумма, индекс, не-вопрос, повторный resolve,
  отсутствие target_date в distribution;
- 400 при статусе != PARSED;
- 400 при отсутствии site / research_type;
- смешанный запрос: 2 вопроса за раз.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.receiving.models import ImportSession, Receipt
from apps.receiving.services import resolve_import_questions
from apps.samples.catalogs import ResearchType, Site
from apps.storage.models import Container, ContainerType  # noqa: F401


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="resolve_test", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def site(db):
    return Site.objects.create(
        code="TST", name="Тестовый", match_patterns=["TST", "Тест"],
    )


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


TARGET = "2026-10-14"


def _make_session_with_question(
    *,
    containers_count: int = 3,
    dates: list[str] | None = None,
    target_date: str = TARGET,
    reason: str = "multi_date_match",
    sheet: str = "Тестовый",
    work_order: str = "Тест001",
    rt_code: str = "ШЛ",
    ct_name: str = "Ящики",
) -> ImportSession:
    """Создаёт ImportSession с одним Receipt и одним вопросом."""
    if dates is None:
        dates = ["2026-08-13", target_date, "2026-05-25"]

    session = ImportSession.objects.create(
        file="imports/test.xlsx",
        status=ImportSession.STATUS_PARSED,
    )
    Receipt.objects.create(
        receipt_number=f"ПР-{session.pk}",
        expected_date=target_date,
        status=Receipt.STATUS_EXPECTED,
    )
    session.receipt = Receipt.objects.filter(
        receipt_number=f"ПР-{session.pk}",
    ).first()
    session.save(update_fields=["receipt"])

    session.parse_errors = [
        {
            "code": "NEEDS_CONFIRMATION",
            "reason": reason,
            "sheet": sheet,
            "work_order": work_order,
            "research_type": rt_code,
            "container_type": ct_name,
            "containers_count": containers_count,
            "raw_dates": dates,
            "target_date": target_date,
            "message": "test question",
        },
    ]
    session.save(update_fields=["parse_errors"])
    return session


# ============================================================
# Успех
# ============================================================
@pytest.mark.django_db
def test_resolve_single_question_two_dates(site, research_type):
    session = _make_session_with_question(
        containers_count=3,
        dates=["2026-08-13", TARGET],
    )
    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,
                "distribution": [
                    {"date": "2026-08-13", "containers_count": 2},
                    {"date": TARGET, "containers_count": 1},
                ],
            },
        ],
    )
    assert errors == []
    assert created == 1

    assert Container.objects.count() == 1
    receipt = session.receipt
    assert receipt.items.count() == 1

    session.refresh_from_db()
    q = session.parse_errors[0]
    assert q["resolved"] is True
    assert "resolved_at" in q
    assert len(q["resolved_distribution"]) == 2


@pytest.mark.django_db
def test_resolve_three_dates(site, research_type):
    session = _make_session_with_question(
        containers_count=3,
        dates=["2026-08-13", TARGET, "2026-05-25"],
    )
    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,
                "distribution": [
                    {"date": "2026-08-13", "containers_count": 1},
                    {"date": TARGET, "containers_count": 1},
                    {"date": "2026-05-25", "containers_count": 1},
                ],
            },
        ],
    )
    assert errors == []
    assert created == 1


@pytest.mark.django_db
def test_resolve_all_questions_sets_applied(site, research_type):
    session = _make_session_with_question(containers_count=2)
    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,
                "distribution": [
                    {"date": "2026-08-13", "containers_count": 1},
                    {"date": TARGET, "containers_count": 1},
                ],
            },
        ],
    )
    assert errors == []
    session.refresh_from_db()
    assert session.status == ImportSession.STATUS_APPLIED


@pytest.mark.django_db
def test_resolve_creates_container_with_draft(site, research_type):
    session = _make_session_with_question(containers_count=1)
    resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,
                "distribution": [
                    {"date": TARGET, "containers_count": 1},
                    {"date": "2026-08-13", "containers_count": 0},
                ],
            },
        ],
    )
    c = Container.objects.get()
    assert c.status == Container.STATUS_IN_TRANSIT
    assert c.container_number is None
    assert c.draft_site == site
    assert c.draft_research_type == research_type
    assert c.draft_work_order_coded == "Тест001"


# ============================================================
# Ошибки валидации
# ============================================================
@pytest.mark.django_db
def test_resolve_sum_mismatch(site, research_type):
    session = _make_session_with_question(containers_count=3)
    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,
                "distribution": [
                    {"date": "2026-08-13", "containers_count": 1},
                    {"date": TARGET, "containers_count": 1},
                ],
            },
        ],
    )
    assert created == 0
    assert len(errors) == 1
    assert "Сумма" in errors[0]["error"]


@pytest.mark.django_db
def test_resolve_bad_index(site, research_type):
    session = _make_session_with_question()
    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 99,
                "distribution": [
                    {"date": TARGET, "containers_count": 3},
                ],
            },
        ],
    )
    assert created == 0
    assert "вне диапазона" in errors[0]["error"]


@pytest.mark.django_db
def test_resolve_not_a_question(site, research_type):
    """Если индекс ссылается на не-вопрос — ошибка."""
    session = ImportSession.objects.create(
        file="imports/test.xlsx",
        status=ImportSession.STATUS_PARSED,
        parse_errors=[
            {"error": "какая-то другая ошибка"},
            {
                "code": "NEEDS_CONFIRMATION",
                "reason": "multi_date_match",
                "sheet": "Тестовый",
                "work_order": "Тест001",
                "research_type": "ШЛ",
                "container_type": "Ящики",
                "containers_count": 1,
                "raw_dates": [TARGET],
                "target_date": TARGET,
                "message": "test question",
            },
        ],
    )
    Receipt.objects.create(
        receipt_number=f"ПР-{session.pk}",
        status=Receipt.STATUS_EXPECTED,
    )
    session.receipt = Receipt.objects.filter(
        receipt_number=f"ПР-{session.pk}",
    ).first()
    session.save(update_fields=["receipt"])

    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,  # это не-вопрос
                "distribution": [
                    {"date": TARGET, "containers_count": 1},
                ],
            },
        ],
    )
    assert created == 0
    assert "не вопрос" in errors[0]["error"]


@pytest.mark.django_db
def test_resolve_already_resolved(site, research_type):
    session = _make_session_with_question(containers_count=1)
    session.parse_errors[0]["resolved"] = True
    session.save(update_fields=["parse_errors"])

    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,
                "distribution": [
                    {"date": TARGET, "containers_count": 1},
                ],
            },
        ],
    )
    assert created == 0
    assert "уже разобран" in errors[0]["error"]


@pytest.mark.django_db
def test_resolve_target_date_missing_in_distribution(site, research_type):
    session = _make_session_with_question(containers_count=3)
    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,
                "distribution": [
                    {"date": "2026-08-13", "containers_count": 3},
                ],
            },
        ],
    )
    assert created == 0
    assert "target_date" in errors[0]["error"]


@pytest.mark.django_db
def test_resolve_site_not_found(research_type):
    session = _make_session_with_question(
        containers_count=1,
        sheet="НЕИЗВЕСТНЫЙ",
    )
    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,
                "distribution": [
                    {"date": TARGET, "containers_count": 1},
                ],
            },
        ],
    )
    assert created == 0
    assert "Участок не найден" in errors[0]["error"]


@pytest.mark.django_db
def test_resolve_research_type_not_found(site):
    session = _make_session_with_question(
        containers_count=1,
        rt_code="НЕТ_ТИПА",
    )
    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,
                "distribution": [
                    {"date": TARGET, "containers_count": 1},
                ],
            },
        ],
    )
    assert created == 0
    assert "Тип исследования" in errors[0]["error"]


@pytest.mark.django_db
def test_resolve_duplicate_index_in_request(site, research_type):
    session = _make_session_with_question(containers_count=2)
    created, errors = resolve_import_questions(
        session,
        resolutions=[
            {
                "question_index": 0,
                "distribution": [
                    {"date": TARGET, "containers_count": 2},
                ],
            },
            {
                "question_index": 0,
                "distribution": [
                    {"date": TARGET, "containers_count": 2},
                ],
            },
        ],
    )
    assert created == 0
    assert any("Дубликат" in e["error"] for e in errors)


# ============================================================
# View
# ============================================================
@pytest.mark.django_db
def test_view_requires_auth(db):
    from rest_framework.test import APIClient as AC
    client = AC()
    response = client.post(
        "/api/v1/import-sessions/1/resolve-questions/",
        {"resolutions": []},
        format="json",
    )
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_view_status_not_parsed(auth_client, site, research_type):
    session = ImportSession.objects.create(
        file="imports/x.xlsx",
        status=ImportSession.STATUS_APPLIED,
        parse_errors=[],
    )
    response = auth_client.post(
        f"/api/v1/import-sessions/{session.pk}/resolve-questions/",
        {"resolutions": []},
        format="json",
    )
    assert response.status_code == 400
    assert "PARSED" in str(response.data)


@pytest.mark.django_db
def test_view_success(auth_client, site, research_type):
    session = _make_session_with_question(containers_count=2)
    response = auth_client.post(
        f"/api/v1/import-sessions/{session.pk}/resolve-questions/",
        {
            "resolutions": [
                {
                    "question_index": 0,
                    "distribution": [
                        {"date": "2026-08-13", "containers_count": 1},
                        {"date": TARGET, "containers_count": 1},
                    ],
                },
            ],
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["created_containers_count"] == 1
    assert response.data["resolved_questions_count"] == 1
    assert response.data["total_questions_count"] == 1
    assert response.data["status"] == "APPLIED"


@pytest.mark.django_db
def test_view_validation_error(auth_client, site, research_type):
    session = _make_session_with_question(containers_count=5)
    response = auth_client.post(
        f"/api/v1/import-sessions/{session.pk}/resolve-questions/",
        {
            "resolutions": [
                {
                    "question_index": 0,
                    "distribution": [
                        {"date": TARGET, "containers_count": 1},
                    ],
                },
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "errors" in response.data