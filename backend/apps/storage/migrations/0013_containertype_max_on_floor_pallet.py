from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("storage", "0012_container_parent_container"),
    ]

    operations = [
        migrations.AddField(
            model_name="containertype",
            name="max_on_floor_pallet",
            field=models.IntegerField(
                blank=True,
                help_text="Максимум таких тар на напольном поддоне; NULL — как на стандартном.",
                null=True,
            ),
        ),
    ]