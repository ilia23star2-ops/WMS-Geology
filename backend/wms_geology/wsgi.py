"""WSGI-конфигурация проекта WMS Geology."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "wms_geology.settings")

application = get_wsgi_application()