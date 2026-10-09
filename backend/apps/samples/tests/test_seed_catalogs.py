"""
Тесты management-команды seed_catalogs.
"""

from io import StringIO

from django.core.management import call_command

from apps.samples.catalogs import Laboratory, ResearchType, Site


def test_seed_creates_research_types(db):
    call_command("seed_catalogs", stdout=StringIO())
    assert ResearchType.objects.count() == 3
    assert set(ResearchType.objects.values_list("code", flat=True)) == {
        "ШЛ", "ХА", "ИЗ",
    }


def test_seed_creates_sites(db):
    call_command("seed_catalogs", stdout=StringIO())
    assert Site.objects.count() == 2
    tst = Site.objects.get(code="TST")
    assert tst.match_patterns == ["TST", "Тест"]


def test_seed_creates_laboratories(db):
    call_command("seed_catalogs", stdout=StringIO())
    assert Laboratory.objects.count() == 2


def test_seed_is_idempotent(db):
    """Повторный запуск не создаёт дубликатов."""
    call_command("seed_catalogs", stdout=StringIO())
    call_command("seed_catalogs", stdout=StringIO())
    assert ResearchType.objects.count() == 3
    assert Site.objects.count() == 2
    assert Laboratory.objects.count() == 2


def test_seed_updates_description(db):
    """Изменённое описание обновляется при повторном запуске."""
    ResearchType.objects.create(code="ШЛ", name="Старое имя")
    call_command("seed_catalogs", stdout=StringIO())
    rt = ResearchType.objects.get(code="ШЛ")
    assert rt.name == "Шлифы"


def test_seed_output_mentions_created(db):
    out = StringIO()
    call_command("seed_catalogs", stdout=out)
    text = out.getvalue()
    assert "ResearchType" in text
    assert "Site" in text
    assert "Laboratory" in text