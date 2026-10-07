"""
Настройки Django-проекта WMS Geology.

Значения читаются из переменных окружения (файл .env в корне backend/).
См. .env.example — там перечислены все поддерживаемые переменные.
"""

from pathlib import Path

import environ

# --- Пути ---
BASE_DIR = Path(__file__).resolve().parent.parent

# --- Чтение .env ---
env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    DJANGO_TIME_ZONE=(str, "UTC"),
    CORS_ALLOWED_ORIGINS=(list, []),
    JWT_ACCESS_LIFETIME_MINUTES=(int, 60),
    JWT_REFRESH_LIFETIME_DAYS=(int, 7),
    QR_BASE_URL=(str, "http://localhost:8000"),
    LOG_LEVEL=(str, "INFO"),
)

env_file = BASE_DIR / ".env"
if env_file.exists():
    env.read_env(str(env_file))

# --- Безопасность ---
SECRET_KEY = env("DJANGO_SECRET_KEY", default="unsafe-dev-key-change-me")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# --- Приложения ---
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Сторонние
    "rest_framework",
    # Локальные
    "apps.storage",
    "apps.samples",
    "apps.work_orders",
    "apps.inventory",
    "apps.labels",
    "apps.users",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "wms_geology.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "wms_geology.wsgi.application"
ASGI_APPLICATION = "wms_geology.asgi.application"

# --- База данных (PostgreSQL) ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="wms_geology"),
        "USER": env("POSTGRES_USER", default="wms_user"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="wms_password"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
    }
}

# --- Валидация паролей ---
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Локализация ---
LANGUAGE_CODE = "ru-ru"
TIME_ZONE = env("DJANGO_TIME_ZONE")
USE_I18N = True
USE_TZ = True

# --- Статика ---
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- Медиа ---
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- Прочее ---
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

# --- CORS ---
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")

# --- Логирование ---
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": env("LOG_LEVEL"),
    },
}

# --- Проектные константы ---
QR_BASE_URL = env("QR_BASE_URL")