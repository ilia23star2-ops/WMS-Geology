"""Тесты management-команды seed_container_comments."""

from io import StringIO

from django.core.management import call_command

from apps.storage.catalogs import ContainerComment


def test_seed_creates_comments(db):
    call_command("seed_container_comments", stdout=StringIO())
    assert ContainerComment.objects.count() == 4


def test_seed_is_idempotent(db):
    call_command("seed_container_comments", stdout=StringIO())
    call_command("seed_container_comments", stdout=StringIO())
    assert ContainerComment.objects.count() == 4


def test_seed_creates_known_comment(db):
    call_command("seed_container_comments", stdout=StringIO())
    assert ContainerComment.objects.filter(text="Повреждена").exists()


def test_seed_output_mentions_created(db):
    out = StringIO()
    call_command("seed_container_comments", stdout=out)
    assert "Создано" in out.getvalue() or "создано" in out.getvalue()