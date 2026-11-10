from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("samples", "0008_sample_parent_sample"),
    ]

    operations = [
        migrations.AddField(
            model_name="sample",
            name="is_encrypted",
            field=models.BooleanField(
                default=False,
                help_text="Флаг: проба зашифрована (номер и Н/З изменены).",
            ),
        ),
    ]